import { describe, it, expect, beforeAll } from 'vitest';
import { getPb } from './setup.ts';
import { createAdminClient } from './helpers/client.ts';
import { createTenantFixture, createWebhookFixture } from './helpers/fixtures.ts';

describe('Webhooks Collection', () => {
  let pb: ReturnType<typeof getPb>;
  let tenantId: string;

  beforeAll(async () => {
    pb = await createAdminClient();
    const tenant = await pb.collection('tenants').create(createTenantFixture());
    tenantId = tenant.id;
  });

  it('should create a webhook', async () => {
    const fixture = createWebhookFixture(tenantId);
    const record = await pb.collection('webhooks').create(fixture);

    expect(record.id).toBeDefined();
    expect(record.tenant).toBe(tenantId);
    expect(record.name).toBe(fixture.name);
    expect(record.url).toBe(fixture.url);
    expect(record.events).toEqual(fixture.events);
    expect(record.active).toBe(true);
  });

  it('should read a webhook by id', async () => {
    const fixture = createWebhookFixture(tenantId);
    const created = await pb.collection('webhooks').create(fixture);

    const read = await pb.collection('webhooks').getOne(created.id);
    expect(read.id).toBe(created.id);
    expect(read.name).toBe(fixture.name);
  });

  it('should update a webhook', async () => {
    const fixture = createWebhookFixture(tenantId, {
      events: ['category.created'],
    });
    const created = await pb.collection('webhooks').create(fixture);

    const updated = await pb.collection('webhooks').update(created.id, {
      name: 'Updated Webhook',
      events: ['product.created', 'product.updated'],
    });

    expect(updated.name).toBe('Updated Webhook');
    expect(updated.events).toEqual(['product.created', 'product.updated']);
  });

  it('should toggle webhook active status', async () => {
    const fixture = createWebhookFixture(tenantId, { active: true });
    const created = await pb.collection('webhooks').create(fixture);

    const deactivated = await pb.collection('webhooks').update(created.id, {
      active: false,
    });
    expect(deactivated.active).toBe(false);

    const reactivated = await pb.collection('webhooks').update(created.id, {
      active: true,
    });
    expect(reactivated.active).toBe(true);
  });

  it('should set webhook secret for HMAC signing', async () => {
    const secret = 'my-secret-key-12345';
    const fixture = createWebhookFixture(tenantId, { secret });
    const record = await pb.collection('webhooks').create(fixture);

    expect(record.secret).toBe(secret);
  });

  it('should delete a webhook', async () => {
    const fixture = createWebhookFixture(tenantId);
    const created = await pb.collection('webhooks').create(fixture);

    await pb.collection('webhooks').delete(created.id);

    try {
      await pb.collection('webhooks').getOne(created.id);
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('should list webhooks by tenant', async () => {
    const fixture1 = createWebhookFixture(tenantId, { name: 'Webhook A' });
    const fixture2 = createWebhookFixture(tenantId, { name: 'Webhook B' });

    await pb.collection('webhooks').create(fixture1);
    await pb.collection('webhooks').create(fixture2);

    const results = await pb.collection('webhooks').getList(1, 50, {
      filter: 'tenant = "' + tenantId + '"',
    });

    expect(results.items.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter active webhooks', async () => {
    const fixture1 = createWebhookFixture(tenantId, { active: true });
    const fixture2 = createWebhookFixture(tenantId, { active: false });

    await pb.collection('webhooks').create(fixture1);
    await pb.collection('webhooks').create(fixture2);

    const results = await pb.collection('webhooks').getList(1, 50, {
      filter: 'tenant = "' + tenantId + '" && active = true',
    });

    expect(results.items.every(w => w.active === true)).toBe(true);
  });

  it('should support multiple event types', async () => {
    const events = [
      'category.created',
      'category.updated',
      'category.deleted',
      'product.created',
      'product.updated',
      'product.deleted',
      'media.uploaded',
    ];
    const fixture = createWebhookFixture(tenantId, { events });
    const record = await pb.collection('webhooks').create(fixture);

    expect(record.events).toEqual(events);
    expect(record.events.length).toBe(7);
  });

  it('should store URL with proper format', async () => {
    const fixture = createWebhookFixture(tenantId, {
      url: 'https://example.com/webhook/stjorna',
    });
    const record = await pb.collection('webhooks').create(fixture);

    expect(record.url).toBe('https://example.com/webhook/stjorna');
  });
});