import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import PocketBase from 'pocketbase';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPbUrl } from './setup.ts';
import { createAdminClient, createTenantClient } from './helpers/client.ts';
import {
  createTenantFixture,
  createCategoryFixture,
  createProductFixture,
  createMediaFixture,
} from './helpers/fixtures.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'backup-v1-sample.json');

const arrayBufferToBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const fileToBase64 = (filePath: string): string =>
  arrayBufferToBase64(fs.readFileSync(filePath));

const fetchWithAuth = async (
  pb: PocketBase,
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  const res = await fetch(`${getPbUrl()}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: pb.authStore.token,
    },
  });
  return res;
};

describe('Backup Hook', () => {
  let pbAdmin: PocketBase;
  let tenantId: string;
  let categoryId: string;
  let productId: string;

  beforeAll(async () => {
    pbAdmin = await createAdminClient();
    const tenant = await pbAdmin.collection('tenants').create(
      createTenantFixture({ name: 'Backup Test Tenant', slug: 'backup-test' }),
    );
    tenantId = tenant.id;

    const category = await pbAdmin.collection('categories').create(
      createCategoryFixture(tenantId, { name: 'Electronics', slug: 'electronics' }),
    );
    categoryId = category.id;

    const product = await pbAdmin.collection('products').create(
      createProductFixture(tenantId, {
        name: 'Widget',
        slug: 'widget',
        category: categoryId,
        price: 19.99,
      }),
    );
    productId = product.id;
  });

  beforeEach(() => {
    pbAdmin.authStore.clear();
  });

  it('GET /api/backup/json returns full manifest for admin', async () => {
    const { email, password } = await import('./setup.ts').then((m) => m.getTestAdminCredentials());
    await pbAdmin.admins.authWithPassword(email, password);

    const res = await fetchWithAuth(pbAdmin, '/api/backup/json');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');

    const manifest = await res.json();
    expect(manifest.version).toBe('3.0.0');
    expect(manifest.kind).toBe('stjorna-backup');
    expect(manifest.collections).toBeDefined();
    expect(manifest.collections.tenants.length).toBeGreaterThan(0);
    expect(manifest.collections.categories.some((c: any) => c.id === categoryId)).toBe(true);
    expect(manifest.collections.products.some((p: any) => p.id === productId)).toBe(true);
  });

  it('GET /api/backup/json requires admin auth', async () => {
    const res = await fetch(`${getPbUrl()}/api/backup/json`);
    expect(res.status).toBe(401);
  });

  it('GET /api/backup/zip returns a valid ZIP', async () => {
    const { email, password } = await import('./setup.ts').then((m) => m.getTestAdminCredentials());
    await pbAdmin.admins.authWithPassword(email, password);

    const res = await fetchWithAuth(pbAdmin, '/api/backup/zip');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/zip');

    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
    expect(buf.length).toBeGreaterThan(100);
  });

  it('POST /api/backup/import v3 round-trips into a fresh tenant', async () => {
    const { email, password } = await import('./setup.ts').then((m) => m.getTestAdminCredentials());
    await pbAdmin.admins.authWithPassword(email, password);

    const exportRes = await fetchWithAuth(pbAdmin, '/api/backup/json');
    const manifest = await exportRes.json();
    const dataBase64 = arrayBufferToBase64(
      new TextEncoder().encode(JSON.stringify(manifest)).buffer as ArrayBuffer,
    );

    const targetTenant = await pbAdmin.collection('tenants').create(
      createTenantFixture({ name: 'Roundtrip Target', slug: 'roundtrip-target' }),
    );

    const importRes = await fetchWithAuth(pbAdmin, '/api/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant: targetTenant.id,
        source: 'v3',
        data_base64: dataBase64,
      }),
    });
    expect(importRes.status).toBe(200);
    const result = await importRes.json();
    expect(result.success).toBe(true);
    expect(result.stats.imported.categories).toBeGreaterThan(0);
    expect(result.stats.imported.products).toBeGreaterThan(0);

    const newCats = await pbAdmin.collection('categories').getList(1, 50, {
      filter: `tenant = "${targetTenant.id}"`,
    });
    expect(newCats.items.length).toBeGreaterThan(0);
    const slug = newCats.items.some((c) => c.slug === 'electronics');
    expect(slug).toBe(true);

    const newProds = await pbAdmin.collection('products').getList(1, 50, {
      filter: `tenant = "${targetTenant.id}"`,
    });
    expect(newProds.items.some((p) => p.slug === 'widget')).toBe(true);
  });

  it('GET /api/backup/zip embeds UTF-8 manifest correctly (regression)', async () => {
    const { email, password } = await import('./setup.ts').then((m) => m.getTestAdminCredentials());
    await pbAdmin.admins.authWithPassword(email, password);

    // Create a category with German umlauts + emoji
    const tenant = await pbAdmin.collection('tenants').create(
      createTenantFixture({ name: 'UTF8 ZIP', slug: 'utf8-zip' }),
    );
    await pbAdmin.collection('categories').create({
      tenant: tenant.id,
      name: 'Bänkli für Blumen',
      slug: 'bankli',
      description: 'Größe 42cm 🚀 Details',
      active: true,
    });

    // Download ZIP and read manifest.json
    const res = await fetchWithAuth(pbAdmin, '/api/backup/zip');
    expect(res.status).toBe(200);
    const buf = new Uint8Array(await res.arrayBuffer());

    // Find PK\x05\x06 (EOCD) in last 64KiB
    const eocdSig = [0x50, 0x4b, 0x05, 0x06];
    let eocdOff = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (buf[i] === eocdSig[0] && buf[i + 1] === eocdSig[1] &&
          buf[i + 2] === eocdSig[2] && buf[i + 3] === eocdSig[3]) {
        eocdOff = i;
        break;
      }
    }
    expect(eocdOff).toBeGreaterThan(-1);
    const cdOff = buf[eocdOff + 16] | (buf[eocdOff + 17] << 8) |
                  (buf[eocdOff + 18] << 16) | (buf[eocdOff + 19] << 24);
    const cdCount = buf[eocdOff + 10] | (buf[eocdOff + 11] << 8);
    expect(cdCount).toBeGreaterThan(0);

    // First CD entry — find manifest.json
    const nameLen = buf[cdOff + 28] | (buf[cdOff + 29] << 8);
    const extraLen = buf[cdOff + 30] | (buf[cdOff + 31] << 8);
    const commentLen = buf[cdOff + 32] | (buf[cdOff + 33] << 8);
    const localOff = buf[cdOff + 42] | (buf[cdOff + 43] << 8) |
                     (buf[cdOff + 44] << 16) | (buf[cdOff + 45] << 24);
    const nameBytes = buf.subarray(cdOff + 46, cdOff + 46 + nameLen);
    const name = new TextDecoder('utf-8').decode(nameBytes);
    expect(name).toBe('manifest.json');

    // Read local file header to get file size + name
    const localNameLen = buf[localOff + 26] | (buf[localOff + 27] << 8);
    const localExtraLen = buf[localOff + 28] | (buf[localOff + 29] << 8);
    const fileSize = buf[localOff + 18] | (buf[localOff + 19] << 8) |
                     (buf[localOff + 20] << 16) | (buf[localOff + 21] << 24);
    const fileData = buf.subarray(
      localOff + 30 + localNameLen + localExtraLen,
      localOff + 30 + localNameLen + localExtraLen + fileSize,
    );

    // The critical check: manifest.json is valid UTF-8
    const manifestText = new TextDecoder('utf-8').decode(fileData);
    const manifest = JSON.parse(manifestText);
    const cat = manifest.collections.categories.find((c: any) => c.slug === 'bankli');
    expect(cat).toBeDefined();
    expect(cat.name).toBe('Bänkli für Blumen');
    expect(cat.description).toBe('Größe 42cm 🚀 Details');
    expect(cat.name).not.toContain('Ã');
  });

  it('POST /api/backup/import v3 skips existing records (additive)', async () => {
    const { email, password } = await import('./setup.ts').then((m) => m.getTestAdminCredentials());
    await pbAdmin.admins.authWithPassword(email, password);

    const exportRes = await fetchWithAuth(pbAdmin, '/api/backup/json');
    const manifest = await exportRes.json();
    const dataBase64 = arrayBufferToBase64(
      new TextEncoder().encode(JSON.stringify(manifest)).buffer as ArrayBuffer,
    );

    const targetTenant = await pbAdmin.collection('tenants').create(
      createTenantFixture({ name: 'Skip Test', slug: 'skip-test' }),
    );

    const first = await fetchWithAuth(pbAdmin, '/api/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant: targetTenant.id, source: 'v3', data_base64: dataBase64 }),
    });
    const firstResult = await first.json();
    expect(firstResult.stats.imported.categories).toBeGreaterThan(0);

    const second = await fetchWithAuth(pbAdmin, '/api/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant: targetTenant.id, source: 'v3', data_base64: dataBase64 }),
    });
    const secondResult = await second.json();
    expect(secondResult.stats.imported.categories).toBe(0);
    expect(secondResult.stats.skipped.categories).toBeGreaterThan(0);
  });

  it('POST /api/backup/import v1 imports categories + products, drops users/services', async () => {
    const { email, password } = await import('./setup.ts').then((m) => m.getTestAdminCredentials());
    await pbAdmin.admins.authWithPassword(email, password);

    const dataBase64 = fileToBase64(FIXTURE_PATH);

    const targetTenant = await pbAdmin.collection('tenants').create(
      createTenantFixture({ name: 'V1 Import Target', slug: 'v1-import-target' }),
    );

    const res = await fetchWithAuth(pbAdmin, '/api/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant: targetTenant.id,
        source: 'v1',
        filename: 'backup-v1-sample.json',
        data_base64: dataBase64,
      }),
    });
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.success).toBe(true);
    expect(result.stats.imported.categories).toBe(3);
    expect(result.stats.imported.products).toBe(4);
    expect(result.stats.imported.media).toBe(0);
    expect(result.stats.warnings.some((w: string) => w.includes('v1 category images'))).toBe(true);

    const cats = await pbAdmin.collection('categories').getList(1, 50, {
      filter: `tenant = "${targetTenant.id}"`,
    });
    const slugs = cats.items.map((c) => c.slug);
    expect(slugs).toContain('hardware');
    expect(slugs).toContain('software');
    expect(slugs).toContain('specials');

    const prods = await pbAdmin.collection('products').getList(1, 50, {
      filter: `tenant = "${targetTenant.id}"`,
    });
    const hammer = prods.items.find((p) => p.slug === 'hammer');
    expect(hammer).toBeDefined();
    const hardwareCat = cats.items.find((c) => c.slug === 'hardware');
    expect(hammer.category).toBe(hardwareCat.id);
  });

  it('POST /api/backup/import preserves UTF-8 characters in v1 data (regression)', async () => {
    const { email, password } = await import('./setup.ts').then((m) => m.getTestAdminCredentials());
    await pbAdmin.admins.authWithPassword(email, password);

    // Build a v1-shaped JSON with German umlauts and an emoji, then
    // base64-encode the raw UTF-8 bytes (mimicking a real export from
    // a Swiss STJÓRNA instance).
    const v1Json = JSON.stringify({
      categories: [
        {
          _id: 'umlaut-cat',
          name: 'Bänkli für Blumen oder Snacks',
          description: 'Größe 42cm, schöne 🚀 Details',
          active: true,
        },
      ],
      products: [
        {
          _id: 'umlaut-prod',
          name: 'Über-mäßiges Produkt',
          category: 'umlaut-cat',
          price: 12.5,
          description: 'Bäckerei Müller',
          active: true,
        },
      ],
    }, null, 2);
    const utf8Bytes = new TextEncoder().encode(v1Json);
    const data_base64 = btoa(String.fromCharCode(...utf8Bytes));

    const targetTenant = await pbAdmin.collection('tenants').create(
      createTenantFixture({ name: 'UTF8 Target', slug: 'utf8-target' }),
    );

    const res = await fetchWithAuth(pbAdmin, '/api/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant: targetTenant.id,
        source: 'v1',
        filename: 'umlaut.json',
        data_base64,
      }),
    });
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.success).toBe(true);
    expect(result.stats.imported.categories).toBe(1);
    expect(result.stats.imported.products).toBe(1);

    const cats = await pbAdmin.collection('categories').getList(1, 50, {
      filter: `tenant = "${targetTenant.id}"`,
    });
    const cat = cats.items[0];
    expect(cat).toBeDefined();
    // The critical check: NO mojibake (Ã¤, Ã¼, etc.) — bytes decoded as
    // proper UTF-8 code points all the way through to PB.
    expect(cat.name).toBe('Bänkli für Blumen oder Snacks');
    expect(cat.description).toBe('Größe 42cm, schöne 🚀 Details');
    expect(cat.name).not.toContain('Ã');
    expect(cat.description).not.toContain('Ã');

    const prods = await pbAdmin.collection('products').getList(1, 50, {
      filter: `tenant = "${targetTenant.id}"`,
    });
    const prod = prods.items[0];
    expect(prod).toBeDefined();
    expect(prod.name).toBe('Über-mäßiges Produkt');
    expect(prod.description).toBe('Bäckerei Müller');
  });

  it('POST /api/backup/import rejects missing tenant', async () => {
    const { email, password } = await import('./setup.ts').then((m) => m.getTestAdminCredentials());
    await pbAdmin.admins.authWithPassword(email, password);

    const res = await fetchWithAuth(pbAdmin, '/api/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'v1', data_base64: 'e30=' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/backup/import rejects non-admin', async () => {
    const tenantPb = await createTenantClient(tenantId);
    const res = await fetchWithAuth(tenantPb, '/api/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant: tenantId, source: 'v1', data_base64: 'e30=' }),
    });
    expect(res.status).toBe(403);
  });
});
