import { describe, it, expect, beforeAll } from 'vitest';
import { getPb } from '../setup.ts';
import { createAdminClient } from '../helpers/client.ts';
import { createTenantFixture, createMediaFixture } from '../helpers/fixtures.ts';

describe('Media Collection', () => {
  let pb: ReturnType<typeof getPb>;
  let tenantId: string;

  beforeAll(async () => {
    pb = await createAdminClient();
    const tenant = await pb.collection('tenants').create(createTenantFixture());
    tenantId = tenant.id;
  });

  it('should create a media record with tenant', async () => {
    const fixture = createMediaFixture(tenantId);
    const record = await pb.collection('media').create(fixture);

    expect(record.id).toBeDefined();
    expect(record.tenant).toBe(tenantId);
    expect(record.filename).toBe(fixture.filename);
  });

  it('should create media with full metadata', async () => {
    const fixture = createMediaFixture(tenantId, {
      original_name: 'My Vacation Photo.jpg',
      mime_type: 'image/jpeg',
      size: 2048576,
      width: 3840,
      height: 2160,
    });
    const record = await pb.collection('media').create(fixture);

    expect(record.original_name).toBe('My Vacation Photo.jpg');
    expect(record.mime_type).toBe('image/jpeg');
    expect(record.size).toBe(2048576);
    expect(record.width).toBe(3840);
    expect(record.height).toBe(2160);
  });

  it('should create media with S3 metadata', async () => {
    const fixture = createMediaFixture(tenantId, {
      s3_key: 'tenants/' + tenantId + '/uploads/original/media-id/photo.jpg',
      s3_url: 'https://bucket.s3.region.amazonaws.com/tenants/' + tenantId + '/uploads/original/media-id/photo.jpg',
    });
    const record = await pb.collection('media').create(fixture);

    expect(record.s3_key).toBe('tenants/' + tenantId + '/uploads/original/media-id/photo.jpg');
    expect(record.s3_url).toBeDefined();
  });

  it('should read a media record by id', async () => {
    const fixture = createMediaFixture(tenantId);
    const created = await pb.collection('media').create(fixture);

    const read = await pb.collection('media').getOne(created.id);
    expect(read.id).toBe(created.id);
    expect(read.filename).toBe(fixture.filename);
  });

  it('should update a media record', async () => {
    const fixture = createMediaFixture(tenantId);
    const created = await pb.collection('media').create(fixture);

    const updated = await pb.collection('media').update(created.id, {
      filename: 'updated-filename.jpg',
    });

    expect(updated.filename).toBe('updated-filename.jpg');
    expect(updated.id).toBe(created.id);
  });

  it('should update s3_url after processing', async () => {
    const fixture = createMediaFixture(tenantId, { s3_key: 'initial-key.jpg' });
    const created = await pb.collection('media').create(fixture);

    const thumbnailUrl = 'https://bucket.s3.region.amazonaws.com/thumbnails/' + created.id + '.webp';
    const updated = await pb.collection('media').update(created.id, {
      thumbnail_url: thumbnailUrl,
    });

    expect(updated.thumbnail_url).toBe(thumbnailUrl);
  });

  it('should delete a media record', async () => {
    const fixture = createMediaFixture(tenantId);
    const created = await pb.collection('media').create(fixture);

    await pb.collection('media').delete(created.id);

    try {
      await pb.collection('media').getOne(created.id);
      expect.fail('Should have thrown 404');
    } catch (error: any) {
      expect(error.status).toBe(404);
    }
  });

  it('should list media by tenant', async () => {
    const fixture1 = createMediaFixture(tenantId, { filename: 'media-a.jpg' });
    const fixture2 = createMediaFixture(tenantId, { filename: 'media-b.jpg' });

    await pb.collection('media').create(fixture1);
    await pb.collection('media').create(fixture2);

    const results = await pb.collection('media').getList(1, 50, {
      filter: 'tenant = "' + tenantId + '"',
    });

    expect(results.items.length).toBeGreaterThanOrEqual(2);
  });

  it('should increment usage_count', async () => {
    const fixture = createMediaFixture(tenantId, { usage_count: 0 });
    const created = await pb.collection('media').create(fixture);

    const updated = await pb.collection('media').update(created.id, {
      usage_count: created.usage_count + 1,
    });

    expect(updated.usage_count).toBe(1);
  });

  it('should filter by mime_type', async () => {
    const fixture1 = createMediaFixture(tenantId, { mime_type: 'image/jpeg' });
    const fixture2 = createMediaFixture(tenantId, { mime_type: 'image/png' });

    await pb.collection('media').create(fixture1);
    await pb.collection('media').create(fixture2);

    const results = await pb.collection('media').getList(1, 50, {
      filter: 'tenant = "' + tenantId + '" && mime_type = "image/jpeg"',
    });

    expect(results.items.every(m => m.mime_type === 'image/jpeg')).toBe(true);
  });

  it('should set createdUser field', async () => {
    const admin = pb.authStore.model;
    const fixture = createMediaFixture(tenantId);
    const record = await pb.collection('media').create(fixture, {
      expand: 'createdUser',
    } as any);

    expect(record.createdUser).toBeDefined();
  });
});