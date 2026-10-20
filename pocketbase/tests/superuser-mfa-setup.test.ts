import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

// T-14: migration 1770000000 only enables superuser MFA when setup was
// already done at migration time, so fresh installs never got it. The
// mfa.pb.js hook enables OTP+MFA on the instance_settings.setup_done
// false → true transition, but only when SMTP is configured (otherwise
// every superuser would be locked out).
//
// Runs its own throwaway container so enabling MFA does not affect the
// shared container's superuser logins.

const require = createRequire(import.meta.url);
const { shouldEnableOnSetupDone } = require('../pb_hooks/lib/mfa.js');

const PB_IMAGE = 'localhost/stjorna-pocketbase:test';
const HOST_PORT = 18093;
const PB_URL = `http://127.0.0.1:${HOST_PORT}`;
const CONTAINER_NAME = `stjorna-t14-mfa-${process.pid}`;
const EMAIL = 'mfa-admin@test.stjorna.local';
const PASSWORD = 'MfaAdminPass12345';

const CLI = (() => {
  try {
    execSync('command -v docker', { stdio: 'ignore' });
    return 'docker';
  } catch {
    return 'podman';
  }
})();

describe('shouldEnableOnSetupDone (unit)', () => {
  it('only fires on false → true with SMTP', () => {
    expect(shouldEnableOnSetupDone(false, true, true)).toBe(true);
    expect(shouldEnableOnSetupDone(false, true, false)).toBe(false);
    expect(shouldEnableOnSetupDone(true, true, true)).toBe(false);
    expect(shouldEnableOnSetupDone(false, false, true)).toBe(false);
  });
});

describe('Superuser MFA on setup completion (fresh container, T-14)', () => {
  let token = '';

  const api = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${PB_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
    return text ? JSON.parse(text) : null;
  };

  const superusersCollection = () => api('GET', '/api/collections/_superusers');

  beforeAll(async () => {
    try { execSync(`${CLI} rm -f ${CONTAINER_NAME}`, { stdio: 'ignore' }); } catch {}
    execSync(
      `${CLI} run -d --rm --name ${CONTAINER_NAME} -p 127.0.0.1:${HOST_PORT}:8090 ` +
        `-e PB_SUPERUSER_EMAIL=${EMAIL} -e PB_SUPERUSER_PASSWORD=${PASSWORD} ${PB_IMAGE}`,
      { stdio: 'ignore' }
    );
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${PB_URL}/api/health`);
        if (res.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
    });
    if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
    token = (await res.json()).token;
  }, 150_000);

  afterAll(() => {
    try { execSync(`${CLI} rm -f ${CONTAINER_NAME}`, { stdio: 'ignore' }); } catch {}
  });

  it('fresh install starts without superuser MFA', async () => {
    const col = await superusersCollection();
    expect(col.mfa?.enabled).toBeFalsy();
  });

  it('does NOT enable MFA when setup finishes without SMTP (no lock-out)', async () => {
    const row = await api('POST', '/api/collections/instance_settings/records', {
      setup_done: true,
      instance_name: 'STJÓRNA',
    });
    const col = await superusersCollection();
    expect(col.mfa?.enabled).toBeFalsy();
    expect(col.otp?.enabled).toBeFalsy();
    // reset for the next case
    await api('PATCH', `/api/collections/instance_settings/records/${row.id}`, { setup_done: false });
  });

  it('enables OTP+MFA when setup finishes with SMTP configured', async () => {
    await api('PATCH', '/api/settings', {
      smtp: { enabled: true, host: 'smtp.invalid', port: 587 },
    });
    const rows = await api('GET', '/api/collections/instance_settings/records');
    await api('PATCH', `/api/collections/instance_settings/records/${rows.items[0].id}`, {
      setup_done: true,
    });
    const col = await superusersCollection();
    expect(col.otp?.enabled).toBe(true);
    expect(col.mfa?.enabled).toBe(true);
  });
});
