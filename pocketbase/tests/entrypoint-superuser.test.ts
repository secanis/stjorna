import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

// T-04.1: entrypoint.sh must refuse to start when PB_SUPERUSER_EMAIL is
// set but PB_SUPERUSER_PASSWORD is empty or a placeholder ("changeme").
// Previously docker-compose.yml defaulted the password to `changeme`, so
// a compose deployment without a .env silently got a headless superuser
// with a well-known password.
//
// Same harness as entrypoint-pbsecret.test.ts: throwaway containers on
// a dedicated host port, inspect state + logs.

const PB_IMAGE = 'localhost/stjorna-pocketbase:test';
const HOST_PORT = 18095;
const CONTAINER_NAME = `stjorna-t04-superuser-${process.pid}`;

const CLI = (() => {
  try {
    execSync('command -v docker', { stdio: 'ignore' });
    return 'docker';
  } catch {
    return 'podman';
  }
})();

const rmContainer = () => {
  try { execSync(`${CLI} rm -f ${CONTAINER_NAME}`, { stdio: 'ignore' }); } catch {}
};

const containerLogs = (): string => {
  try {
    return execSync(`${CLI} logs ${CONTAINER_NAME} 2>&1`, { encoding: 'utf8' });
  } catch (e: any) {
    return String(e?.stdout || '');
  }
};

const containerIsRunning = (): boolean => {
  try {
    const out = execSync(
      `${CLI} inspect -f '{{.State.Running}}' ${CONTAINER_NAME}`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return out === 'true';
  } catch {
    return false;
  }
};

const containerExitCode = (): number => {
  try {
    const out = execSync(
      `${CLI} inspect -f '{{.State.ExitCode}}' ${CONTAINER_NAME}`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return Number(out);
  } catch {
    return -1;
  }
};

const waitForExit = (timeoutMs: number): boolean => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!containerIsRunning()) return true;
    execSync('sleep 0.3');
  }
  return false;
};

const runDetached = (env: Record<string, string>): void => {
  const envFlags = Object.entries(env)
    .map(([k, v]) => `-e ${k}=${JSON.stringify(v)}`)
    .join(' ');
  execSync(
    `${CLI} run -d --name ${CONTAINER_NAME} -p 127.0.0.1:${HOST_PORT}:8090 ${envFlags} ${PB_IMAGE}`,
    { stdio: 'ignore' },
  );
};

const expectRefused = (pattern: RegExp) => {
  const exited = waitForExit(15_000);
  expect(exited, 'container should exit quickly').toBe(true);
  expect(containerExitCode()).not.toBe(0);
  const logs = containerLogs();
  expect(logs).toMatch(pattern);
  expect(logs).not.toMatch(/Welcome to Pocketbase|Server started/);
};

describe('T-04.1: entrypoint.sh refuses placeholder superuser passwords', () => {
  it('email set, password empty → exits non-zero with FATAL', async () => {
    rmContainer();
    runDetached({ PB_SUPERUSER_EMAIL: 'admin@example.test', PB_SUPERUSER_PASSWORD: '' });
    expectRefused(/FATAL: PB_SUPERUSER_EMAIL is set but PB_SUPERUSER_PASSWORD is empty or a placeholder/);
    rmContainer();
  }, 60_000);

  it('email set, password "changeme" → exits non-zero with FATAL', async () => {
    rmContainer();
    runDetached({ PB_SUPERUSER_EMAIL: 'admin@example.test', PB_SUPERUSER_PASSWORD: 'changeme' });
    expectRefused(/FATAL: PB_SUPERUSER_EMAIL is set but PB_SUPERUSER_PASSWORD is empty or a placeholder/);
    rmContainer();
  }, 60_000);

  it('email set, password shorter than 8 chars → exits non-zero with FATAL', async () => {
    rmContainer();
    runDetached({ PB_SUPERUSER_EMAIL: 'admin@example.test', PB_SUPERUSER_PASSWORD: 'short1' });
    expectRefused(/FATAL: PB_SUPERUSER_PASSWORD must be at least 8 characters/);
    rmContainer();
  }, 60_000);

  it('no email, no password → starts normally (wizard bootstrap path)', async () => {
    rmContainer();
    runDetached({ PB_SUPERUSER_EMAIL: '', PB_SUPERUSER_PASSWORD: '' });
    const deadline = Date.now() + 60_000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`http://127.0.0.1:${HOST_PORT}/api/health`);
        if (r.ok) { ready = true; break; }
      } catch {}
      execSync('sleep 0.5');
    }
    expect(ready).toBe(true);
    expect(containerLogs()).not.toMatch(/FATAL: PB_SUPERUSER/);
    rmContainer();
  }, 120_000);
});
