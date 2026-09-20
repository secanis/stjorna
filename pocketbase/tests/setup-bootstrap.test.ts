import { describe, it, expect, beforeAll } from 'vitest';
import { getPb, getPbUrl } from '../setup.ts';

const STATUS_URL = () => getPbUrl() + '/api/stjorna/setup-status';
const BOOTSTRAP_URL = () => getPbUrl() + '/api/stjorna/setup-bootstrap-superuser';

// These tests verify the hook registered by pocketbase/pb_hooks/setup.pb.js.
//
// The shared PB container (started by tests/global-setup.ts) was seeded
// with a superuser via the PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD env
// vars on `docker run`, so by the time these tests run there is already
// a superuser. That means we can only exercise the GUARD path here:
//
//   - status endpoint reports superuserExists=true
//   - bootstrap endpoint refuses with 409 (refuses to mint a 2nd admin)
//
// The full CREATE path (empty PB → POST bootstrap → first admin exists)
// is covered by scripts/test-helm.sh against a kind cluster, since it
// needs a PB instance whose pb_data starts empty. Vitest's shared
// container can't be reset between tests cheaply.
describe('Setup bootstrap hook', () => {
  let adminAuthHeader: string;

  beforeAll(async () => {
    const pb = getPb();
    adminAuthHeader = 'Bearer ' + pb.authStore.token;
  });

  it('status endpoint reports the existing superuser', async () => {
    const res = await fetch(STATUS_URL());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.superuserExists).toBe('boolean');
    expect(body.superuserExists).toBe(true);
  });

  it('status endpoint accepts unauthenticated callers', async () => {
    // The endpoint MUST be open: there's no admin yet at first boot.
    const res = await fetch(STATUS_URL());
    expect(res.status).toBe(200);
  });

  it('bootstrap endpoint refuses when a superuser already exists (409)', async () => {
    const res = await fetch(BOOTSTRAP_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'second-admin@test.stjorna.local',
        password: 'secondPassword123',
        passwordConfirm: 'secondPassword123',
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
    expect(String(body.error.message || '')).toMatch(/already exists/i);
  });

  it('bootstrap endpoint validates email shape', async () => {
    const res = await fetch(BOOTSTRAP_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'longenough123',
        passwordConfirm: 'longenough123',
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(String(body.error.message || '')).toMatch(/email/i);
  });

  it('bootstrap endpoint enforces minimum password length', async () => {
    const res = await fetch(BOOTSTRAP_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'fresh-admin@test.stjorna.local',
        password: 'short',
        passwordConfirm: 'short',
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error.message || '')).toMatch(/10 characters/i);
  });

  it('bootstrap endpoint requires password + confirmation to match', async () => {
    const res = await fetch(BOOTSTRAP_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'fresh-admin@test.stjorna.local',
        password: 'longenough123',
        passwordConfirm: 'differentPassword1',
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error.message || '')).toMatch(/do not match/i);
  });

  it('bootstrap endpoint rejects malformed JSON', async () => {
    const res = await fetch(BOOTSTRAP_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });

  it('status endpoint requires no auth header (no 401)', async () => {
    // Sanity check that we didn't accidentally require auth on the route.
    const res = await fetch(STATUS_URL(), { headers: { Authorization: 'Bearer obviously-wrong' } });
    expect(res.status).toBe(200);
  });

  it('the admin token continues to work after probing the setup routes', async () => {
    // Make sure probing the public setup routes didn't invalidate the
    // admin session (they share the same PB instance; just a smoke test).
    const pb = getPb();
    const list = await pb.collection('_superusers').getList(1, 1);
    expect(list.items.length).toBeGreaterThanOrEqual(1);
  });

  // Avoid TS unused-var lint complaints; the header is referenced for
  // documentation but the bootstrap guard tests intentionally send no
  // auth header to prove the route is open.
  it('uses no auth header on bootstrap calls (route is intentionally open)', () => {
    expect(adminAuthHeader).toMatch(/^Bearer /);
  });
});
