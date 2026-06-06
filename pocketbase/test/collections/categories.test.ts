import { describe, it, expect, beforeAll } from 'vitest';
import { getPb } from '../setup.ts';
import { createAdminClient } from '../helpers/client.ts';
import { createTenantFixture, createCategoryFixture } from '../helpers/fixtures.ts';

describe('Categories Collection', () => {
  let pb: ReturnType<typeof getPb>;
  let tenantId: string;

  beforeAll(async () => {
    pb = await createAdminClient();
    const tenant = await pb.collection('tenants').create(createTenantFixture());
    tenantId = tenant.id;
  });

  it('should create a category with tenant', async () => {
    const fixture = createCategoryFixture(tenantId);
    const record = await pb.collection('categories').create(fixture);

    expect(record.id).toBeDefined();
    expect(record.tenant).toBe(tenantId);
    expect(record.name).toBe(fixture.name);
    expect(record.slug).toBe(fixture.slug);
    expect(record.active).toBe(true);
  });

  it('should read a category by id', async () => {
    const fixture = createCategoryFixture(tenantId);
    const created = await pb.collection('categories').create(fixture);

    const read = await pb.collection('categories').getOne(created.id);
    expect(read.id).toBe(created.id);
    expect(read.name).toBe(fixture.name);
    expect(read.tenant).toBe(tenantId);
  });

  it('should update a category', async () => {
    const fixture = createCategoryFixture(tenantId);
    const created = await pb.collection('categories').create(fixture);

    const updated = await pb.collection('categories').update(created.id, {
      name: 'Updated Category',
      description: 'New description',
      active: false,
    });

    expect(updated.name).toBe('Updated Category');
    expect(updated.description).toBe('New description');
    expect(updated.active).toBe(false);
  });

  it('should delete a category', async () => {
    const fixture = createCategoryFixture(tenantId);
    const created = await pb.collection('categories').create(fixture);

    await pb.collection('categories').delete(created.id);

    try {
      await pb.collection('categories').getOne(created.id);
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('should list categories by tenant', async () => {
    const fixture1 = createCategoryFixture(tenantId, { name: 'Category A' });
    const fixture2 = createCategoryFixture(tenantId, { name: 'Category B' });

    await pb.collection('categories').create(fixture1);
    await pb.collection('categories').create(fixture2);

    const results = await pb.collection('categories').getList(1, 50, {
      filter: 'tenant = "' + tenantId + '"',
    });

    expect(results.items.length).toBeGreaterThanOrEqual(2);
    expect(results.items.every(c => c.tenant === tenantId)).toBe(true);
  });

  it('should filter active categories', async () => {
    const fixture1 = createCategoryFixture(tenantId, { active: true });
    const fixture2 = createCategoryFixture(tenantId, { active: false });

    await pb.collection('categories').create(fixture1);
    await pb.collection('categories').create(fixture2);

    const results = await pb.collection('categories').getList(1, 50, {
      filter: 'tenant = "' + tenantId + '" && active = true',
    });

    expect(results.items.every(c => c.active === true)).toBe(true);
  });

  it('should set sort_order', async () => {
    const fixture = createCategoryFixture(tenantId, { sort_order: 42 });
    const record = await pb.collection('categories').create(fixture);

    expect(record.sort_order).toBe(42);
  });

  it('should create category with description', async () => {
    const fixture = createCategoryFixture(tenantId, {
      description: 'This is a test category with a longer description',
    });
    const record = await pb.collection('categories').create(fixture);

    expect(record.description).toBe('This is a test category with a longer description');
  });
});