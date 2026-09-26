import { describe, it, expect, beforeAll } from 'vitest';
import PocketBase from 'pocketbase';
import { getPbUrl } from '../setup.ts';
import { createAdminClient, createTenantUser } from './helpers/client.ts';
import {
    createTenantFixture,
} from './helpers/fixtures.ts';

/**
 * T-08: media files must not leak.
 *
 * Two guarantees the schema-level `protected: true` flag on media.file
 * is supposed to give us (migration 1770001400):
 *
 *   1. Anonymous request to /api/files/media/<id>/<file> returns 401/404
 *      — files are NOT world-readable.
 *
 *   2. Tenant A user requesting tenant B's media file with a valid file
 *      token gets 404/403 — the record rule (`@collection.user_tenants
 *      .user ?= @request.auth.id && @collection.user_tenants.tenant ?=
 *      tenant`) gates the file read, and the file token does not bypass
 *      it.
 *
 * These two tests pin both guarantees. They do NOT exercise the
 * frontend (the JWT-leak fix is in frontend/src/utils/mediaUrl.ts and
 * frontend/src/utils/mediaUrl.test.ts).
 */

describe('T-08: media.file is protected, no anonymous or cross-tenant reads', () => {
  let adminPb: PocketBase;
  let tenantA: string;
  let tenantB: string;
  let mediaRecordIdA: string;
  let mediaFilenameA: string;

  beforeAll(async () => {
    adminPb = await createAdminClient();
    const tA = await adminPb.collection('tenants').create(
      createTenantFixture({ name: 'T08-A', slug: 't08-a-' + Date.now() }),
    );
    const tB = await adminPb.collection('tenants').create(
      createTenantFixture({ name: 'T08-B', slug: 't08-b-' + Date.now() }),
    );
    tenantA = tA.id;
    tenantB = tB.id;

    // Seed a real file in tenant A's media collection. The minimal
    // valid PNG (1x1 transparent) is 67 bytes — keeps the test fast.
    const tinyPng = Uint8Array.from(atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    ), (c) => c.charCodeAt(0));
    const fd = new FormData();
    fd.append('tenant', tenantA);
    fd.append('file', new Blob([tinyPng], { type: 'image/png' }), 't08-canary.png');
    const rec = await adminPb.collection('media').create(fd);
    mediaRecordIdA = rec.id;
    // PB sanitises and adds a uniqueness suffix to the original filename
    // (e.g. 't08-canary.png' → 't08_canary_<rand>.png'). Use the value
    // PB actually stored.
    mediaFilenameA = rec.file as string;
  });

  it('schema: media.file has protected:true', async () => {
    const coll = await adminPb.collections.getOne('media');
    const f = coll.fields.find((x: any) => x.name === 'file');
    expect(f, 'media.file should exist').toBeDefined();
    expect((f as any).protected, 'media.file should be protected').toBe(true);
  });

  it('anonymous request to /api/files/media/<id>/<file> is rejected (401/404)', async () => {
    const url = getPbUrl() + `/api/files/media/${mediaRecordIdA}/${mediaFilenameA}`;
    const res = await fetch(url);
    // PB returns 404 for "record/file not found" with no token (the
    // record-rule filter hides the row). 401 would also be acceptable
    // but PB's behaviour is 404 — the important guarantee is that
    // the bytes are NOT returned.
    expect([401, 403, 404]).toContain(res.status);
    const buf = await res.arrayBuffer();
    // Even on a 404 page the PNG signature must be absent.
    const bytes = new Uint8Array(buf);
    expect(bytes.length).toBeLessThan(200);
    const isPng =
      bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
      bytes[3] === 0x47;
    expect(isPng).toBe(false);
  });

  it('a wrong-token request to /api/files/media/<id>/<file> is rejected', async () => {
    const url = getPbUrl() + `/api/files/media/${mediaRecordIdA}/${mediaFilenameA}?token=this-is-not-a-real-file-token`;
    const res = await fetch(url);
    expect([401, 403, 404]).toContain(res.status);
  });

  it('tenant B user (with valid file token) cannot read tenant A\'s media', async () => {
    const tenantBUser = await createTenantUser(tenantB, 'admin', 't08-b-' + Date.now());
    let fileToken = '';
    try {
      fileToken = await tenantBUser.pb.files.getToken();
    } catch (_e) {
      // If the user isn't fully authenticated for some reason, treat as
      // "tenant isolation denied" — same end state, the read fails.
      fileToken = '';
    }
    expect(fileToken.length).toBeGreaterThan(0);

    const url = getPbUrl() + `/api/files/media/${mediaRecordIdA}/${mediaFilenameA}?token=${encodeURIComponent(fileToken)}`;
    const res = await fetch(url);
    // The record rule for media is "@request.auth.id != ''" plus the
    // tenant isolation that closes cross-tenant reads. PB returns 404
    // when the row is filtered out by the rule.
    expect([403, 404]).toContain(res.status);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const isPng =
      bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
      bytes[3] === 0x47;
    expect(isPng).toBe(false);
  });

  it('tenant A user (with valid file token) CAN read tenant A\'s media', async () => {
    const tenantAUser = await createTenantUser(tenantA, 'admin', 't08-a-' + Date.now());
    const fileToken = await tenantAUser.pb.files.getToken();
    expect(fileToken.length).toBeGreaterThan(0);

    // Sanity: the user can list tenant A's media (proves the
    // user_tenants row is in place and the MEMBER_OF_TENANT rule
    // admits them).
    const list = await tenantAUser.pb.collection('media').getList(1, 5, {
      filter: `tenant = "${tenantA}"`,
    });
    const sees = list.items.some((i: any) => i.id === mediaRecordIdA);
    expect(sees, 'sanity: tenant A user can list tenant A media').toBe(true);

    const url = getPbUrl() + `/api/files/media/${mediaRecordIdA}/${mediaFilenameA}?token=${encodeURIComponent(fileToken)}`;
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(8);
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
  });
});
