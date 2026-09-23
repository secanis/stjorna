import { describe, it, expect, beforeAll } from 'vitest';
import PocketBase from 'pocketbase';
import { getPbUrl } from '../setup.ts';
import { createAdminClient, createTenantUser, getRoleId } from './helpers/client.ts';
import {
  createTenantFixture,
  createCategoryFixture,
  createProductFixture,
  createMediaFixture,
} from './helpers/fixtures.ts';

/**
 * T-02: tenant-isolation at the collection-rule level.
 *
 * Before migration 1770001000 every tenant-scoped collection used
 * `@request.auth.id != ""` for all five rules. Any authenticated user
 * could read, modify, re-home and delete every tenant's data; tenant
 * isolation existed only as a UI filter. The fix tightens the rules so
 * that reads see only the caller's own tenant's rows, writes require
 * editor / admin role and re-homing is rejected.
 *
 * Run as TENANT USERS (not superuser): the per-collection rules apply.
 */

describe('T-02: tenant isolation via collection rules', () => {
  let adminPb: PocketBase;
  let tenantA: string;
  let tenantB: string;
  let catA: string;
  let catB: string;
  let productA: string;
  let productB: string;
  let mediaA: string;
  let mediaB: string;
  // Per-run nonce so hard-coded slugs stay unique across re-runs of
  // the suite (the UNIQUE(tenant, slug) index would otherwise fail).
  const nonce = Date.now().toString(36);

  beforeAll(async () => {
    adminPb = await createAdminClient();

    const tA = await adminPb.collection('tenants').create(createTenantFixture({ name: 'Tenant-A' }));
    const tB = await adminPb.collection('tenants').create(createTenantFixture({ name: 'Tenant-B' }));
    tenantA = tA.id;
    tenantB = tB.id;

    const cA = await adminPb.collection('categories').create(createCategoryFixture(tenantA, { name: 'Cat-A', slug: 'cat-a-' + nonce }));
    const cB = await adminPb.collection('categories').create(createCategoryFixture(tenantB, { name: 'Cat-B', slug: 'cat-b-' + nonce }));
    catA = cA.id;
    catB = cB.id;

    const pA = await adminPb.collection('products').create(createProductFixture(tenantA, { name: 'Prod-A', slug: 'prod-a-' + nonce }));
    const pB = await adminPb.collection('products').create(createProductFixture(tenantB, { name: 'Prod-B', slug: 'prod-b-' + nonce }));
    productA = pA.id;
    productB = pB.id;

    const mA = await adminPb.collection('media').create(createMediaFixture(tenantA, { filename: 'm-a-' + nonce + '.jpg' }));
    const mB = await adminPb.collection('media').create(createMediaFixture(tenantB, { filename: 'm-b-' + nonce + '.jpg' }));
    mediaA = mA.id;
    mediaB = mB.id;
  });

  // -------------------------------------------------------------------------
  // Reads — a tenant user only sees their own tenant's rows
  // -------------------------------------------------------------------------
  describe('reads are scoped to the caller\'s tenant memberships', () => {
    it('tenant-A user cannot list Tenant-B\'s categories', async () => {
      const { pb: userA } = await createTenantUser(tenantA, 'viewer');
      const res = await fetch(getPbUrl() + '/api/collections/categories/records?perPage=200', {
        headers: { Authorization: 'Bearer ' + userA.authStore.token },
      });
      const body = await res.json();
      const ids = (body.items || []).map((c: any) => c.id);
      expect(ids).toContain(catA);
      expect(ids).not.toContain(catB);
    });

    it('tenant-A user cannot view Tenant-B\'s category directly (404)', async () => {
      const { pb: userA } = await createTenantUser(tenantA, 'viewer');
      const res = await fetch(getPbUrl() + '/api/collections/categories/records/' + catB, {
        headers: { Authorization: 'Bearer ' + userA.authStore.token },
      });
      expect(res.status).toBe(404);
    });

    it('tenant-A user cannot list Tenant-B\'s products', async () => {
      const { pb: userA } = await createTenantUser(tenantA, 'viewer');
      const res = await fetch(getPbUrl() + '/api/collections/products/records?perPage=200', {
        headers: { Authorization: 'Bearer ' + userA.authStore.token },
      });
      const body = await res.json();
      const ids = (body.items || []).map((p: any) => p.id);
      expect(ids).toContain(productA);
      expect(ids).not.toContain(productB);
    });

    it('tenant-A user cannot list Tenant-B\'s media', async () => {
      const { pb: userA } = await createTenantUser(tenantA, 'viewer');
      const res = await fetch(getPbUrl() + '/api/collections/media/records?perPage=200', {
        headers: { Authorization: 'Bearer ' + userA.authStore.token },
      });
      const body = await res.json();
      const ids = (body.items || []).map((m: any) => m.id);
      expect(ids).toContain(mediaA);
      expect(ids).not.toContain(mediaB);
    });

    it('tenant-A user cannot view Tenant-B\'s product directly (404)', async () => {
      const { pb: userA } = await createTenantUser(tenantA, 'viewer');
      const res = await fetch(getPbUrl() + '/api/collections/products/records/' + productB, {
        headers: { Authorization: 'Bearer ' + userA.authStore.token },
      });
      expect(res.status).toBe(404);
    });

    it('tenant-A user only sees Tenant-A in /api/collections/tenants', async () => {
      const { pb: userA } = await createTenantUser(tenantA, 'viewer');
      const res = await fetch(getPbUrl() + '/api/collections/tenants/records?perPage=200', {
        headers: { Authorization: 'Bearer ' + userA.authStore.token },
      });
      const body = await res.json();
      const ids = (body.items || []).map((t: any) => t.id);
      expect(ids).toContain(tenantA);
      expect(ids).not.toContain(tenantB);
    });

    it('an anonymous caller gets an empty tenant list (no enumeration)', async () => {
      const res = await fetch(getPbUrl() + '/api/collections/tenants/records');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toEqual([]);
    });

    it('user with no memberships gets an empty list (not a 500)', async () => {
      // Create a user with no user_tenants rows at all.
      await createAdminClient();
      const email = `lone-${Date.now()}@t02.test`;
      await adminPb.collection('users').create({
        email,
        password: 'lonepassword123',
        passwordConfirm: 'lonepassword123',
      });
      const lonePb = new PocketBase(getPbUrl());
      await lonePb.collection('users').authWithPassword(email, 'lonepassword123');
      const res = await fetch(getPbUrl() + '/api/collections/categories/records', {
        headers: { Authorization: 'Bearer ' + lonePb.authStore.token },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Creates — require editor/admin of the body.tenant
  // -------------------------------------------------------------------------
  describe('creates require editor/admin of body.tenant', () => {
    it('tenant-A admin can create a category in Tenant-A', async () => {
      const { pb: adminA } = await createTenantUser(tenantA, 'admin');
      const res = await fetch(getPbUrl() + '/api/collections/categories/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminA.authStore.token },
        body: JSON.stringify({ tenant: tenantA, name: 'AdminACat', slug: 'admin-a-cat-' + nonce }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tenant).toBe(tenantA);
    });

    it('tenant-A admin CANNOT create a category in Tenant-B', async () => {
      const { pb: adminA } = await createTenantUser(tenantA, 'admin');
      const res = await fetch(getPbUrl() + '/api/collections/categories/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminA.authStore.token },
        body: JSON.stringify({ tenant: tenantB, name: 'Sneaky', slug: 'sneaky-cat-' + nonce }),
      });
      expect(res.status).toBe(400);
    });

    it('tenant-A viewer CANNOT create a category (no editor role)', async () => {
      const { pb: viewerA } = await createTenantUser(tenantA, 'viewer');
      const res = await fetch(getPbUrl() + '/api/collections/categories/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + viewerA.authStore.token },
        body: JSON.stringify({ tenant: tenantA, name: 'ViewerCat', slug: 'viewer-cat-' + nonce }),
      });
      expect(res.status).toBe(400);
    });

    it('anonymous create is denied', async () => {
      const res = await fetch(getPbUrl() + '/api/collections/categories/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: tenantA, name: 'Anon', slug: 'anon-cat-' + nonce }),
      });
      expect(res.status).toBe(400);
    });

    it('the UNIQUE(tenant, slug) index prevents duplicate slugs per tenant', async () => {
      const { pb: adminA } = await createTenantUser(tenantA, 'admin');
      const slug = 'dup-' + Date.now();
      const first = await fetch(getPbUrl() + '/api/collections/categories/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminA.authStore.token },
        body: JSON.stringify({ tenant: tenantA, name: 'First', slug }),
      });
      expect(first.status).toBe(200);
      const second = await fetch(getPbUrl() + '/api/collections/categories/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminA.authStore.token },
        body: JSON.stringify({ tenant: tenantA, name: 'Second', slug }),
      });
      // PB returns 400 with a DB-uniqueness error.
      expect(second.status).toBe(400);
    });

    it('the same slug is allowed in a different tenant', async () => {
      const { pb: adminA } = await createTenantUser(tenantA, 'admin');
      const { pb: adminB } = await createTenantUser(tenantB, 'admin');
      const slug = 'shared-slug-' + Date.now();
      const r1 = await fetch(getPbUrl() + '/api/collections/categories/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminA.authStore.token },
        body: JSON.stringify({ tenant: tenantA, name: 'A side', slug }),
      });
      const r2 = await fetch(getPbUrl() + '/api/collections/categories/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminB.authStore.token },
        body: JSON.stringify({ tenant: tenantB, name: 'B side', slug }),
      });
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Updates — forbid changing tenant, require editor/admin
  // -------------------------------------------------------------------------
  describe('updates forbid re-homing and require editor/admin', () => {
    it('tenant-A admin can update their own category', async () => {
      const { pb: adminA } = await createTenantUser(tenantA, 'admin');
      const res = await fetch(getPbUrl() + '/api/collections/categories/records/' + catA, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminA.authStore.token },
        body: JSON.stringify({ name: 'Renamed Cat-A' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('Renamed Cat-A');
    });

    it('tenant-A admin CANNOT re-home a category into Tenant-B', async () => {
      const { pb: adminA } = await createTenantUser(tenantA, 'admin');
      const res = await fetch(getPbUrl() + '/api/collections/categories/records/' + catA, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminA.authStore.token },
        body: JSON.stringify({ tenant: tenantB }),
      });
      // Rule rejects the tenant-change: either 404 (record becomes invisible
      // under the new filter) or 400 (rule validation).
      expect([400, 404]).toContain(res.status);
    });

    it('tenant-A viewer CANNOT update a category (no editor role)', async () => {
      const { pb: viewerA } = await createTenantUser(tenantA, 'viewer');
      const res = await fetch(getPbUrl() + '/api/collections/categories/records/' + catA, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + viewerA.authStore.token },
        body: JSON.stringify({ name: 'Hijacked' }),
      });
      // Either 400 (rule validation) or 404 (record invisible because
      // the read filter excludes it for a non-writer viewer) is acceptable.
      expect([400, 404]).toContain(res.status);
    });

    it('tenant-A user CANNOT update Tenant-B\'s category (404)', async () => {
      const { pb: userA } = await createTenantUser(tenantA, 'admin');
      const res = await fetch(getPbUrl() + '/api/collections/categories/records/' + catB, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + userA.authStore.token },
        body: JSON.stringify({ name: 'Should not work' }),
      });
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Deletes — admin only
  // -------------------------------------------------------------------------
  describe('deletes are admin-only', () => {
    it('tenant-A admin can delete their own category (204)', async () => {
      // Create a fresh category so we don't break other tests.
      const { pb: adminA } = await createTenantUser(tenantA, 'admin');
      const created = await fetch(getPbUrl() + '/api/collections/categories/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminA.authStore.token },
        body: JSON.stringify({ tenant: tenantA, name: 'To Delete', slug: 'to-delete-' + Date.now() }),
      });
      const createdBody = await created.json();
      const del = await fetch(getPbUrl() + '/api/collections/categories/records/' + createdBody.id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + adminA.authStore.token },
      });
      expect(del.status).toBe(204);
    });

    it('tenant-A viewer CANNOT delete (no admin role)', async () => {
      const { pb: viewerA } = await createTenantUser(tenantA, 'viewer');
      const res = await fetch(getPbUrl() + '/api/collections/categories/records/' + catA, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + viewerA.authStore.token },
      });
      expect(res.status).toBe(404);
    });

    it('tenant-A admin CANNOT delete Tenant-B\'s category (404)', async () => {
      const { pb: adminA } = await createTenantUser(tenantA, 'admin');
      const res = await fetch(getPbUrl() + '/api/collections/categories/records/' + catB, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + adminA.authStore.token },
      });
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // user_tenants — own rows or admin-of-tenant
  // -------------------------------------------------------------------------
  describe('user_tenants reads scoped to own + admin-of-tenant', () => {
    it('a tenant-A user sees their own user_tenants row', async () => {
      const { pb: userA } = await createTenantUser(tenantA, 'viewer');
      const res = await fetch(getPbUrl() + '/api/collections/user_tenants/records', {
        headers: { Authorization: 'Bearer ' + userA.authStore.token },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      // The user should see at least their own row (from createTenantUser).
      const myRow = (body.items || []).find(
        (ut: any) => ut.user === userA.authStore.record?.id && ut.tenant === tenantA,
      );
      expect(myRow).toBeDefined();
    });

    it('a tenant-A viewer CANNOT write user_tenants rows', async () => {
      const { pb: viewerA } = await createTenantUser(tenantA, 'viewer');
      const stranger = await adminPb.collection('users').create({
        email: `t02-stranger-${Date.now()}@t02.test`,
        password: 'strangerpass123',
        passwordConfirm: 'strangerpass123',
      });
      const role = await getRoleId('viewer');
      const res = await fetch(getPbUrl() + '/api/collections/user_tenants/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + viewerA.authStore.token },
        body: JSON.stringify({ user: stranger.id, tenant: tenantA, role }),
      });
      // Rule rejects: viewer is not admin of tenantA → 400/403.
      expect([400, 403]).toContain(res.status);
    });
  });
});
