import { describe, it, expect, beforeAll } from 'vitest';
import { getPb } from '../setup.ts';
import { createAdminClient } from '../helpers/client.ts';
import { createTenantFixture } from '../helpers/fixtures.ts';

describe('Tenants Collection', () => {
  let pb: ReturnType<typeof getPb>;

  beforeAll(async () => {
    pb = await createAdminClient();
  });

  it('should create a tenant', async () => {
    const fixture = createTenantFixture();
    const record = await pb.collection('tenants').create(fixture);

    expect(record.id).toBeDefined();
    expect(record.name).toBe(fixture.name);
    expect(record.slug).toBe(fixture.slug);
    expect(record.plan).toBe(fixture.plan);
  });

  it('should read a tenant by id', async () => {
    const fixture = createTenantFixture();
    const created = await pb.collection('tenants').create(fixture);

    const read = await pb.collection('tenants').getOne(created.id);
    expect(read.id).toBe(created.id);
    expect(read.name).toBe(fixture.name);
  });

  it('should update a tenant', async () => {
    const fixture = createTenantFixture({ plan: 'free' });
    const created = await pb.collection('tenants').create(fixture);

    const updated = await pb.collection('tenants').update(created.id, {
      name: 'Updated Tenant Name',
      plan: 'professional',
    });

    expect(updated.name).toBe('Updated Tenant Name');
    expect(updated.plan).toBe('professional');
    expect(updated.id).toBe(created.id);
  });

it('should delete a tenant', async () => {
    const fixture = createTenantFixture();
    const created = await pb.collection('tenants').create(fixture);

    await pb.collection('tenants').delete(created.id);

    try {
      await pb.collection('tenants').getOne(created.id);
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('should list all tenants', async () => {
    const fixture1 = createTenantFixture();
    const fixture2 = createTenantFixture();

    await pb.collection('tenants').create(fixture1);
    await pb.collection('tenants').create(fixture2);

    const list = await pb.collection('tenants').getFullList();
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter tenants by plan', async () => {
    const fixture = createTenantFixture({ plan: 'enterprise' });
    await pb.collection('tenants').create(fixture);

    const results = await pb.collection('tenants').getList(1, 50, {
      filter: 'plan = "enterprise"',
    });

    expect(results.items.some(t => t.plan === 'enterprise')).toBe(true);
  });

  it('should set custom_domain field', async () => {
    const fixture = createTenantFixture({
      custom_domain: 'media.example.com',
    });
    const record = await pb.collection('tenants').create(fixture);

    expect(record.custom_domain).toBe('media.example.com');
  });
});