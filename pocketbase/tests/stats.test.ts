import { describe, it, expect, beforeAll } from 'vitest';
import { getPb, getPbUrl } from './setup.ts';
import { createAdminClient, createTenantUser } from './helpers/client.ts';
import {
  createTenantFixture,
  createCategoryFixture,
  createProductFixture,
  createMediaFixture,
} from './helpers/fixtures.ts';

describe('STJÓRNA stats — per-tenant aggregation', () => {
  let pb: ReturnType<typeof getPb>;
  let adminToken: string;

  beforeAll(async () => {
    pb = await createAdminClient();
    adminToken = pb.authStore.token;
  });

  // Helper for the admin stats GET.
  async function adminStats(tenantId: string, extraQuery = ''): Promise<{ res: Response; body: any }> {
    const res = await fetch(getPbUrl() + '/api/stjorna/stats?tenant=' + encodeURIComponent(tenantId) + extraQuery, {
      headers: { Authorization: 'Bearer ' + adminToken },
    });
    return { res, body: await res.json().catch(() => null) };
  }

  it('returns 401 with no bearer', async () => {
    const res = await fetch(getPbUrl() + '/api/stjorna/stats?tenant=anything');
    expect(res.status).toBe(401);
  });

  it('returns 400 when admin omits ?tenant=', async () => {
    const res = await fetch(getPbUrl() + '/api/stjorna/stats', {
      headers: { Authorization: 'Bearer ' + adminToken },
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when admin asks for a tenant that does not exist', async () => {
    const res = await fetch(getPbUrl() + '/api/stjorna/stats?tenant=nonexistent_id_xyz', {
      headers: { Authorization: 'Bearer ' + adminToken },
    });
    expect(res.status).toBe(404);
  });

  it('returns a zero-floored snapshot for a fresh tenant', async () => {
    const tenant = await pb.collection('tenants').create(createTenantFixture({ name: 'Empty Tenant' }));
    const { res, body } = await adminStats(tenant.id);
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.tenant.id).toBe(tenant.id);
    expect(body.counts).toEqual({ categories: 0, products: 0, media: 0, users: 0 });
    expect(body.storage.media_bytes).toBe(0);
    expect(body.storage.media_count).toBe(0);
    expect(body.storage.avg_media_bytes).toBe(0);
    expect(body.storage.largest_media).toBeNull();
    expect(body.storage.by_mime_type).toEqual([]);
    expect(body.activity_30d).toEqual({
      products_created: 0,
      products_updated: 0,
      media_uploaded: 0,
      categories_created: 0,
    });
    expect(typeof body.generated_at).toBe('string');
    // ISO-8601 sanity check.
    expect(new Date(body.generated_at).toISOString()).toBe(body.generated_at);
  });

  it('aggregates real data: counts, media bytes, largest, mime breakdown, activity', async () => {
    const tenant = await pb.collection('tenants').create(createTenantFixture({ name: 'Busy Tenant' }));

    // Seed: 2 categories, 3 products, 4 media rows of mixed types + sizes.
    await pb.collection('categories').create(createCategoryFixture(tenant.id, { name: 'Cat-A' }));
    await pb.collection('categories').create(createCategoryFixture(tenant.id, { name: 'Cat-B' }));
    await pb.collection('products').create(createProductFixture(tenant.id, { name: 'Prod-A' }));
    await pb.collection('products').create(createProductFixture(tenant.id, { name: 'Prod-B' }));
    await pb.collection('products').create(createProductFixture(tenant.id, { name: 'Prod-C' }));

    // Sizes: 1000 + 2000 + 5000 + 3000 = 11000 bytes total.
    // Largest: image/png at 5000 bytes.
    await pb.collection('media').create(createMediaFixture(tenant.id, { mime_type: 'image/jpeg', size: 1000 }));
    await pb.collection('media').create(createMediaFixture(tenant.id, { mime_type: 'image/jpeg', size: 2000 }));
    await pb.collection('media').create(createMediaFixture(tenant.id, { mime_type: 'image/png', size: 5000 }));
    await pb.collection('media').create(createMediaFixture(tenant.id, { mime_type: 'video/mp4', size: 3000 }));

    // Two tenant users (one admin, one viewer). STJÓRN A's users table
    // is PB's built-in auth collection (no `tenant` field); tenant
    // membership lives in `user_tenants`. Counting that table is the
    // canonical "how many users does this tenant have" answer.
    const userA = await pb.collection('users').create({
      email: `stats-a-${Date.now()}@stjorna.test`, password: 'test1234567abcd', passwordConfirm: 'test1234567abcd', name: 'Stats User A',
    });
    const userB = await pb.collection('users').create({
      email: `stats-b-${Date.now()}@stjorna.test`, password: 'test1234567abcd', passwordConfirm: 'test1234567abcd', name: 'Stats User B',
    });
    await pb.collection('user_tenants').create({ user: userA.id, tenant: tenant.id, role: 'admin' });
    await pb.collection('user_tenants').create({ user: userB.id, tenant: tenant.id, role: 'viewer' });

    // A second tenant — must NOT bleed into our counts.
    const other = await pb.collection('tenants').create(createTenantFixture({ name: 'Other Tenant' }));
    await pb.collection('media').create(createMediaFixture(other.id, { size: 999_999 }));
    // Membership on the other tenant — also must NOT bleed in.
    const userC = await pb.collection('users').create({
      email: `stats-c-${Date.now()}@stjorna.test`, password: 'test1234567abcd', passwordConfirm: 'test1234567abcd', name: 'Stats User C',
    });
    await pb.collection('user_tenants').create({ user: userC.id, tenant: other.id, role: 'editor' });

    const { res, body } = await adminStats(tenant.id);
    expect(res.status).toBe(200);
    expect(body.counts.categories).toBe(2);
    expect(body.counts.products).toBe(3);
    expect(body.counts.media).toBe(4);

    // Two users belong to this tenant. The third belongs to `other`.
    expect(body.counts.users).toBe(2);

    expect(body.storage.media_bytes).toBe(11000);
    expect(body.storage.media_count).toBe(4);
    expect(body.storage.avg_media_bytes).toBe(Math.round(11000 / 4));
    expect(body.storage.largest_media).not.toBeNull();
    expect(body.storage.largest_media.bytes).toBe(5000);
    expect(body.storage.largest_media.mime_type).toBe('image/png');

    const byMime = body.storage.by_mime_type;
    const mimeMap = Object.fromEntries(byMime.map((m: any) => [m.mime_type, m]));
    expect(mimeMap['image/jpeg']).toEqual({ mime_type: 'image/jpeg', count: 2, bytes: 3000 });
    expect(mimeMap['image/png']).toEqual({ mime_type: 'image/png', count: 1, bytes: 5000 });
    expect(mimeMap['video/mp4']).toEqual({ mime_type: 'video/mp4', count: 1, bytes: 3000 });

    // Sorted by bytes desc — png (5000) first.
    expect(byMime[0].bytes).toBeGreaterThanOrEqual(byMime[byMime.length - 1].bytes);

    // Everything was created just now — should count in last-30-days.
    expect(body.activity_30d.products_created).toBe(3);
    expect(body.activity_30d.categories_created).toBe(2);
    expect(body.activity_30d.media_uploaded).toBe(4);
  });

  it('tenant user can fetch their own tenant stats without ?tenant=', async () => {
    const tenant = await pb.collection('tenants').create(createTenantFixture({ name: 'Self-Lookup Tenant' }));
    await pb.collection('media').create(createMediaFixture(tenant.id, { size: 4096 }));

    const { pb: userPb } = await createTenantUser(tenant.id, 'viewer');

    const res = await fetch(getPbUrl() + '/api/stjorna/stats', {
      headers: { Authorization: 'Bearer ' + userPb.authStore.token },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.tenant.id).toBe(tenant.id);
    expect(body.storage.media_bytes).toBe(4096);
    expect(body.counts.media).toBe(1);
  });

  it('tenant user cannot query a different tenant — 403 even if ?tenant= matches', async () => {
    const mine = await pb.collection('tenants').create(createTenantFixture({ name: 'Mine' }));
    const theirs = await pb.collection('tenants').create(createTenantFixture({ name: 'Theirs' }));

    const { pb: userPb } = await createTenantUser(mine.id, 'viewer');

    const res = await fetch(getPbUrl() + '/api/stjorna/stats?tenant=' + encodeURIComponent(theirs.id), {
      headers: { Authorization: 'Bearer ' + userPb.authStore.token },
    });
    expect(res.status).toBe(403);
  });

  it('tenant user query param matching their own tenant is allowed (idempotent)', async () => {
    const tenant = await pb.collection('tenants').create(createTenantFixture({ name: 'Self-Match Tenant' }));
    const { pb: userPb } = await createTenantUser(tenant.id, 'editor');

    const res = await fetch(getPbUrl() + '/api/stjorna/stats?tenant=' + encodeURIComponent(tenant.id), {
      headers: { Authorization: 'Bearer ' + userPb.authStore.token },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenant.id).toBe(tenant.id);
  });

  it('ignores rows with non-numeric / negative size (does not crash)', async () => {
    const tenant = await pb.collection('tenants').create(createTenantFixture({ name: 'Junky Tenant' }));
    // size: 0 is fine. size: -1 + size: 'garbage' would crash a naive
    // Number(x) || 0; we use isFinite guards.
    await pb.collection('media').create(createMediaFixture(tenant.id, { size: 0, mime_type: 'image/png' }));
    // @ts-expect-error — verify the hook tolerates a junk size value.
    await pb.collection('media').create(createMediaFixture(tenant.id, { size: -50, mime_type: 'image/png' }));

    const { res, body } = await adminStats(tenant.id);
    expect(res.status).toBe(200);
    expect(body.storage.media_bytes).toBe(0); // negative coerced away
    expect(body.storage.media_count).toBe(2);
    expect(body.storage.largest_media).not.toBeNull();
    expect(body.storage.largest_media.bytes).toBe(0);
  });
});
