import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

// T-07: entrypoint.sh MUST fail loudly when PB_SECRET is set to anything
// other than exactly 32 characters. Previously it printed a warning and
// silently ran PB without --encryptionEnv, so an operator who copied
// `openssl rand -hex 32` (64 chars) from the README got a cluster that
// was running but had its settings table in plaintext.
//
// The shared container (tests/global-setup.ts) starts with a valid
// PB_SECRET, so this test spawns throwaway containers with each
// scenario and inspects the container state + logs.

const PB_IMAGE = 'localhost/stjorna-pocketbase:test';
const HOST_PORT = 18094;
const PB_URL = `http://127.0.0.1:${HOST_PORT}`;
const CONTAINER_NAME = `stjorna-t07-pbsecret-${process.pid}`;

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
    // `docker inspect -f '{{.State.Running}}'` returns the string "true"
    // or "false". Any non-zero exit means the container is gone.
    const out = execSync(
      `${CLI} inspect -f '{{.State.Running}}' ${CONTAINER_NAME}`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return out === 'true';
  } catch {
    return false;
  }
};

const waitForExit = (timeoutMs: number): boolean => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!containerIsRunning()) return true;
    // small sleep without bringing in a dep
    execSync('sleep 0.3');
  }
  return false;
};

describe('T-07: entrypoint.sh enforces PB_SECRET length', () => {
  // execSync THROWS on non-zero exit. The bad-secret cases exit 1
  // (entrypoint.sh), so wrap the run and capture the exit code.
  //
  // For the bad-secret tests we deliberately do NOT use --rm: the
  // container exits so fast that --rm races with our `logs` call and
  // the logs become "container not found". Detached + manual stop
  // is the reliable path.
  const runOnce = (args: string): number => {
    try {
      execSync(`${CLI} ${args}`, { stdio: 'ignore' });
      return 0;
    } catch (e: any) {
      return typeof e.status === 'number' ? e.status : 1;
    }
  };

  it('64-char PB_SECRET: container exits non-zero with a FATAL message', async () => {
    rmContainer();
    const secret = 'x'.repeat(64); // what `openssl rand -hex 32` actually produces
    // Detached run: container starts, entrypoint prints FATAL to stderr,
    // exits 1, container stops (NOT auto-removed because no --rm).
    const exitCode = runOnce(
      `run -d --name ${CONTAINER_NAME} -p 127.0.0.1:${HOST_PORT}:8090 ` +
        `-e PB_SECRET=${secret} ${PB_IMAGE}`,
    );
    expect(exitCode).toBe(0); // the detached run itself succeeds
    // Wait for the container to actually exit.
    const exited = waitForExit(15_000);
    expect(exited).toBe(true);
    expect(containerIsRunning()).toBe(false);

    const logs = containerLogs();
    expect(logs).toMatch(/FATAL: PB_SECRET must be exactly 32 characters/);
    expect(logs).toMatch(/got 64 characters/);
    // It must NOT have started pocketbase. With the previous
    // warning-only behaviour it would have printed the PB startup
    // banner — assert that's not there.
    expect(logs).not.toMatch(/Welcome to Pocketbase/);
    rmContainer();
  }, 60_000);

  it('empty PB_SECRET: container starts normally (no encryption)', async () => {
    rmContainer();
    execSync(
      `${CLI} run -d --rm --name ${CONTAINER_NAME} -p 127.0.0.1:${HOST_PORT}:8090 ` +
        `-e PB_SECRET= ${PB_IMAGE}`,
      { stdio: 'ignore' },
    );
    // Wait for /api/health to respond.
    const deadline = Date.now() + 60_000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`${PB_URL}/api/health`);
        if (r.ok) { ready = true; break; }
      } catch {}
      execSync('sleep 0.5');
    }
    expect(ready).toBe(true);

    const logs = containerLogs();
    expect(logs).not.toMatch(/FATAL: PB_SECRET/);
    rmContainer();
  }, 120_000);

  it('32-char PB_SECRET: container starts normally (encryption enabled)', async () => {
    rmContainer();
    const secret = 'a'.repeat(32);
    execSync(
      `${CLI} run -d --rm --name ${CONTAINER_NAME} -p 127.0.0.1:${HOST_PORT}:8090 ` +
        `-e PB_SECRET=${secret} ${PB_IMAGE}`,
      { stdio: 'ignore' },
    );
    const deadline = Date.now() + 60_000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`${PB_URL}/api/health`);
        if (r.ok) { ready = true; break; }
      } catch {}
      execSync('sleep 0.5');
    }
    expect(ready).toBe(true);

    const logs = containerLogs();
    expect(logs).not.toMatch(/FATAL: PB_SECRET/);
    rmContainer();
  }, 120_000);

  it('31-char PB_SECRET: container exits non-zero', async () => {
    rmContainer();
    const secret = 'a'.repeat(31);
    const exitCode = runOnce(
      `run -d --name ${CONTAINER_NAME} -p 127.0.0.1:${HOST_PORT}:8090 ` +
        `-e PB_SECRET=${secret} ${PB_IMAGE}`,
    );
    expect(exitCode).toBe(0);
    const exited = waitForExit(15_000);
    expect(exited).toBe(true);
    const logs = containerLogs();
    expect(logs).toMatch(/FATAL: PB_SECRET must be exactly 32 characters/);
    expect(logs).toMatch(/got 31 characters/);
    rmContainer();
  }, 60_000);
});
