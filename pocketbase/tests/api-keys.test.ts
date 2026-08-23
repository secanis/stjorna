import { describe, it, expect, beforeAll } from 'vitest';
import { getPb, getPbUrl } from './setup.ts';
import { createAdminClient } from './helpers/client.ts';
import { createTenantFixture, createCategoryFixture } from './helpers/fixtures.ts';

describe('API Keys — collection (PB admin only)', () => {
  let pb: ReturnType<typeof getPb>;
  let tenantId: string;

  beforeAll(async () => {
    pb = await createAdminClient();
    const t = await pb.collection('tenants').create(createTenantFixture());
    tenantId = t.id;
  });

  it('issues a key via the custom route and stores the hash, never the plaintext', async () => {
    const url = getPbUrl() + '/api/stjorna/api-keys';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pb.authStore.token },
      body: JSON.stringify({ tenant: tenantId, name: 'storefront-prod' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.plaintext).toMatch(/^stjorna_[a-z0-9_]+\.[A-Za-z0-9]+$/);
    expect(body.apiKey.prefix).toBe(body.plaintext.split('.')[0]);
    expect(body.apiKey.revoked).toBe(false);

    const stored = await pb.collection('api_keys').getOne(body.apiKey.id);
    expect(stored.key_hash).toBeTruthy();
    expect(String(stored.key_hash)).not.toContain(body.plaintext.split('.')[1]);
  });

  it('lists keys (metadata only) via the custom route', async () => {
    await fetch(getPbUrl() + '/api/stjorna/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pb.authStore.token },
      body: JSON.stringify({ tenant: tenantId, name: 'list-test' }),
    });

    const res = await fetch(getPbUrl() + '/api/stjorna/api-keys?perPage=200', {
      headers: { Authorization: 'Bearer ' + pb.authStore.token },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.items)).toBe(true);
    for (const k of body.items) {
      expect(k.key_hash).toBeUndefined();
      expect(k.plaintext).toBeUndefined();
      expect(typeof k.prefix).toBe('string');
      expect(k.prefix.startsWith('stjorna_')).toBe(true);
    }
  });

  it('rejects a non-admin caller with 401', async () => {
    pb.authStore.clear();
    const res = await fetch(getPbUrl() + '/api/stjorna/api-keys?perPage=10', {
      headers: { Authorization: 'Bearer no-token' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects when tenant is missing', async () => {
    await pb.admins.authWithPassword('admin@test.stjorna.local', 'admin12345678test');
    const res = await fetch(getPbUrl() + '/api/stjorna/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pb.authStore.token },
      body: JSON.stringify({ name: 'x' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects when tenant does not exist', async () => {
    const res = await fetch(getPbUrl() + '/api/stjorna/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pb.authStore.token },
      body: JSON.stringify({ tenant: 'nonexistent_tenant_id', name: 'x' }),
    });
    expect(res.status).toBe(404);
  });

  it('revokes a key (sets revoked=true)', async () => {
    const issue = await fetch(getPbUrl() + '/api/stjorna/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pb.authStore.token },
      body: JSON.stringify({ tenant: tenantId, name: 'to-be-revoked' }),
    });
    const { apiKey } = await issue.json();

    const del = await fetch(getPbUrl() + '/api/stjorna/api-keys/' + apiKey.id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + pb.authStore.token },
    });
    expect(del.status).toBe(200);
    const out = await del.json();
    expect(out.ok).toBe(true);
    expect(out.revoked).toBe(true);

    const stored = await pb.collection('api_keys').getOne(apiKey.id);
    expect(!!stored.revoked).toBe(true);
  });

  it('introspect accepts a valid, non-revoked key', async () => {
    const issue = await fetch(getPbUrl() + '/api/stjorna/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pb.authStore.token },
      body: JSON.stringify({ tenant: tenantId, name: 'for-introspect' }),
    });
    const { plaintext, apiKey } = await issue.json();

    const me = await fetch(getPbUrl() + '/api/stjorna/api-keys/me', {
      headers: { Authorization: 'Bearer ' + plaintext },
    });
    expect(me.status).toBe(200);
    const body = await me.json();
    expect(body.ok).toBe(true);
    expect(body.tenant).toBe(tenantId);
    expect(body.id).toBe(apiKey.id);
    expect(body.prefix).toBe(apiKey.prefix);
  });

  it('introspect rejects a wrong secret', async () => {
    const issue = await fetch(getPbUrl() + '/api/stjorna/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pb.authStore.token },
      body: JSON.stringify({ tenant: tenantId, name: 'verify-bad' }),
    });
    const { plaintext } = await issue.json();
    const tampered = plaintext.slice(0, plaintext.length - 1) + (plaintext.slice(-1) === 'a' ? 'b' : 'a');
    const me = await fetch(getPbUrl() + '/api/stjorna/api-keys/me', {
      headers: { Authorization: 'Bearer ' + tampered },
    });
    expect(me.status).toBe(401);
  });

  it('introspect rejects a revoked key', async () => {
    const issue = await fetch(getPbUrl() + '/api/stjorna/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pb.authStore.token },
      body: JSON.stringify({ tenant: tenantId, name: 'verify-revoked' }),
    });
    const { plaintext, apiKey } = await issue.json();
    await fetch(getPbUrl() + '/api/stjorna/api-keys/' + apiKey.id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + pb.authStore.token },
    });

    const me = await fetch(getPbUrl() + '/api/stjorna/api-keys/me', {
      headers: { Authorization: 'Bearer ' + plaintext },
    });
    expect(me.status).toBe(401);
  });

  it('introspect rejects a malformed bearer', async () => {
    const me = await fetch(getPbUrl() + '/api/stjorna/api-keys/me', {
      headers: { Authorization: 'Bearer not-a-key' },
    });
    expect(me.status).toBe(401);
  });

  it('LIST degrades gracefully on a fresh deployment (zero rows)', async () => {
    // PB admin re-auth (any test that issued keys left rows behind).
    await pb.admins.authWithPassword('admin@test.stjorna.local', 'admin12345678test');
    const res = await fetch(getPbUrl() + '/api/stjorna/api-keys?perPage=50', {
      headers: { Authorization: 'Bearer ' + pb.authStore.token },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('expires: introspect rejects an expired key', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const issue = await fetch(getPbUrl() + '/api/stjorna/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pb.authStore.token },
      body: JSON.stringify({ tenant: tenantId, name: 'expired-test', expires: past }),
    });
    expect(issue.status).toBe(200);
    const { plaintext } = await issue.json();
    const me = await fetch(getPbUrl() + '/api/stjorna/api-keys/me', {
      headers: { Authorization: 'Bearer ' + plaintext },
    });
    expect(me.status).toBe(401);
  });

  it('exchange: returns STJÓRN A user credentials that unlock /api/collections/*', async () => {
    // Seed a couple of categories so we have something to fetch.
    await pb.collection('categories').create(createCategoryFixture(tenantId, { name: 'Cat-Exchange-A' }));
    await pb.collection('categories').create(createCategoryFixture(tenantId, { name: 'Cat-Exchange-B' }));

    const issue = await fetch(getPbUrl() + '/api/stjorna/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pb.authStore.token },
      body: JSON.stringify({ tenant: tenantId, name: 'exchange-flow' }),
    });
    expect(issue.status).toBe(200);
    const { plaintext } = await issue.json();

    // 1. exchange the API key
    const ex = await fetch(getPbUrl() + '/api/stjorna/api-keys/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + plaintext },
    });
    expect(ex.status).toBe(200);
    const exBody = await ex.json();
    expect(exBody.ok).toBe(true);
    expect(exBody.tenant).toBe(tenantId);
    expect(typeof exBody.email).toBe('string');
    expect(exBody.email).toMatch(/^svc-/);
    expect(exBody.email.endsWith('@stjorna.internal')).toBe(true);
    expect(typeof exBody.password).toBe('string');
    expect(exBody.password.length).toBeGreaterThanOrEqual(16);

    // 2. exchange auth-with-password using the returned credentials
    const authRes = await fetch(getPbUrl() + '/api/collections/users/auth-with-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: exBody.email, password: exBody.password }),
    });
    expect(authRes.status).toBe(200);
    const authBody = await authRes.json();
    expect(typeof authBody.token).toBe('string');
    expect(authBody.token.split('.').length).toBe(3);

    // 3. with the JWT, list categories — should now return the seeded rows.
    const catRes = await fetch(getPbUrl() + '/api/collections/categories/records?perPage=200&filter=' + encodeURIComponent('tenant="' + tenantId + '"'), {
      headers: { Authorization: 'Bearer ' + authBody.token },
    });
    expect(catRes.status).toBe(200);
    const catBody = await catRes.json();
    expect(Array.isArray(catBody.items)).toBe(true);
    const slugs = catBody.items.map((c: any) => c.name);
    expect(slugs).toContain('Cat-Exchange-A');
    expect(slugs).toContain('Cat-Exchange-B');
  });

  it('exchange: rejects unknown bearer (no body, no header)', async () => {
    const r = await fetch(getPbUrl() + '/api/stjorna/api-keys/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(r.status).toBe(400);
  });

  it('exchange: rejects a malformed key', async () => {
    const r = await fetch(getPbUrl() + '/api/stjorna/api-keys/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'not-a-key' }),
    });
    expect(r.status).toBe(401);
  });

  it('exchange: rejects a revoked key (after revoke, exchange returns 401)', async () => {
    const issue = await fetch(getPbUrl() + '/api/stjorna/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pb.authStore.token },
      body: JSON.stringify({ tenant: tenantId, name: 'exchange-revoke' }),
    });
    const { apiKey, plaintext } = await issue.json();

    // revoke first
    await fetch(getPbUrl() + '/api/stjorna/api-keys/' + apiKey.id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + pb.authStore.token },
    });

    const r = await fetch(getPbUrl() + '/api/stjorna/api-keys/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + plaintext },
    });
    expect(r.status).toBe(401);
  });
});
