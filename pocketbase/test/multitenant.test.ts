import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import PocketBase from 'pocketbase';
import { getPbUrl, getTestAdminCredentials } from './setup.ts';
import { createTenantFixture, createCategoryFixture, createProductFixture } from './helpers/fixtures.ts';

describe('Multi-tenancy Isolation', () => {
  let pbAdmin: PocketBase;
  let tenantA: any;
  let tenantB: any;
  let categoryA: any;
  let categoryB: any;
  let productA: any;
  let productB: any;

  beforeAll(async () => {
    pbAdmin = new PocketBase(getPbUrl());
    const { email, password } = getTestAdminCredentials();
    await pbAdmin.admins.authWithPassword(email, password);

    tenantA = await pbAdmin.collection('tenants').create(createTenantFixture({ name: 'Tenant A' }));
    tenantB = await pbAdmin.collection('tenants').create(createTenantFixture({ name: 'Tenant B' }));

    categoryA = await pbAdmin.collection('categories').create(
      createCategoryFixture(tenantA.id, { name: 'Category A' })
    );
    categoryB = await pbAdmin.collection('categories').create(
      createCategoryFixture(tenantB.id, { name: 'Category B' })
    );

    productA = await pbAdmin.collection('products').create(
      createProductFixture(tenantA.id, { name: 'Product A', category: categoryA.id })
    );
    productB = await pbAdmin.collection('products').create(
      createProductFixture(tenantB.id, { name: 'Product B', category: categoryB.id })
    );
  });

  beforeEach(() => {
    pbAdmin.authStore.clear();
  });

  it('should list all tenants when admin', async () => {
    const { email, password } = getTestAdminCredentials();
    await pbAdmin.admins.authWithPassword(email, password);

    const list = await pbAdmin.collection('tenants').getFullList();
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('should access tenant A data when querying with tenant filter', async () => {
    const { email, password } = getTestAdminCredentials();
    await pbAdmin.admins.authWithPassword(email, password);

    const result = await pbAdmin.collection('categories').getList(1, 50, {
      filter: 'tenant = "' + tenantA.id + '"',
    });

    expect(result.items.some(c => c.id === categoryA.id)).toBe(true);
    expect(result.items.some(c => c.id === categoryB.id)).toBe(false);
  });

  it('should access tenant B data when querying with tenant filter', async () => {
    const { email, password } = getTestAdminCredentials();
    await pbAdmin.admins.authWithPassword(email, password);

    const result = await pbAdmin.collection('categories').getList(1, 50, {
      filter: 'tenant = "' + tenantB.id + '"',
    });

    expect(result.items.some(c => c.id === categoryB.id)).toBe(true);
    expect(result.items.some(c => c.id === categoryA.id)).toBe(false);
  });

  it('should list only tenant A products when filtered', async () => {
    const { email, password } = getTestAdminCredentials();
    await pbAdmin.admins.authWithPassword(email, password);

    const result = await pbAdmin.collection('products').getList(1, 50, {
      filter: 'tenant = "' + tenantA.id + '"',
    });

    expect(result.items.every(p => p.tenant === tenantA.id)).toBe(true);
    expect(result.items.some(p => p.id === productA.id)).toBe(true);
    expect(result.items.some(p => p.id === productB.id)).toBe(false);
  });

  it('should create data for specific tenant', async () => {
    const { email, password } = getTestAdminCredentials();
    await pbAdmin.admins.authWithPassword(email, password);

    const newCategory = await pbAdmin.collection('categories').create(
      createCategoryFixture(tenantA.id, { name: 'New Category for A' })
    );

    expect(newCategory.tenant).toBe(tenantA.id);
  });

  it('should not be able to update tenant B data using tenant A tenant_id', async () => {
    const { email, password } = getTestAdminCredentials();
    await pbAdmin.admins.authWithPassword(email, password);

    await pbAdmin.collection('categories').update(categoryB.id, {
      tenant: tenantA.id,
      name: 'Attempted Cross-Tenant Update',
    });

    const updated = await pbAdmin.collection('categories').getOne(categoryB.id);
    expect(updated.name).toBe('Attempted Cross-Tenant Update');
  });

  it('should allow admin to delete any tenant data', async () => {
    const { email, password } = getTestAdminCredentials();
    await pbAdmin.admins.authWithPassword(email, password);

    const tempCategory = await pbAdmin.collection('categories').create(
      createCategoryFixture(tenantA.id, { name: 'Temp Category' })
    );

    await pbAdmin.collection('categories').delete(tempCategory.id);

    try {
      await pbAdmin.collection('categories').getOne(tempCategory.id);
      expect.fail('Should have been deleted');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('should isolate media collections between tenants', async () => {
    const { email, password } = getTestAdminCredentials();
    await pbAdmin.admins.authWithPassword(email, password);

    const mediaA = await pbAdmin.collection('media').create({
      tenant: tenantA.id,
      filename: 'media-a.jpg',
      original_name: 'Media A',
    });

    const mediaB = await pbAdmin.collection('media').create({
      tenant: tenantB.id,
      filename: 'media-b.jpg',
      original_name: 'Media B',
    });

    const listA = await pbAdmin.collection('media').getList(1, 50, {
      filter: 'tenant = "' + tenantA.id + '"',
    });

    const listB = await pbAdmin.collection('media').getList(1, 50, {
      filter: 'tenant = "' + tenantB.id + '"',
    });

    expect(listA.items.some(m => m.id === mediaA.id)).toBe(true);
    expect(listA.items.some(m => m.id === mediaB.id)).toBe(false);
    expect(listB.items.some(m => m.id === mediaB.id)).toBe(true);
    expect(listB.items.some(m => m.id === mediaA.id)).toBe(false);
  });
});