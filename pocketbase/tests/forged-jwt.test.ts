import { describe, it, expect, beforeAll } from 'vitest';
import { getPb, getPbUrl } from '../setup.ts';
import { createAdminClient, createTenantUser } from './helpers/client.ts';
import { createTenantFixture } from './helpers/fixtures.ts';

/**
 * T-01: Forged JWT bypass on api-keys/backup/stats/users-search.
 *
 * Every custom STJÓRNA admin or tenant-user route used to call
 * `$security.parseUnverifiedJWT(token)` and trust the decoded payload
 * (e.g. `type === 'auth' && collectionId === 'pbc_3142635823'`). That
 * decodes the base64 payload but never verifies the HMAC signature, so
 * an attacker can craft `x.<b64>.x` with whatever claims they want
 * and impersonate a superuser or another tenant user.
 *
 * These tests forge a handful of "tokens" using PB's own base64url
 * helpers and verify every affected route rejects them with 401 (or
 * 403 where appropriate). A real superuser token still works.
 *
 * Tested routes:
 *   - POST   /api/stjorna/api-keys
 *   - GET    /api/stjorna/api-keys
 *   - DELETE /api/stjorna/api-keys/{id}
 *   - GET    /api/backup/json
 *   - GET    /api/backup/zip
 *   - POST   /api/backup/import
 *   - GET    /api/stjorna/stats
 *   - GET    /api/stjorna/users/search
 */

// Build a forged JWT of the shape `x.<b64url(payload)>.x`. PB rejects
// the signature but used to ignore that — every hook that called
// `$security.parseUnverifiedJWT` would still trust the payload.
function forgeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) => {
    const json = JSON.stringify(obj);
    // base64url encode (Node 16+ Buffer.from + 'base64url').
    return Buffer.from(json, 'utf8').toString('base64url');
  };
  return `x.${b64(payload)}.x`;
}

describe('T-01: forged-JWT bypass is closed', () => {
  let pb: ReturnType<typeof getPb>;
  let tenantId: string;
  let apiKeyId: string;

  // Tokens we try to slip past every route.
  const forgedTokens: Array<{ name: string; token: string }> = [
    {
      name: 'forged superuser claim (type=auth, superuser collectionId)',
      token: forgeJwt({ type: 'auth', collectionId: 'pbc_3142635823', id: 'any_superuser_id' }),
    },
    {
      name: 'forged legacy admin claim (v0.22 type=admin)',
      token: forgeJwt({ type: 'admin', id: 'any_superuser_id' }),
    },
    {
      name: 'forged authRecord claim (impersonates any tenant user)',
      token: forgeJwt({ type: 'authRecord', collectionId: '_pb_users_auth_', id: 'any_user_id' }),
    },
    {
      name: 'forged plain user claim (type=auth, users collectionId)',
      token: forgeJwt({ type: 'auth', collectionId: '_pb_users_auth_', id: 'any_user_id' }),
    },
  ];

  beforeAll(async () => {
    pb = await createAdminClient();
    const tenant = await pb.collection('tenants').create(createTenantFixture());
    tenantId = tenant.id;

    // Seed an api_keys row so we have something to DELETE.
    const issue = await fetch(getPbUrl() + '/api/stjorna/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pb.authStore.token },
      body: JSON.stringify({ tenant: tenantId, name: 't01-fixture' }),
    });
    expect(issue.status).toBe(200);
    const issued = await issue.json();
    apiKeyId = issued.apiKey.id;
  });

  // ---- api-keys POST / GET / DELETE ----------------------------------

  describe('api-keys admin-only routes reject every forged token', () => {
    for (const { name, token } of forgedTokens) {
      it('POST /api/stjorna/api-keys — ' + name, async () => {
        const res = await fetch(getPbUrl() + '/api/stjorna/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ tenant: tenantId, name: 'should-not-be-issued' }),
        });
        expect(res.status).toBe(401);
      });

      it('GET /api/stjorna/api-keys — ' + name, async () => {
        const res = await fetch(getPbUrl() + '/api/stjorna/api-keys', {
          headers: { Authorization: 'Bearer ' + token },
        });
        expect(res.status).toBe(401);
      });

      it('DELETE /api/stjorna/api-keys/{id} — ' + name, async () => {
        const res = await fetch(getPbUrl() + '/api/stjorna/api-keys/' + apiKeyId, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + token },
        });
        expect(res.status).toBe(401);
      });
    }

    it('rejects with no Authorization header at all', async () => {
      const res = await fetch(getPbUrl() + '/api/stjorna/api-keys');
      expect(res.status).toBe(401);
    });

    it('accepts a real superuser token (sanity)', async () => {
      const res = await fetch(getPbUrl() + '/api/stjorna/api-keys?perPage=5', {
        headers: { Authorization: 'Bearer ' + pb.authStore.token },
      });
      expect(res.status).toBe(200);
    });
  });

  // ---- backup GET /json /zip /import ---------------------------------

  describe('backup routes reject every forged token', () => {
    for (const { name, token } of forgedTokens) {
      it('GET /api/backup/json — ' + name, async () => {
        const res = await fetch(getPbUrl() + '/api/backup/json', {
          headers: { Authorization: 'Bearer ' + token },
        });
        expect(res.status).toBe(401);
      });

      it('GET /api/backup/zip — ' + name, async () => {
        const res = await fetch(getPbUrl() + '/api/backup/zip', {
          headers: { Authorization: 'Bearer ' + token },
        });
        expect(res.status).toBe(401);
      });

      it('POST /api/backup/import — ' + name, async () => {
        const res = await fetch(getPbUrl() + '/api/backup/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ tenant: tenantId, source: 'v3', data_base64: 'e30=' }),
        });
        // requireAuth() runs first — forged tokens get 401 before the
        // tenant-admin check is even reached.
        expect(res.status).toBe(401);
      });
    }

    it('POST /api/backup/import rejects a tenant user who is NOT an admin of the target tenant', async () => {
      const otherTenant = await pb.collection('tenants').create(createTenantFixture());
      const { pb: viewerPb } = await createTenantUser(tenantId, 'viewer');
      const res = await fetch(getPbUrl() + '/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + viewerPb.authStore.token },
        body: JSON.stringify({ tenant: otherTenant.id, source: 'v3', data_base64: 'e30=' }),
      });
      expect(res.status).toBe(403);
    });

    it('POST /api/backup/import accepts a real superuser token (sanity)', async () => {
      const res = await fetch(getPbUrl() + '/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pb.authStore.token },
        body: JSON.stringify({ tenant: tenantId, source: 'v3', data_base64: 'e30=' }),
      });
      // 200 even on empty manifest (nothing to import).
      expect(res.status).toBe(200);
    });
  });

  // ---- stats --------------------------------------------------------

  describe('stats rejects forged superuser tokens AND forged user impersonation', () => {
    for (const { name, token } of forgedTokens) {
      it('GET /api/stjorna/stats — ' + name, async () => {
        const res = await fetch(getPbUrl() + '/api/stjorna/stats?tenant=' + encodeURIComponent(tenantId), {
          headers: { Authorization: 'Bearer ' + token },
        });
        // requireAuth rejects anonymous AND forged tokens with 401.
        expect(res.status).toBe(401);
      });
    }

    it('GET /api/stjorna/stats with no Authorization header', async () => {
      const res = await fetch(getPbUrl() + '/api/stjorna/stats?tenant=' + encodeURIComponent(tenantId));
      expect(res.status).toBe(401);
    });

    it('GET /api/stjorna/stats accepts a real superuser token (sanity)', async () => {
      const res = await fetch(getPbUrl() + '/api/stjorna/stats?tenant=' + encodeURIComponent(tenantId), {
        headers: { Authorization: 'Bearer ' + pb.authStore.token },
      });
      expect(res.status).toBe(200);
    });

    it('GET /api/stjorna/stats: forged user id cannot impersonate a victim via query string', async () => {
      // Even if an attacker steals a real STJÓRN A user JWT for tenant A,
      // they cannot query tenant B by passing ?tenant=<B>. This was the
      // original bypass: stats read _p.id (forged) instead of e.auth.id.
      const { pb: userAPb } = await createTenantUser(tenantId, 'viewer');
      const otherTenant = await pb.collection('tenants').create(createTenantFixture());
      const res = await fetch(
        getPbUrl() + '/api/stjorna/stats?tenant=' + encodeURIComponent(otherTenant.id),
        { headers: { Authorization: 'Bearer ' + userAPb.authStore.token } },
      );
      expect(res.status).toBe(403);
    });
  });

  // ---- users/search -------------------------------------------------

  describe('users/search rejects every forged token', () => {
    for (const { name, token } of forgedTokens) {
      it('GET /api/stjorna/users/search — ' + name, async () => {
        const res = await fetch(getPbUrl() + '/api/stjorna/users/search?q=anything', {
          headers: { Authorization: 'Bearer ' + token },
        });
        expect(res.status).toBe(401);
      });
    }

    it('GET /api/stjorna/users/search with no Authorization header', async () => {
      const res = await fetch(getPbUrl() + '/api/stjorna/users/search?q=anything');
      expect(res.status).toBe(401);
    });

    it('GET /api/stjorna/users/search accepts a real superuser token (sanity)', async () => {
      const res = await fetch(getPbUrl() + '/api/stjorna/users/search?q=admin', {
        headers: { Authorization: 'Bearer ' + pb.authStore.token },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.users)).toBe(true);
    });

    it('GET /api/stjorna/users/search: a non-admin tenant user gets 403', async () => {
      const { pb: viewerPb } = await createTenantUser(tenantId, 'viewer');
      const res = await fetch(getPbUrl() + '/api/stjorna/users/search?q=anyone', {
        headers: { Authorization: 'Bearer ' + viewerPb.authStore.token },
      });
      expect(res.status).toBe(403);
    });
  });

  // ---- Negative: grep-level guarantee ---------------------------------

  describe('source code no longer trusts parseUnverifiedJWT in auth decisions', () => {
    // Statically verify the fix landed: every *.pb.js in pb_hooks/ must
    // be free of the two hard-coded collection ids that were the
    // signature of the bypass. (Only the comment in superusers.pb.js is
    // allowed to mention parseUnverifiedJWT — see the docs there.)
    it('contains zero auth-decision uses of $security.parseUnverifiedJWT', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const dir = path.resolve(__dirname, '..', 'pb_hooks');
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pb.js'));
      const offenders: string[] = [];
      for (const f of files) {
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        // Strip comments to avoid the legitimate doc reference in
        // superusers.pb.js.
        const stripped = src
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '')
          .replace(/\/\/.*$/gm, '');
        if (stripped.includes('$security.parseUnverifiedJWT')) {
          offenders.push(f);
        }
      }
      expect(offenders).toEqual([]);
    });
  });
});
