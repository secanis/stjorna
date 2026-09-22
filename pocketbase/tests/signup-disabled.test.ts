import { describe, it, expect } from 'vitest';
import { getPbUrl } from '../setup.ts';

/**
 * T-02: disable public sign-up.
 *
 * Before migration 1770001000 the `users` collection kept PB's default
 * `createRule = ""` (open). Combined with the loose `@request.auth.id != ""`
 * rules on every tenant collection, a single anonymous POST to
 * `/api/collections/users/records` produced an account that could read,
 * write, re-home and delete every tenant's data. The fix locks
 * users.createRule to null, so registration only happens through OIDC,
 * admin invite or the first-superuser setup wizard.
 */

describe('T-02: sign-up is disabled', () => {
  it('anonymous POST /api/collections/users/records is rejected', async () => {
    const res = await fetch(getPbUrl() + '/api/collections/users/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `t02-anon-${Date.now()}@t02.test`,
        password: 'somepassword123',
        passwordConfirm: 'somepassword123',
        name: 'Anon',
      }),
    });
    // createRule = null → 400 (PB returns 400 with an empty error body
    // when the rule rejects; sometimes 403 depending on the version).
    expect([400, 403]).toContain(res.status);
  });

  it('the rejection happens even with a valid email + matching passwords', async () => {
    const res = await fetch(getPbUrl() + '/api/collections/users/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'valid-format@example.com',
        password: 'longenough1234567',
        passwordConfirm: 'longenough1234567',
      }),
    });
    expect([400, 403]).toContain(res.status);
  });

  it('the rejection happens with verified=true (try to bypass validation)', async () => {
    const res = await fetch(getPbUrl() + '/api/collections/users/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'verified@example.com',
        password: 'longenough1234567',
        passwordConfirm: 'longenough1234567',
        verified: true,
      }),
    });
    expect([400, 403]).toContain(res.status);
  });

  it('users.createRule is now null on the collection schema', async () => {
    // Read the collection schema via the admin API. Setup-bootstrap left
    // us with a real superuser we can authenticate as.
    const { email, password } = await import('../setup.ts').then((m) => m.getTestAdminCredentials());
    const authRes = await fetch(getPbUrl() + '/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password }),
    });
    const { token } = await authRes.json();
    const collRes = await fetch(getPbUrl() + '/api/collections/users', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const coll = await collRes.json();
    expect(coll.createRule).toBeNull();
  });

  it('superuser (admin SDK) can still create users — this is the invite path', async () => {
    // The fix locks createRule=null which blocks anonymous / self-service
    // sign-up, but PB superusers still bypass collection rules. The
    // STJÓRN A setup wizard + admin invite flow rely on this path.
    const { email, password } = await import('../setup.ts').then((m) => m.getTestAdminCredentials());
    const authRes = await fetch(getPbUrl() + '/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password }),
    });
    const { token } = await authRes.json();
    const res = await fetch(getPbUrl() + '/api/collections/users/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        email: `t02-admin-invite-${Date.now()}@t02.test`,
        password: 'invitedpass123',
        passwordConfirm: 'invitedpass123',
        name: 'Admin-Invited User',
      }),
    });
    expect(res.status).toBe(200);
  });
});
