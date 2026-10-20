import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';

// T-22 acceptance: migration 1780001000_schema_cleanup.js on an instance
// that already holds data. Self-contained, like setup-bootstrap-fresh:
//
//   1. start a throwaway container on a named volume with the T-22
//      migration file removed (= the schema before T-22)
//   2. seed legacy-shaped data: slugs that violate the new pattern and
//      collide once normalised, text api_keys.tenant (valid + orphaned),
//      instance_settings.instance_name
//   3. restart on the same volume with the full image → migration runs
//   4. assert the resulting schema + data, and that the API-key hook
//      still issues / lists / exchanges keys with the relation field

const PB_IMAGE = process.env.PB_IMAGE || 'localhost/stjorna-pocketbase:test';
const HOST_PORT = 18096;
const PB_URL = `http://127.0.0.1:${HOST_PORT}`;
const CONTAINER_NAME = `stjorna-t22-schema-${process.pid}`;
const VOLUME = `stjorna-t22-schema-${process.pid}`;
const ADMIN_EMAIL = 'admin@t22.stjorna.local';
const ADMIN_PASSWORD = 'T22SchemaCleanup123';
const MIGRATION = '/app/pb_migrations/1780001000_schema_cleanup.js';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CLI = (() => {
  try {
    execSync('command -v docker', { stdio: 'ignore' });
    return 'docker';
  } catch {
    return 'podman';
  }
})();

const sh = (cmd: string) => execSync(cmd, { stdio: 'ignore' });
const containerLogs = (): string => {
  try {
    return execSync(`${CLI} logs ${CONTAINER_NAME} 2>&1`, { encoding: 'utf8' });
  } catch (e: any) {
    return String(e?.stdout || '');
  }
};

const startContainer = async (withoutMigration: boolean) => {
  try { sh(`${CLI} rm -f ${CONTAINER_NAME}`); } catch {}
  const env = `-e PB_SUPERUSER_EMAIL=${ADMIN_EMAIL} -e PB_SUPERUSER_PASSWORD=${ADMIN_PASSWORD}`;
  const base = `${CLI} run -d --name ${CONTAINER_NAME} -p 127.0.0.1:${HOST_PORT}:8090 -v ${VOLUME}:/app/pb_data ${env}`;
  sh(
    withoutMigration
      ? `${base} --entrypoint sh ${PB_IMAGE} -c "rm -f ${MIGRATION} && exec /app/entrypoint.sh"`
      : `${base} ${PB_IMAGE}`
  );
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${PB_URL}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`PB container not healthy after 120s\n${containerLogs().slice(-2000)}`);
};

let token = '';
const api = async (method: string, path: string, body?: unknown, auth: string | null = token) => {
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, body: json, text };
};
const create = async (col: string, data: Record<string, unknown>) => {
  const r = await api('POST', `/api/collections/${col}/records`, data);
  if (r.status !== 200) throw new Error(`create ${col} failed: ${r.status} ${r.text}`);
  return r.body;
};
const login = async () => {
  const r = await api('POST', '/api/collections/_superusers/auth-with-password',
    { identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }, null);
  if (r.status !== 200) throw new Error(`superuser login failed: ${r.status} ${r.text}`);
  token = r.body.token;
};
const collection = async (name: string) => (await api('GET', `/api/collections/${name}`)).body;
const field = (col: any, name: string) => col.fields.find((f: any) => f.name === name);

describe('Schema cleanup migration (T-22, upgrade path)', () => {
  const seeded: Record<string, string> = {};

  beforeAll(async () => {
    try { sh(`${CLI} volume rm -f ${VOLUME}`); } catch {}
    sh(`${CLI} volume create ${VOLUME}`);

    // ---- 1. pre-T-22 schema ----
    await startContainer(true);
    await login();
    const tenantsCol = await collection('tenants');
    if (!field(tenantsCol, 'users')) throw new Error('pre-migration schema unexpectedly lacks tenants.users');

    // ---- 2. seed legacy data ----
    const tA = await create('tenants', { name: 'T22 A', slug: 't22-a', plan: 'free' });
    const tB = await create('tenants', { name: 'T22 B', slug: 't22-b', plan: 'free' });
    seeded.tenantA = tA.id;
    seeded.tenantB = tB.id;
    // "Shoes" and "shoes" are distinct under the old UNIQUE(tenant, slug)
    // index but collide once normalised → "Shoes" gets "-<id>".
    seeded.catUpper = (await create('categories', { tenant: tA.id, name: 'Shoes', slug: 'Shoes' })).id;
    seeded.catLower = (await create('categories', { tenant: tA.id, name: 'shoes', slug: 'shoes' })).id;
    seeded.catOtherTenant = (await create('categories', { tenant: tB.id, name: 'Shoes', slug: 'shoes' })).id;
    seeded.prodBad = (await create('products', { tenant: tA.id, name: 'Red Hat', slug: 'Red Hat!' })).id;
    seeded.prodGood = (await create('products', { tenant: tA.id, name: 'Blue', slug: 'blue-hat' })).id;
    seeded.media = (await create('media', { tenant: tA.id, filename: 'a.png', s3_key: 'legacy/a.png' })).id;
    seeded.keyValid = (await create('api_keys', {
      tenant: tA.id, name: 'legacy-valid', prefix: 'legacy_valid', key_hash: 'x', revoked: false,
    })).id;
    seeded.keyOrphan = (await create('api_keys', {
      tenant: 'ghosttenant0000', name: 'legacy-orphan', prefix: 'legacy_orphan', key_hash: 'x', revoked: false,
    })).id;
    await create('instance_settings', { setup_done: true, instance_name: 'T22 Instance', storage_type: 'local' });

    // ---- 3. restart with the migration ----
    sh(`${CLI} rm -f ${CONTAINER_NAME}`);
    await startContainer(false);
    await login();
  }, 300_000);

  afterAll(() => {
    try { sh(`${CLI} rm -f ${CONTAINER_NAME}`); } catch {}
    try { sh(`${CLI} volume rm -f ${VOLUME}`); } catch {}
  });

  it('the migration applied without errors', () => {
    const logs = containerLogs();
    expect(logs).not.toMatch(/failed to apply migration|migration .* failed|Error: .*1780001000/i);
    expect(logs).toMatch(/normalised\/deduplicated/);
  });

  it('drops tenants.users and the legacy media storage columns, keeps media.filename', async () => {
    expect(field(await collection('tenants'), 'users')).toBeUndefined();
    const media = await collection('media');
    for (const n of ['s3_key', 's3_url', 'thumbnail_url', 'usage_count']) {
      expect(field(media, n), n).toBeUndefined();
    }
    expect(field(media, 'filename')).toBeDefined();
    const row = (await api('GET', `/api/collections/media/records/${seeded.media}`)).body;
    expect(row.filename).toBe('a.png');
    expect(row.s3_key).toBeUndefined();
  });

  it('drops the instance_settings copies of PB settings and syncs appName', async () => {
    const col = await collection('instance_settings');
    for (const n of ['instance_name', 'instance_url', 'storage_type', 's3_bucket', 's3_region', 's3_endpoint', 's3_force_path_style']) {
      expect(field(col, n), n).toBeUndefined();
    }
    expect(field(col, 'setup_done')).toBeDefined();
    expect(field(col, 'oidc_group_claim')).toBeDefined();
    const settings = (await api('GET', '/api/settings')).body;
    expect(settings.meta.appName).toBe('T22 Instance');
  });

  it('api_keys.tenant is a relation; values preserved, orphans revoked', async () => {
    const col = await collection('api_keys');
    const t = field(col, 'tenant');
    expect(t.type).toBe('relation');
    expect(t.maxSelect).toBe(1);
    expect(t.collectionId).toBe((await collection('tenants')).id);
    expect(field(col, 'tenant_rel')).toBeUndefined();

    const valid = (await api('GET', `/api/collections/api_keys/records/${seeded.keyValid}`)).body;
    expect(valid.tenant).toBe(seeded.tenantA);
    expect(valid.revoked).toBe(false);
    const orphan = (await api('GET', `/api/collections/api_keys/records/${seeded.keyOrphan}`)).body;
    expect(orphan.tenant).toBe('');
    expect(orphan.revoked).toBe(true);

    // A non-existent tenant id is rejected now.
    const bad = await api('POST', '/api/collections/api_keys/records', {
      tenant: 'ghosttenant0000', name: 'x', prefix: 'x_bad', key_hash: 'x',
    });
    expect(bad.status).toBe(400);
  });

  it('the API-key hook still issues, lists and exchanges keys', async () => {
    const issued = await api('POST', '/api/stjorna/api-keys', { tenant: seeded.tenantA, name: 't22' });
    expect(issued.status, issued.text).toBe(200);
    const key = issued.body.apiKey;
    expect(key.tenant).toBe(seeded.tenantA);

    const list = await api('GET', `/api/stjorna/api-keys?tenant=${seeded.tenantA}`);
    expect(list.status).toBe(200);
    const mine = list.body.items.find((i: any) => i.id === key.id);
    expect(mine?.tenant).toBe(seeded.tenantA);

    const plaintext = issued.body.plaintext;
    expect(typeof plaintext).toBe('string');
    const ex = await fetch(`${PB_URL}/api/stjorna/api-keys/exchange`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${plaintext}` },
    });
    expect(ex.status).toBe(200);
    const exBody = await ex.json();
    expect(exBody.tenant).toBe(seeded.tenantA);
  });

  it('existing slugs were normalised and de-duplicated per tenant', async () => {
    const get = async (col: string, id: string) =>
      (await api('GET', `/api/collections/${col}/records/${id}`)).body.slug as string;
    const upper = await get('categories', seeded.catUpper);
    const lower = await get('categories', seeded.catLower);
    // The already-valid slug is kept; the one that normalises onto it
    // gets "-<id>".
    expect(lower).toBe('shoes');
    expect(upper).toBe(`shoes-${seeded.catUpper.toLowerCase()}`);
    expect(await get('categories', seeded.catOtherTenant)).toBe('shoes');
    expect(await get('products', seeded.prodBad)).toBe('red-hat');
    expect(await get('products', seeded.prodGood)).toBe('blue-hat');
    for (const s of [upper, lower]) expect(s).toMatch(SLUG_RE);
  });

  it('categories/products carry the slug pattern and a managed UNIQUE(tenant, slug) index', async () => {
    for (const name of ['categories', 'products']) {
      const col = await collection(name);
      expect(field(col, 'slug').pattern).toBe(SLUG_RE.source);
      const idx = (col.indexes as string[]).find((s) => s.includes(`idx_${name}_tenant_slug`));
      expect(idx, `${name} index`).toMatch(/UNIQUE/i);
    }
  });

  it('rejects a duplicate (tenant, slug) but allows the same slug in another tenant', async () => {
    for (const name of ['categories', 'products']) {
      const dup = await api('POST', `/api/collections/${name}/records`,
        { tenant: seeded.tenantA, name: 'Dup', slug: name === 'categories' ? 'shoes' : 'blue-hat' });
      expect(dup.status, `${name} duplicate`).toBe(400);
      const other = await api('POST', `/api/collections/${name}/records`,
        { tenant: seeded.tenantB, name: 'Dup', slug: 'only-in-b' });
      expect(other.status, `${name} other tenant: ${other.text}`).toBe(200);
    }
  });

  it('rejects slugs that do not match the UI slug format', async () => {
    for (const name of ['categories', 'products']) {
      for (const slug of ['Upper', 'has space', 'trailing-', '-leading', 'double--dash', 'ümlaut', 'under_score']) {
        const r = await api('POST', `/api/collections/${name}/records`, { tenant: seeded.tenantA, name: 'X', slug });
        expect(r.status, `${name} slug=${JSON.stringify(slug)}`).toBe(400);
        expect(r.body?.data?.slug?.code).toBe('validation_invalid_format');
      }
      const ok = await api('POST', `/api/collections/${name}/records`, { tenant: seeded.tenantA, name: 'X', slug: 'abc-123-x' });
      expect(ok.status, ok.text).toBe(200);
    }
  });
});
