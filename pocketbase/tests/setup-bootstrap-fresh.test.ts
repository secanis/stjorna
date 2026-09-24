import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';

// T-04 acceptance: the full first-superuser CREATE path on an EMPTY
// PocketBase. The shared container (tests/global-setup.ts) already has a
// superuser, so this file starts its own throwaway container:
//
//   - no PB_SUPERUSER_* env  → entrypoint.sh does not upsert anything
//   - no STJORNA_SETUP_TOKEN → the hook generates a token at boot and
//                              prints it to the server log (default path)
//   - bridge networking on a dedicated host port so it can coexist with
//     the shared --network=host container on :8090
//
// Covered:
//   1. status reports superuserExists=false / setupDone=false / source=log
//   2. the token banner is printed exactly once with a 40-char token
//   3. 401 without / with a wrong token
//   4. N concurrent bootstrap requests → exactly ONE 200, the rest 409
//      (existence check + insert run in one transaction)
//   5. the winner can log in, is active, and is the only real superuser
//   6. once a superuser exists → 409, even with the right token
//   7. once instance_settings.setup_done=true → 409 "setup already
//      completed" (checked before the superuser-exists guard)

const PB_IMAGE = 'localhost/stjorna-pocketbase:test';
const HOST_PORT = 18092;
const PB_URL = `http://127.0.0.1:${HOST_PORT}`;
const CONTAINER_NAME = `stjorna-t04-fresh-${process.pid}`;

const CLI = (() => {
  try {
    execSync('command -v docker', { stdio: 'ignore' });
    return 'docker';
  } catch {
    return 'podman';
  }
})();

const STATUS_URL = `${PB_URL}/api/stjorna/setup-status`;
const BOOTSTRAP_URL = `${PB_URL}/api/stjorna/setup-bootstrap-superuser`;

const postBootstrap = (body: unknown, token?: string) =>
  fetch(BOOTSTRAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token !== undefined ? { 'X-Stjorna-Setup-Token': token } : {}),
    },
    body: JSON.stringify(body),
  });

const containerLogs = (): string => {
  try {
    return execSync(`${CLI} logs ${CONTAINER_NAME} 2>&1`, { encoding: 'utf8' });
  } catch (e: any) {
    return String(e?.stdout || '');
  }
};

const superuserLogin = async (email: string, password: string): Promise<string> => {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  if (!res.ok) throw new Error(`login ${email} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.token as string;
};

describe('Setup bootstrap hook (fresh container — create path, T-04)', () => {
  let setupToken = '';
  const RACERS = 6;
  const PASSWORD = 'FreshInstallPass123';
  const racerEmail = (i: number) => `racer${i}@fresh.stjorna.local`;
  let winnerEmail = '';
  let winnerJwt = '';

  beforeAll(async () => {
    try { execSync(`${CLI} rm -f ${CONTAINER_NAME}`, { stdio: 'ignore' }); } catch {}
    execSync(
      `${CLI} run -d --rm --name ${CONTAINER_NAME} -p 127.0.0.1:${HOST_PORT}:8090 ${PB_IMAGE}`,
      { stdio: 'ignore' }
    );
    const deadline = Date.now() + 120_000;
    let healthy = false;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${PB_URL}/api/health`);
        if (res.ok) { healthy = true; break; }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!healthy) {
      throw new Error(`fresh PB container not healthy after 120s\n${containerLogs().slice(-2000)}`);
    }
    // The banner is printed from an onBootstrap handler, i.e. before
    // "Server started" — by the time /api/health answers it is in the log.
    const m = containerLogs().match(/STJORNA_SETUP_TOKEN=([A-Za-z0-9]+)/);
    setupToken = m ? m[1] : '';
  }, 150_000);

  afterAll(() => {
    try { execSync(`${CLI} rm -f ${CONTAINER_NAME}`, { stdio: 'ignore' }); } catch {}
  });

  it('prints a one-time setup token banner to the server log', () => {
    const logs = containerLogs();
    expect(logs).toMatch(/No superuser exists yet/);
    expect(setupToken).toMatch(/^[A-Za-z0-9]{40}$/);
    // exactly one banner
    expect(logs.match(/STJORNA_SETUP_TOKEN=/g)?.length).toBe(1);
    // the hook loaded without errors
    expect(logs).not.toMatch(/failed to execute setup\.pb\.js/);
  });

  it('status reports a fresh install (no superuser, setup not done, token from log)', async () => {
    const res = await fetch(STATUS_URL);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.superuserExists).toBe(false);
    expect(body.setupDone).toBe(false);
    expect(body.setupTokenRequired).toBe(true);
    expect(body.setupTokenSource).toBe('log');
  });

  it('refuses without a token (401) and with a wrong token (401) on a fresh install', async () => {
    const body = { email: 'attacker@fresh.stjorna.local', password: PASSWORD, passwordConfirm: PASSWORD };
    const noTok = await postBootstrap(body);
    expect(noTok.status).toBe(401);
    const wrongTok = await postBootstrap(body, 'x'.repeat(40));
    expect(wrongTok.status).toBe(401);
    // Nothing was created.
    const status = await (await fetch(STATUS_URL)).json();
    expect(status.superuserExists).toBe(false);
  });

  it('exactly one of N concurrent bootstrap requests succeeds', async () => {
    const results = await Promise.all(
      Array.from({ length: RACERS }, (_, i) =>
        postBootstrap(
          { email: racerEmail(i), password: PASSWORD, passwordConfirm: PASSWORD },
          setupToken
        ).then(async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) }))
      )
    );
    const okResults = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);
    expect(okResults.length).toBe(1);
    expect(conflicts.length).toBe(RACERS - 1);
    expect(okResults[0].body.ok).toBe(true);
    expect(typeof okResults[0].body.id).toBe('string');
    winnerEmail = String(okResults[0].body.email);
    expect(winnerEmail).toMatch(/^racer\d@fresh\.stjorna\.local$/);
  });

  it('the winner can log in and is active', async () => {
    winnerJwt = await superuserLogin(winnerEmail, PASSWORD);
    expect(winnerJwt.length).toBeGreaterThan(50);
    const res = await fetch(`${PB_URL}/api/collections/_superusers/records?perPage=50`, {
      headers: { Authorization: winnerJwt },
    });
    expect(res.status).toBe(200);
    const list = await res.json();
    const real = (list.items as any[]).filter((r) => r.email !== '__pbinstaller@example.com');
    // Only the winner exists — none of the losers slipped through.
    expect(real.length).toBe(1);
    expect(real[0].email).toBe(winnerEmail);
    expect(real[0].active).toBe(true);
  });

  it('the losers cannot log in', async () => {
    const loser = Array.from({ length: RACERS }, (_, i) => racerEmail(i)).find((e) => e !== winnerEmail)!;
    await expect(superuserLogin(loser, PASSWORD)).rejects.toThrow(/failed/);
  });

  it('status now reports superuserExists=true', async () => {
    const body = await (await fetch(STATUS_URL)).json();
    expect(body.superuserExists).toBe(true);
    expect(body.setupDone).toBe(false);
  });

  it('refuses a second bootstrap with the right token once a superuser exists (409)', async () => {
    const res = await postBootstrap(
      { email: 'second@fresh.stjorna.local', password: PASSWORD, passwordConfirm: PASSWORD },
      setupToken
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(String(body.error.message)).toMatch(/superuser already exists/i);
  });

  it('refuses with "setup already completed" once instance_settings.setup_done=true', async () => {
    // Mark setup as done the way the wizard's last step does.
    const create = await fetch(`${PB_URL}/api/collections/instance_settings/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: winnerJwt },
      body: JSON.stringify({ setup_done: true, instance_name: 'T04' }),
    });
    expect(create.status).toBe(200);

    const status = await (await fetch(STATUS_URL)).json();
    expect(status.setupDone).toBe(true);

    const res = await postBootstrap(
      { email: 'third@fresh.stjorna.local', password: PASSWORD, passwordConfirm: PASSWORD },
      setupToken
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    // The setup_done guard runs BEFORE the superuser-exists guard, so this
    // is the lock that holds even if _superusers were ever emptied.
    expect(String(body.error.message)).toMatch(/setup already completed/i);
  });

  it('the banner was not re-printed and no bootstrap error was logged', () => {
    const logs = containerLogs();
    expect(logs.match(/STJORNA_SETUP_TOKEN=/g)?.length).toBe(1);
    expect(logs).not.toMatch(/bootstrap save failed/);
    expect(logs.match(/first superuser created/g)?.length).toBe(1);
  });
});
