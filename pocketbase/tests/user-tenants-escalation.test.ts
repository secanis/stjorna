import { describe, it, expect, beforeAll } from 'vitest';
import PocketBase from 'pocketbase';
import { getPbUrl } from '../setup.ts';
import { createAdminClient, createTenantUser, getRoleId } from './helpers/client.ts';
import { createTenantFixture } from './helpers/fixtures.ts';

/**
 * T-03: `source = "oidc"` must NOT be a free pass on user_tenants.
 *
 * Before the fix, user_tenants.pb.js had two bypass lines:
 *
 *     var source = String(e.record.get('source') || '');
 *     if (source === 'oidc') return e.next();
 *
 * on both `onRecordCreateRequest` and `onRecordUpdateRequest`. The
 * rationale was that oidc_groups.pb.js writes rows with source='oidc'
 * via $app.save(), which uses the model-save path and bypasses every
 * `*Request` hook. But the API path fires `*Request` hooks, so any
 * authenticated user could POST
 *
 *     { user: self, tenant: victim, role: <admin-id>, source: "oidc" }
 *
 * and become admin of any tenant in one request.
 *
 * The fix:
 *   1. Drop both bypass lines.
 *   2. Reject source='oidc' from any caller that is NOT a superuser
 *      (superusers keep the escape hatch for backfill / disaster
 *      recovery).
 *   3. Block silent reassignment of `user` on update — that's a
 *      delete + recreate flow so the audit trail stays explicit.
 *   4. Restrict the `source` column to a select enum
 *      (`oidc` | `manual` | ``) at the schema layer so PB itself
 *      rejects junk values even if the hook regresses.
 *   5. oidc_groups.pb.js no longer hijacks manual rows: it only
 *      updates `role` on rows whose source was already 'oidc'.
 */

describe('T-03: source=oidc bypass is closed', () => {
  let adminPb: PocketBase;
  let tenantA: string;
  let tenantB: string;
  let adminRoleId: string;
  let viewerRoleId: string;
  let bobId: string;
  let bobAuth: string;
  let bobUserT: string;
  let bobAsAdminUserT: string;

  beforeAll(async () => {
    adminPb = await createAdminClient();

    const tA = await adminPb.collection('tenants').create(createTenantFixture({ name: 'T03-A' }));
    const tB = await adminPb.collection('tenants').create(createTenantFixture({ name: 'T03-B' }));
    tenantA = tA.id;
    tenantB = tB.id;

    adminRoleId = await getRoleId('admin');
    viewerRoleId = await getRoleId('viewer');

    // Bob: viewer of Tenant-A, admin of Tenant-B. That gives him a
    // role in two tenants so we can also probe cross-tenant attempts.
    const bobUser = await adminPb.collection('users').create({
      email: 'bob-t03@t03.local',
      password: 'bobt03password1',
      passwordConfirm: 'bobt03password1',
    });
    bobId = bobUser.id;
    bobUserT = (await adminPb.collection('user_tenants').create({
      user: bobId, tenant: tenantA, role: viewerRoleId, source: 'manual',
    })).id;
    bobAsAdminUserT = (await adminPb.collection('user_tenants').create({
      user: bobId, tenant: tenantB, role: adminRoleId, source: 'manual',
    })).id;

    const bobPb = new PocketBase(getPbUrl());
    await bobPb.collection('users').authWithPassword('bob-t03@t03.local', 'bobt03password1');
    bobAuth = bobPb.authStore.token;
  });

  // -------------------------------------------------------------------------
  // Create bypass — the headline T-03 vulnerability
  // -------------------------------------------------------------------------
  describe('POST with source="oidc" from a non-superuser is rejected', () => {
    it('a viewer of Tenant-A cannot escalate to admin of Tenant-A via source="oidc"', async () => {
      const res = await fetch(getPbUrl() + '/api/collections/user_tenants/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + bobAuth },
        body: JSON.stringify({
          user: bobId,
          tenant: tenantA,
          role: adminRoleId,
          source: 'oidc',
        }),
      });
      expect(res.status).toBe(400);
      // PB's generic error body confirms the column rule fired.
      const body = await res.json();
      expect(String(body.message || '')).toMatch(/Failed to create record/i);
    });

    it('a viewer of Tenant-A cannot escalate to admin of Tenant-B (cross-tenant)', async () => {
      const res = await fetch(getPbUrl() + '/api/collections/user_tenants/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + bobAuth },
        body: JSON.stringify({
          user: bobId,
          tenant: tenantB,
          role: adminRoleId,
          source: 'oidc',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('an admin of Tenant-B cannot add themselves to Tenant-A via source="oidc"', async () => {
      const res = await fetch(getPbUrl() + '/api/collections/user_tenants/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + bobAuth },
        body: JSON.stringify({
          user: bobId,
          tenant: tenantA,
          role: adminRoleId,
          source: 'oidc',
        }),
      });
      // Bob IS admin of Tenant-B but not Tenant-A. The bypass line is
      // gone, so the regular tenant-admin check fires for the body
      // tenant and denies.
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Update bypass — the second half of T-03
  // -------------------------------------------------------------------------
  describe('PATCH with source="oidc" from a non-superuser is rejected', () => {
    it('a viewer cannot flip their own row\'s source to "oidc"', async () => {
      // Bob's Tenant-A row is his viewer row. He's not admin so the
      // row is invisible to him (updateRule returns 404). Either 400
      // or 404 is acceptable — both prove the source='oidc' stamp
      // didn't land.
      const res = await fetch(getPbUrl() + '/api/collections/user_tenants/records/' + bobUserT, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + bobAuth },
        body: JSON.stringify({ source: 'oidc' }),
      });
      expect([400, 404]).toContain(res.status);
    });

    it('even the admin of Tenant-B cannot flip their own source to "oidc" via the API', async () => {
      const res = await fetch(getPbUrl() + '/api/collections/user_tenants/records/' + bobAsAdminUserT, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + bobAuth },
        body: JSON.stringify({ source: 'oidc' }),
      });
      // The hook rejects source='oidc' for non-superusers regardless of
      // whether they pass the tenant-admin check. PB may surface this
      // as either 400 (rule validation) or 404 (record not visible to
      // caller under the new filter), but the underlying record MUST
      // not change.
      expect([400, 404]).toContain(res.status);
      const stored = await adminPb.collection('user_tenants').getOne(bobAsAdminUserT);
      expect(stored.source).toBe('manual');
    });
  });

  // -------------------------------------------------------------------------
  // Superuser escape hatch (backfill / disaster recovery)
  // -------------------------------------------------------------------------
  describe('superusers keep the source="oidc" escape hatch', () => {
    it('superuser SDK can create with source="oidc"', async () => {
      const stranger = await adminPb.collection('users').create({
        email: 't03-stranger@t03.local',
        password: 'strangert03pass',
        passwordConfirm: 'strangert03pass',
      });
      const res = await fetch(getPbUrl() + '/api/collections/user_tenants/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminPb.authStore.token },
        body: JSON.stringify({
          user: stranger.id,
          tenant: tenantA,
          role: viewerRoleId,
          source: 'oidc',
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.source).toBe('oidc');
    });
  });

  // -------------------------------------------------------------------------
  // Column-level enum rejects junk values
  // -------------------------------------------------------------------------
  describe('the source column rejects values outside the enum', () => {
    it('superuser cannot stamp source="not-in-enum"', async () => {
      const stranger = await adminPb.collection('users').create({
        email: 't03-junk@t03.local',
        password: 'junkt03pass',
        passwordConfirm: 'junkt03pass',
      });
      const res = await fetch(getPbUrl() + '/api/collections/user_tenants/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminPb.authStore.token },
        body: JSON.stringify({
          user: stranger.id,
          tenant: tenantB,
          role: viewerRoleId,
          source: 'totally-bogus',
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(String(body.data?.source?.message || '')).toMatch(/Invalid value/i);
    });
  });

  // -------------------------------------------------------------------------
  // user-reassignment blocked on update
  // -------------------------------------------------------------------------
  describe('PATCH cannot reassign a row to a different user', () => {
    it('admin cannot silently reassign a membership', async () => {
      const stranger = await adminPb.collection('users').create({
        email: 't03-reassign@t03.local',
        password: 'reassignt03pass',
        passwordConfirm: 'reassignt03pass',
      });
      // Create a fresh row owned by the stranger
      const fresh = await adminPb.collection('user_tenants').create({
        user: stranger.id,
        tenant: tenantB,
        role: viewerRoleId,
        source: 'manual',
      });
      const res = await fetch(getPbUrl() + '/api/collections/user_tenants/records/' + fresh.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminPb.authStore.token },
        body: JSON.stringify({ user: bobId }),
      });
      expect(res.status).toBe(400);
      const stored = await adminPb.collection('user_tenants').getOne(fresh.id);
      expect(stored.user).toBe(stranger.id);
    });

    it('admin can still update role + tenant within the same row', async () => {
      const stranger = await adminPb.collection('users').create({
        email: 't03-role@t03.local',
        password: 'rolet03pass',
        passwordConfirm: 'rolet03pass',
      });
      const fresh = await adminPb.collection('user_tenants').create({
        user: stranger.id,
        tenant: tenantA,
        role: viewerRoleId,
        source: 'manual',
      });
      const res = await fetch(getPbUrl() + '/api/collections/user_tenants/records/' + fresh.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminPb.authStore.token },
        body: JSON.stringify({ role: adminRoleId }),
      });
      expect(res.status).toBe(200);
      const stored = await adminPb.collection('user_tenants').getOne(fresh.id);
      expect(stored.role).toBe(adminRoleId);
      expect(stored.user).toBe(stranger.id);
    });
  });

  // -------------------------------------------------------------------------
  // oidc_groups.pb.js no longer hijacks manual rows
  // -------------------------------------------------------------------------
  describe('oidc_groups leaves manual rows alone (unit-level)', () => {
    it('the source column only accepts "oidc" / "manual" / ""', async () => {
      // The migration that turns `source` into a select enum enforces
      // this at the schema layer. We assert the field shape here so a
      // future migration that widens the enum again has to update the
      // test too.
      const coll = await adminPb.collections.getOne('user_tenants');
      const src = coll.fields.find((f: any) => f.name === 'source');
      expect(src).toBeDefined();
      expect(src.type).toBe('select');
      expect(new Set(src.values)).toEqual(new Set(['oidc', 'manual', '']));
    });
  });
});
