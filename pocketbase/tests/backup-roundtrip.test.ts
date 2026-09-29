import { describe, it, expect, beforeAll } from 'vitest';
import { getPbUrl } from '../setup.ts';
import { createAdminClient, createTenantUser } from './helpers/client.ts';
import { createTenantFixture } from './helpers/fixtures.ts';

// 1x1 transparent PNG.
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function fetchWithAuth(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: 'Bearer ' + token,
    },
  });
}

async function exportTenant(tenantId: string, token: string): Promise<Uint8Array> {
  const res = await fetchWithAuth(`${getPbUrl()}/api/stjorna/export/${tenantId}`, token);
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toBe('application/zip');
  return new Uint8Array(await res.arrayBuffer());
}

async function importTenant(tenantId: string, token: string, bytes: Uint8Array, source = 'v3'): Promise<any> {
  const contentType = source === 'v1' ? 'application/json' : 'application/zip';
  const res = await fetchWithAuth(`${getPbUrl()}/api/stjorna/import/${tenantId}?source=${source}`, token, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: bytes,
  });
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { error: text }; }
  if (res.status >= 500) {
    console.log('[importTenant] status', res.status, 'body', JSON.stringify(body).substring(0, 2000));
  }
  return { status: res.status, body };
}

describe('T-11: tenant backup round-trip', () => {
  let adminToken: string;
  let sourceTenantId: string;
  let sourceCategoryId: string;
  let sourceMediaId: string;
  let sourceProductId: string;
  let sourceCategorySlug: string;
  let sourceProductSlug: string;
  let targetTenantId: string;
  let exportedBytes: Uint8Array;

  beforeAll(async () => {
    const adminPb = await createAdminClient();
    adminToken = adminPb.authStore.token;

    const sourceTenant = await adminPb.collection('tenants').create(
      createTenantFixture({ name: 'Roundtrip Source', slug: 'roundtrip-source-' + Date.now() }),
    );
    sourceTenantId = sourceTenant.id;

    const targetTenant = await adminPb.collection('tenants').create(
      createTenantFixture({ name: 'Roundtrip Target', slug: 'roundtrip-target-' + Date.now() }),
    );
    targetTenantId = targetTenant.id;

    const category = await adminPb.collection('categories').create({
      tenant: sourceTenantId,
      name: 'Roundtrip Category',
      slug: 'roundtrip-category',
      description: 'Bänkli für Blumen 🚀',
      active: true,
      sort_order: 1,
    });
    sourceCategoryId = category.id;
    sourceCategorySlug = category.slug;

    const mediaForm = new FormData();
    mediaForm.append('tenant', sourceTenantId);
    mediaForm.append('filename', 'roundtrip.png');
    mediaForm.append('original_name', 'Roundtrip.png');
    mediaForm.append('mime_type', 'image/png');
    mediaForm.append('file', new Blob([TEST_PNG], { type: 'image/png' }), 'roundtrip.png');
    const media = await adminPb.collection('media').create(mediaForm);
    sourceMediaId = media.id;

    await adminPb.collection('categories').update(sourceCategoryId, { media: sourceMediaId });

    const product = await adminPb.collection('products').create({
      tenant: sourceTenantId,
      name: 'Roundtrip Product',
      slug: 'roundtrip-product',
      category: sourceCategoryId,
      price: 42.5,
      description: 'Über-mäßiges Produkt',
      active: true,
      sort_order: 2,
      media: [sourceMediaId],
      custom_fields: { color: 'red', list: [1, 2, 3], meta: { ok: true } },
    });
    sourceProductId = product.id;
    sourceProductSlug = product.slug;
  });

  it('exports source tenant as a ZIP with manifest and media', async () => {
    exportedBytes = await exportTenant(sourceTenantId, adminToken);
    expect(exportedBytes[0]).toBe(0x50);
    expect(exportedBytes[1]).toBe(0x4b);
    expect(exportedBytes[2]).toBe(0x03);
    expect(exportedBytes[3]).toBe(0x04);
    // Manifest entry should be present in the STORE-only ZIP.
    const asString = new TextDecoder('utf-8').decode(exportedBytes);
    expect(asString).toContain('manifest.json');
    expect(asString).toContain('roundtrip-product');
  });

  it('imports into a new tenant and remaps relations', async () => {
    const { status, body } = await importTenant(targetTenantId, adminToken, exportedBytes, 'v3');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.stats.created.categories).toBe(1);
    expect(body.stats.created.products).toBe(1);
    expect(body.stats.created.media).toBe(1);

    const adminPb = await createAdminClient();

    const cats = await adminPb.collection('categories').getList(1, 50, {
      filter: `tenant = "${targetTenantId}"`,
    });
    expect(cats.items.length).toBe(1);
    const targetCat = cats.items[0];
    expect(targetCat.slug).toBe(sourceCategorySlug);
    expect(targetCat.description).toBe('Bänkli für Blumen 🚀');

    const prods = await adminPb.collection('products').getList(1, 50, {
      filter: `tenant = "${targetTenantId}"`,
    });
    expect(prods.items.length).toBe(1);
    const targetProd = prods.items[0];
    expect(targetProd.slug).toBe(sourceProductSlug);
    expect(targetProd.price).toBe(42.5);
    expect(targetProd.description).toBe('Über-mäßiges Produkt');
    expect(targetProd.category).toBe(targetCat.id);
    expect(Array.isArray(targetProd.media)).toBe(true);

    const medias = await adminPb.collection('media').getList(1, 50, {
      filter: `tenant = "${targetTenantId}"`,
    });
    expect(medias.items.length).toBe(1);
    const targetMedia = medias.items[0];
    expect(targetProd.media).toContain(targetMedia.id);
    expect(targetCat.media).toBe(targetMedia.id);
    expect(targetMedia.filename).toBe('roundtrip.png');
    expect(targetMedia.size).toBe(TEST_PNG.length);

    // custom_fields round-trip.
    expect(targetProd.custom_fields).toEqual({ color: 'red', list: [1, 2, 3], meta: { ok: true } });

    // File bytes match.
    const fileToken = await adminPb.files.getToken();
    const url = adminPb.files.getURL(targetMedia, targetMedia.file, { token: fileToken });
    const fileRes = await fetch(url);
    expect(fileRes.status).toBe(200);
    const downloaded = Buffer.from(await fileRes.arrayBuffer());
    expect(downloaded.toString('base64')).toBe(TEST_PNG.toString('base64'));
  });

  it('is idempotent on re-import (updates instead of creates)', async () => {
    const { status, body } = await importTenant(targetTenantId, adminToken, exportedBytes, 'v3');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.stats.updated.categories).toBe(1);
    expect(body.stats.updated.products).toBe(1);
    expect(body.stats.updated.media).toBe(1);
    expect(body.stats.created.categories).toBe(0);
    expect(body.stats.created.products).toBe(0);
    expect(body.stats.created.media).toBe(0);
  });

  it('allows export from a tenant member viewer', async () => {
    const { pb: viewerPb } = await createTenantUser(sourceTenantId, 'viewer');
    const res = await fetchWithAuth(`${getPbUrl()}/api/stjorna/export/${sourceTenantId}`, viewerPb.authStore.token);
    expect(res.status).toBe(200);
  });

  it('rejects export from a non-member tenant user', async () => {
    const otherTenant = await (await createAdminClient()).collection('tenants').create(
      createTenantFixture({ name: 'Other Export', slug: 'other-export-' + Date.now() }),
    );
    const { pb: viewerPb } = await createTenantUser(otherTenant.id, 'viewer');
    const res = await fetchWithAuth(`${getPbUrl()}/api/stjorna/export/${sourceTenantId}`, viewerPb.authStore.token);
    expect(res.status).toBe(403);
  });

  it('rejects import from a non-admin tenant user', async () => {
    const { pb: viewerPb } = await createTenantUser(targetTenantId, 'viewer');
    const { status } = await importTenant(targetTenantId, viewerPb.authStore.token, exportedBytes, 'v3');
    expect(status).toBe(403);
  });

  it('imports old v1 JSON format', async () => {
    const adminPb = await createAdminClient();
    const v1Tenant = await adminPb.collection('tenants').create(
      createTenantFixture({ name: 'V1 Target', slug: 'v1-target-' + Date.now() }),
    );
    const v1Json = JSON.stringify({
      categories: [
        { _id: 'cat-old-1', name: 'Hardware', description: 'Tools', active: true },
        { _id: 'cat-old-2', name: 'Software', active: true },
      ],
      products: [
        { _id: 'prod-old-1', name: 'Hammer', category: 'cat-old-1', price: 12.5, description: 'Steel', active: true },
      ],
    });
    const bytes = new TextEncoder().encode(v1Json);
    const { status, body } = await importTenant(v1Tenant.id, adminToken, new Uint8Array(bytes.buffer), 'v1');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.stats.created.categories).toBe(2);
    expect(body.stats.created.products).toBe(1);

    const prods = await adminPb.collection('products').getList(1, 50, {
      filter: `tenant = "${v1Tenant.id}"`,
    });
    const hammer = prods.items.find((p: any) => p.slug === 'hammer');
    expect(hammer).toBeDefined();
    const cats = await adminPb.collection('categories').getList(1, 50, {
      filter: `tenant = "${v1Tenant.id}"`,
    });
    const hardware = cats.items.find((c: any) => c.slug === 'hardware');
    expect(hardware).toBeDefined();
    expect(hammer.category).toBe(hardware.id);
  });
});
