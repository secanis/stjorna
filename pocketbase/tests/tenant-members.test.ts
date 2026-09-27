import { describe, it, expect, beforeAll } from 'vitest';
import PocketBase from 'pocketbase';
import { getPbUrl } from '../setup.ts';
import { createAdminClient, createTenantUser } from './helpers/client.ts';
import { createTenantFixture } from './helpers/fixtures.ts';

/**
 * GET /api/stjorna/tenants/{id}/members
 *
 * T-02 locked `users` list/view to superusers, which left the Users page
 * with blank names/emails for tenant admins (the user_tenants expand of
 * `user` is empty for them). This route is the narrow replacement: it
 * returns id/name/email of ONE tenant's members, to superusers and to
 * admins OF THAT tenant only.
 */

describe('tenant members directory', () => {
  let adminPb: PocketBase;
  let tenantA: string;
  let tenantB: string;
  let adminA: { pb: PocketBase; email: string };
  let editorA: { pb: PocketBase; email: string };
  let adminB: { pb: PocketBase; email: string };
  const nonce = Date.now().toString(36);

  const members = (tenantId: string, token?: string) =>
    fetch(`${getPbUrl()}/api/stjorna/tenants/${tenantId}/members`, {
      headers: token ? { Authorization: token } : {},
    });

  beforeAll(async () => {
    adminPb = await createAdminClient();
    tenantA = (await adminPb.collection('tenants').create(createTenantFixture({ name: 'Members-A' }))).id;
    tenantB = (await adminPb.collection('tenants').create(createTenantFixture({ name: 'Members-B' }))).id;

    adminA = await createTenantUser(tenantA, 'admin', `ma-${nonce}`);
    editorA = await createTenantUser(tenantA, 'editor', `me-${nonce}`);
    adminB = await createTenantUser(tenantB, 'admin', `mb-${nonce}`);
  });

  it('tenant admin gets id/name/email of every member of their tenant', async () => {
    const res = await members(tenantA, adminA.pb.authStore.token);
    expect(res.status).toBe(200);
    const body = await res.json();

    const emails = body.members.map((m: any) => m.email).sort();
    expect(emails).toEqual([adminA.email, editorA.email].sort());
    expect(body.members.every((m: any) => m.name)).toBe(true);
    // Only the three directory fields — no tokenKey, last_tenant, etc.
    for (const m of body.members) {
      expect(Object.keys(m).sort()).toEqual(['email', 'id', 'name']);
    }
  });

  it('never includes members of other tenants', async () => {
    const res = await members(tenantA, adminA.pb.authStore.token);
    const body = await res.json();
    expect(body.members.map((m: any) => m.email)).not.toContain(adminB.email);
  });

  it('admin of ANOTHER tenant is denied', async () => {
    const res = await members(tenantA, adminB.pb.authStore.token);
    expect(res.status).toBe(403);
  });

  it('editor of the same tenant is denied', async () => {
    const res = await members(tenantA, editorA.pb.authStore.token);
    expect(res.status).toBe(403);
  });

  it('unknown tenant id is 403 for a tenant user (no existence oracle)', async () => {
    const res = await members('doesnotexist123', adminA.pb.authStore.token);
    expect(res.status).toBe(403);
  });

  it('anonymous caller is rejected', async () => {
    const res = await members(tenantA);
    expect([401, 403]).toContain(res.status);
  });

  it('superuser can list any tenant', async () => {
    const res = await members(tenantB, adminPb.authStore.token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members.map((m: any) => m.email)).toEqual([adminB.email]);
  });
});
