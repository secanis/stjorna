import { describe, it, expect, beforeAll } from 'vitest';
import PocketBase from 'pocketbase';
import { getPbUrl } from '../setup.ts';
import { createAdminClient } from './helpers/client.ts';
import { createTenantFixture } from './helpers/fixtures.ts';

/**
 * Public media serving (GET /api/stjorna/media/{id}/file).
 *
 * The `public` flag on media (migration 1780002000) lets a tenant expose
 * individual files for anonymous embedding. The route serves a file without
 * a token ONLY when `public === true`; the T-08 protected-file model is
 * otherwise untouched (media.file stays `protected: true`).
 *
 * Guarantees pinned here:
 *   1. A public file is served anonymously (200, correct content-type).
 *   2. A non-public file is NOT served (404) — the flag is enforced.
 *   3. `?thumb=` returns a thumbnail (or the original) without erroring.
 *   4. The schema keeps media.file protected (T-08 intact).
 */

const tinyPng = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
), (c) => c.charCodeAt(0));

describe('public media: GET /api/stjorna/media/{id}/file', () => {
  let adminPb: PocketBase;
  let tenant: string;
  let publicMediaId: string;
  let privateMediaId: string;
  let privateFilename: string;

  beforeAll(async () => {
    adminPb = await createAdminClient();
    const t = await adminPb.collection('tenants').create(
      createTenantFixture({ name: 'PubMedia', slug: 'pub-media-' + Date.now() }),
    );
    tenant = t.id;

    const upload = async (name: string) => {
      const fd = new FormData();
      fd.append('tenant', tenant);
      fd.append('file', new Blob([tinyPng], { type: 'image/png' }), name);
      return adminPb.collection('media').create(fd);
    };

    const pub = await upload('pub-canary.png');
    await adminPb.collection('media').update(pub.id, { public: true });
    publicMediaId = pub.id;

    const priv = await upload('priv-canary.png');
    privateMediaId = priv.id;
    privateFilename = priv.file as string;
  });

  it('schema: media has a `public` field and `file` stays protected', async () => {
    const coll = await adminPb.collections.getOne('media');
    const pub = coll.fields.find((x: any) => x.name === 'public');
    expect(pub, 'media.public should exist').toBeDefined();
    const file = coll.fields.find((x: any) => x.name === 'file');
    expect((file as any).protected, 'media.file should stay protected (T-08)').toBe(true);
  });

  it('serves a public file anonymously (200, correct content-type)', async () => {
    const res = await fetch(getPbUrl() + `/api/stjorna/media/${publicMediaId}/file`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(8);
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
  });

  it('does not serve a non-public file (404)', async () => {
    const res = await fetch(getPbUrl() + `/api/stjorna/media/${privateMediaId}/file`);
    expect(res.status).toBe(404);
  });

  it('returns an image for ?thumb= without erroring', async () => {
    const res = await fetch(getPbUrl() + `/api/stjorna/media/${publicMediaId}/file?thumb=100x100`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes[0]).toBe(0x89);
  });

  it('does not serve a non-public file via the public route with a thumb either', async () => {
    const res = await fetch(getPbUrl() + `/api/stjorna/media/${privateMediaId}/file?thumb=100x100`);
    expect(res.status).toBe(404);
  });

  it('non-public files remain protected on the normal /api/files/ path', async () => {
    const url = getPbUrl() + `/api/files/media/${privateMediaId}/${privateFilename}`;
    const res = await fetch(url);
    expect([401, 403, 404]).toContain(res.status);
  });
});
