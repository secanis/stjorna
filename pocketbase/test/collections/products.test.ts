import { describe, it, expect, beforeAll } from 'vitest';
import { getPb } from '../setup.ts';
import { createAdminClient } from '../helpers/client.ts';
import { createTenantFixture, createCategoryFixture, createProductFixture } from '../helpers/fixtures.ts';

describe('Products Collection', () => {
  let pb: ReturnType<typeof getPb>;
  let tenantId: string;
  let categoryId: string;

  beforeAll(async () => {
    pb = await createAdminClient();
    const tenant = await pb.collection('tenants').create(createTenantFixture());
    tenantId = tenant.id;

    const category = await pb.collection('categories').create(
      createCategoryFixture(tenantId)
    );
    categoryId = category.id;
  });

  it('should create a product with tenant', async () => {
    const fixture = createProductFixture(tenantId);
    const record = await pb.collection('products').create(fixture);

    expect(record.id).toBeDefined();
    expect(record.tenant).toBe(tenantId);
    expect(record.name).toBe(fixture.name);
    expect(record.slug).toBe(fixture.slug);
    expect(record.active).toBe(true);
  });

  it('should create product with category relation', async () => {
    const fixture = createProductFixture(tenantId, { category: categoryId });
    const record = await pb.collection('products').create(fixture);

    expect(record.category).toBe(categoryId);
  });

  it('should create product with price', async () => {
    const fixture = createProductFixture(tenantId, { price: 49.99 });
    const record = await pb.collection('products').create(fixture);

    expect(record.price).toBe(49.99);
  });

  it('should create product with custom_fields', async () => {
    const customFields = {
      photographer: 'John Doe',
      location: 'Swiss Alps',
      resolution: '4K',
      license_type: 'commercial',
    };
    const fixture = createProductFixture(tenantId, { custom_fields: customFields });
    const record = await pb.collection('products').create(fixture);

    expect(record.custom_fields).toEqual(customFields);
  });

  it('should read a product by id', async () => {
    const fixture = createProductFixture(tenantId);
    const created = await pb.collection('products').create(fixture);

    const read = await pb.collection('products').getOne(created.id);
    expect(read.id).toBe(created.id);
    expect(read.name).toBe(fixture.name);
  });

  it('should update a product', async () => {
    const fixture = createProductFixture(tenantId);
    const created = await pb.collection('products').create(fixture);

    const updated = await pb.collection('products').update(created.id, {
      name: 'Updated Product',
      price: 99.99,
      active: false,
    });

    expect(updated.name).toBe('Updated Product');
    expect(updated.price).toBe(99.99);
    expect(updated.active).toBe(false);
  });

  it('should update custom_fields', async () => {
    const fixture = createProductFixture(tenantId, {
      custom_fields: { color: 'blue' },
    });
    const created = await pb.collection('products').create(fixture);

    const updated = await pb.collection('products').update(created.id, {
      custom_fields: { color: 'red', size: 'large' },
    });

    expect(updated.custom_fields).toEqual({ color: 'red', size: 'large' });
  });

  it('should delete a product', async () => {
    const fixture = createProductFixture(tenantId);
    const created = await pb.collection('products').create(fixture);

    await pb.collection('products').delete(created.id);

    try {
      await pb.collection('products').getOne(created.id);
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('should list products by tenant', async () => {
    const fixture1 = createProductFixture(tenantId, { name: 'Product A' });
    const fixture2 = createProductFixture(tenantId, { name: 'Product B' });

    await pb.collection('products').create(fixture1);
    await pb.collection('products').create(fixture2);

    const results = await pb.collection('products').getList(1, 50, {
      filter: 'tenant = "' + tenantId + '"',
    });

    expect(results.items.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter products by category', async () => {
    const fixture1 = createProductFixture(tenantId, { category: categoryId });
    const fixture2 = createProductFixture(tenantId, { category: '' });

    await pb.collection('products').create(fixture1);
    await pb.collection('products').create(fixture2);

    const results = await pb.collection('products').getList(1, 50, {
      filter: 'tenant = "' + tenantId + '" && category = "' + categoryId + '"',
    });

    expect(results.items.every(p => p.category === categoryId)).toBe(true);
  });

  it('should filter active products', async () => {
    const fixture1 = createProductFixture(tenantId, { active: true });
    const fixture2 = createProductFixture(tenantId, { active: false });

    await pb.collection('products').create(fixture1);
    await pb.collection('products').create(fixture2);

    const results = await pb.collection('products').getList(1, 50, {
      filter: 'tenant = "' + tenantId + '" && active = true',
    });

    expect(results.items.every(p => p.active === true)).toBe(true);
  });

  it('should set sort_order', async () => {
    const fixture = createProductFixture(tenantId, { sort_order: 10 });
    const record = await pb.collection('products').create(fixture);

    expect(record.sort_order).toBe(10);
  });
});