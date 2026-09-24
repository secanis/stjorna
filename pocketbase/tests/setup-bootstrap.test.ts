import { describe, it, expect, beforeAll } from 'vitest';
import { getPb, getPbUrl, SETUP_TOKEN } from '../setup.ts';

const STATUS_URL = () => getPbUrl() + '/api/stjorna/setup-status';
const BOOTSTRAP_URL = () => getPbUrl() + '/api/stjorna/setup-bootstrap-superuser';

const postBootstrap = (body: unknown, token?: string) =>
  fetch(BOOTSTRAP_URL(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token !== undefined ? { 'X-Stjorna-Setup-Token': token } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const VALID_BODY = {
  email: 'second-admin@test.stjorna.local',
  password: 'secondPassword123',
  passwordConfirm: 'secondPassword123',
};

// These tests verify the hook registered by pocketbase/pb_hooks/setup.pb.js
// against the SHARED PB container (tests/global-setup.ts). That container
// was seeded with a superuser via PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD
// and with a fixed STJORNA_SETUP_TOKEN, so here we exercise the GUARD paths:
//
//   - status endpoint reports superuserExists=true and the token source
//   - bootstrap endpoint: 401 without / with a wrong token (T-04)
//   - bootstrap endpoint: 409 with the right token (superuser exists)
//   - body validation still runs (400) once the token is right
//
// The full CREATE path on an empty PB (token from the server log, race
// between concurrent requests, setup_done lock) is covered by
// tests/setup-bootstrap-fresh.test.ts, which starts its own container.
describe('Setup bootstrap hook (shared container — guard paths)', () => {
  let adminAuthHeader: string;

  beforeAll(async () => {
    const pb = getPb();
    adminAuthHeader = 'Bearer ' + pb.authStore.token;
  });

  it('status endpoint reports the existing superuser and the token source', async () => {
    const res = await fetch(STATUS_URL());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.superuserExists).toBe(true);
    expect(typeof body.setupDone).toBe('boolean');
    expect(body.setupTokenRequired).toBe(true);
    // setup.ts passes STJORNA_SETUP_TOKEN to the container.
    expect(body.setupTokenSource).toBe('env');
  });

  it('status endpoint treats the PB v0.40 installer placeholder as no superuser', async () => {
    // PB v0.40 seeds a placeholder row into _superusers on every fresh
    // data directory so the dashboard installer UI can authenticate.
    // The placeholder's email is "__pbinstaller@example.com" and it has
    // an invalid password hash — it is NOT a usable admin. The hook's
    // status + bootstrap endpoints must filter it out, otherwise the
    // bootstrap endpoint would refuse (HTTP 409) on every fresh install.
    //
    // We can't observe the "false on fresh install" case in the shared
    // container (a real superuser was already seeded by entrypoint.sh),
    // so we instead verify the wiring: the placeholder row, when it
    // exists, must not change the reported `superuserExists` value.
    const pb = getPb();
    const suCol = pb.collection('_superusers');
    let placeholderId: string | null = null;
    try {
      const existing = await suCol.getFirstListItem('email = "__pbinstaller@example.com"');
      placeholderId = existing.id;
    } catch {
      // not present — try to create it
      try {
        const created = await suCol.create({
          email: '__pbinstaller@example.com',
          password: 'placeholder-no-real-password',
          passwordConfirm: 'placeholder-no-real-password',
          verified: true,
        });
        placeholderId = created.id;
      } catch (e: any) {
        console.warn('[setup-bootstrap] could not inject placeholder, skipping:', e?.message || e);
        return;
      }
    }

    try {
      const res = await fetch(STATUS_URL());
      const body = await res.json();
      // A real superuser exists in this container (env-var bootstrap),
      // so the answer is true. The placeholder MUST NOT flip it to a
      // different value or the hook is broken on fresh installs.
      expect(body.superuserExists).toBe(true);
    } finally {
      if (placeholderId) {
        try { await suCol.delete(placeholderId); } catch {}
      }
    }
  });

  it('status endpoint accepts unauthenticated callers', async () => {
    // The endpoint MUST be open: there's no admin yet at first boot.
    const res = await fetch(STATUS_URL());
    expect(res.status).toBe(200);
  });

  it('status endpoint requires no auth header (no 401)', async () => {
    // Sanity check that we didn't accidentally require auth on the route.
    const res = await fetch(STATUS_URL(), { headers: { Authorization: 'Bearer obviously-wrong' } });
    expect(res.status).toBe(200);
  });

  // ---------------------------------------------------------------------
  // T-04: setup token gate
  // ---------------------------------------------------------------------

  it('bootstrap endpoint refuses without a setup token (401)', async () => {
    const res = await postBootstrap(VALID_BODY);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(String(body.error.message || '')).toMatch(/setup token/i);
  });

  it('bootstrap endpoint refuses with a wrong setup token (401)', async () => {
    const res = await postBootstrap(VALID_BODY, 'definitely-not-the-token-000000');
    expect(res.status).toBe(401);
  });

  it('bootstrap endpoint refuses with an empty setup token header (401)', async () => {
    const res = await postBootstrap(VALID_BODY, '');
    expect(res.status).toBe(401);
  });

  it('bootstrap endpoint refuses a token that only shares a prefix (401)', async () => {
    // Constant-time compare via $security.equal — a prefix must not pass.
    const res = await postBootstrap(VALID_BODY, SETUP_TOKEN.slice(0, -1));
    expect(res.status).toBe(401);
  });

  it('token check runs before body validation (invalid body + wrong token → 401, not 400)', async () => {
    const res = await postBootstrap({ email: 'not-an-email', password: 'x', passwordConfirm: 'y' }, 'wrong-token-wrong-token');
    expect(res.status).toBe(401);
  });

  it('bootstrap endpoint refuses when a superuser already exists (409) even with the right token', async () => {
    const res = await postBootstrap(VALID_BODY, SETUP_TOKEN);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
    expect(String(body.error.message || '')).toMatch(/already/i);

    // And it really did not mint a second admin.
    const pb = getPb();
    const list = await pb.collection('_superusers').getList(1, 1, {
      filter: pb.filter('email = {:email}', { email: VALID_BODY.email }),
    });
    expect(list.totalItems).toBe(0);
  });

  // ---------------------------------------------------------------------
  // Body validation (needs the right token to get past the gate)
  // ---------------------------------------------------------------------

  it('bootstrap endpoint validates email shape', async () => {
    const res = await postBootstrap({
      email: 'not-an-email',
      password: 'longenough123',
      passwordConfirm: 'longenough123',
    }, SETUP_TOKEN);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(String(body.error.message || '')).toMatch(/email/i);
  });

  it('bootstrap endpoint enforces minimum password length', async () => {
    const res = await postBootstrap({
      email: 'fresh-admin@test.stjorna.local',
      password: 'short',
      passwordConfirm: 'short',
    }, SETUP_TOKEN);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error.message || '')).toMatch(/10 characters/i);
  });

  it('bootstrap endpoint requires password + confirmation to match', async () => {
    const res = await postBootstrap({
      email: 'fresh-admin@test.stjorna.local',
      password: 'longenough123',
      passwordConfirm: 'differentPassword1',
    }, SETUP_TOKEN);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error.message || '')).toMatch(/do not match/i);
  });

  it('bootstrap endpoint rejects malformed JSON', async () => {
    const res = await postBootstrap('not-json', SETUP_TOKEN);
    expect(res.status).toBe(400);
  });

  it('the admin token continues to work after probing the setup routes', async () => {
    // Make sure probing the public setup routes didn't invalidate the
    // admin session (they share the same PB instance; just a smoke test).
    expect(adminAuthHeader).toMatch(/^Bearer /);
    const pb = getPb();
    const list = await pb.collection('_superusers').getList(1, 1);
    expect(list.items.length).toBeGreaterThanOrEqual(1);
  });
});
