import { describe, it, expect, beforeAll } from 'vitest';
import { getPbUrl } from './setup.ts';
import { createAdminClient, createTenantUser } from './helpers/client.ts';
import { createTenantFixture } from './helpers/fixtures.ts';

// T-21: /api/openapi.json must describe the API that actually exists.
//   - every documented custom path is routed (no router-level 404),
//   - every documented collection field exists in the live schema,
//   - collection operation tiers match the live API rules,
//   - the visible tiers follow the caller's auth.

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

async function getSpec(token?: string): Promise<any> {
  const res = await fetch(getPbUrl() + '/api/openapi.json', {
    headers: token ? { Authorization: token } : {},
  });
  expect(res.status).toBe(200);
  return res.json();
}

function tagsOf(spec: any): Set<string> {
  const tags = new Set<string>();
  for (const item of Object.values<any>(spec.paths)) {
    for (const m of METHODS) for (const t of item[m]?.tags ?? []) tags.add(t);
  }
  return tags;
}

function expectedTier(rule: string | null): string {
  if (rule === null) return 'Admin';
  if (rule === '') return 'Public';
  return 'Private';
}

describe('OpenAPI spec accuracy', () => {
  let adminToken: string;
  let spec: any;
  let collections: any[];

  beforeAll(async () => {
    const pb = await createAdminClient();
    adminToken = pb.authStore.token;
    spec = await getSpec(adminToken);
    collections = await pb.collections.getFullList();
  });

  it('has a real version (not the old hard-coded 1.0.0)', () => {
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.version).toBeTruthy();
    expect(spec.info.version).not.toBe('1.0.0');
  });

  it('documents no /api/api/* double-prefixed paths', () => {
    for (const p of Object.keys(spec.paths)) expect(p.startsWith('/api/')).toBe(false);
  });

  it('every documented custom path is routed (no router-level 404)', async () => {
    const custom = Object.keys(spec.paths).filter((p) => !p.startsWith('/collections/'));
    expect(custom.length).toBeGreaterThan(10);
    for (const p of [
      '/stjorna/setup-status',
      '/stjorna/setup-bootstrap-superuser',
      '/stjorna/oidc-config',
      '/stjorna/users/search',
      '/stjorna/tenants/{id}/members',
      '/stjorna/api-keys',
      '/stjorna/api-keys/exchange',
      '/stjorna/stats',
      '/stjorna/export/{tenant}',
      '/stjorna/import/{tenant}',
    ]) {
      expect(custom, p).toContain(p);
    }

    for (const p of custom) {
      const url = getPbUrl() + '/api' + p.replace(/\{[^}]+\}/g, 'doesnotexist0001');
      for (const m of METHODS) {
        if (!spec.paths[p][m]) continue;
        const res = await fetch(url, {
          method: m.toUpperCase(),
          headers: { Authorization: adminToken, 'Content-Type': 'application/json' },
          // Empty / invalid input only: no route may succeed with side effects.
          body: m === 'get' || m === 'delete' ? undefined : '{}',
        });
        const text = await res.text();
        // PB's router-level "route not found" is a 404 with its generic
        // ApiError body ("…wasn't found.", or "File not found." from the
        // static-file fallback for GET). Handler-level 404s ("tenant not found", …) use
        // STJÓRNA's own envelope and are fine.
        const routeMissing = res.status === 404 && /wasn't found|File not found/.test(text) && !/"ok"|"success"/.test(text);
        expect(routeMissing, `${m.toUpperCase()} ${p} → ${res.status} ${text.slice(0, 120)}`).toBe(false);
      }
    }
  });

  it('documents exactly the non-system collections, with only real, non-hidden fields', () => {
    const real = collections.filter((c) => !c.system && !c.name.startsWith('_'));
    for (const c of real) {
      const list = spec.paths[`/collections/${c.name}/records`];
      expect(list, c.name).toBeDefined();
      const ref: string = list.post.requestBody.content['application/json'].schema.$ref;
      const schema = spec.components.schemas[ref.split('/').pop()!];
      expect(schema, c.name).toBeDefined();

      const fieldNames = new Set(c.fields.filter((f: any) => !f.hidden).map((f: any) => f.name));
      const hidden = c.fields.filter((f: any) => f.hidden).map((f: any) => f.name);
      for (const prop of Object.keys(schema.properties)) {
        expect(fieldNames.has(prop), `${c.name}.${prop} documented but not in schema`).toBe(true);
      }
      for (const f of fieldNames) {
        expect(schema.properties[f as string], `${c.name}.${f} missing from spec`).toBeDefined();
      }
      for (const h of hidden) expect(schema.properties[h]).toBeUndefined();
    }
    // No collection paths for system / internal collections.
    for (const p of Object.keys(spec.paths)) {
      const m = p.match(/^\/collections\/([^/]+)\//);
      if (!m) continue;
      expect(real.map((c) => c.name), p).toContain(m[1]);
    }
  });

  it('collection operation tiers follow the live API rules', () => {
    for (const c of collections.filter((x) => !x.system && !x.name.startsWith('_'))) {
      const list = spec.paths[`/collections/${c.name}/records`];
      const item = spec.paths[`/collections/${c.name}/records/{id}`];
      expect(list.get.tags).toEqual([expectedTier(c.listRule)]);
      expect(list.post.tags).toEqual([expectedTier(c.createRule)]);
      expect(item.get.tags).toEqual([expectedTier(c.viewRule)]);
      expect(item.patch.tags).toEqual([expectedTier(c.updateRule)]);
      expect(item.delete.tags).toEqual([expectedTier(c.deleteRule)]);
    }
  });

  it('known field drift is fixed (products/media/tenants)', () => {
    const s = spec.components.schemas;
    expect(s.Product.properties.sku).toBeUndefined();
    expect(s.Product.properties.active).toBeDefined();
    expect(s.Product.properties.sort_order).toBeDefined();
    expect(s.Product.properties.custom_fields).toBeDefined();
    expect(s.Media.properties.name).toBeUndefined();
    expect(s.Media.properties.file).toBeDefined();
    expect(s.Tenant.properties.description).toBeUndefined();
    expect(s.Tenant.properties.plan).toBeDefined();
    expect(s.Tenant.properties.theme_config).toBeDefined();
  });

  it('filters tiers by caller: anonymous → Public, user → Public+Private', async () => {
    const anon = await getSpec();
    expect(anon.tags.map((t: any) => t.name)).toEqual(['Public']);
    expect([...tagsOf(anon)].every((t) => t === 'Public')).toBe(true);
    expect(anon.paths['/stjorna/api-keys']).toBeUndefined();

    const pb = await createAdminClient();
    const tenant = await pb.collection('tenants').create(createTenantFixture());
    const user = await createTenantUser(tenant.id, 'viewer');
    const userSpec = await getSpec(user.pb.authStore.token);
    expect(userSpec.tags.map((t: any) => t.name)).toEqual(['Public', 'Private']);
    expect(tagsOf(userSpec).has('Admin')).toBe(false);
    // Admin-only routes and collections are absent for users.
    expect(userSpec.paths['/stjorna/api-keys']).toBeUndefined();
    expect(userSpec.paths['/collections/instance_settings/records']).toBeUndefined();
    expect(userSpec.components.schemas.InstanceSettings).toBeUndefined();
    expect(userSpec.paths['/stjorna/stats'].get.tags).toEqual(['Private']);
  });
});
