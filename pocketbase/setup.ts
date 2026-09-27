import PocketBase from 'pocketbase';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';

const PB_PORT = 8090;
// PB_URL can be overridden by env so a CI runner with a different
// host (or a test rig using a port-forward) can point us at a
// non-loopback endpoint. Default is the loopback we expose via
// '--network=host' on the container.
//
// T-09 follow-up: the CI workflow sets PB_URL=http://localhost:8090
// by default, but on GitHub Actions ubuntu-latest runners
// 'localhost' resolves to '::1' first (IPv6). PB's
// '--http 0.0.0.0:8090' only binds IPv4, so the IPv6 connection
// times out. To force IPv4 we IGNORE the env var when it points
// at 'localhost' (with or without port) and substitute 127.0.0.1.
// If a real non-loopback host is supplied via env, we honour it.
function resolvePbUrl(envUrl: string | undefined, fallback: string): string {
  if (!envUrl) return fallback;
  // 'localhost' or 'localhost:port' → force IPv4
  try {
    const u = new URL(envUrl);
    if (u.hostname === 'localhost') {
      u.hostname = '127.0.0.1';
      return u.toString();
    }
  } catch {
    // not a parseable URL — leave alone
  }
  return envUrl;
}
const PB_URL = resolvePbUrl(process.env.PB_URL, `http://127.0.0.1:${PB_PORT}`);
const ADMIN_EMAIL = 'admin@test.stjorna.local';
const ADMIN_PASSWORD = 'admin12345678test';
const PB_IMAGE = 'localhost/stjorna-pocketbase:test';
// T-04: the shared container gets a fixed setup token so the bootstrap
// route's token gate can be exercised (tests/setup-bootstrap.test.ts).
export const SETUP_TOKEN = 'vitest-setup-token-0123456789';

// Pick the container runtime. Prefer docker (works on GitHub Actions
// and most Linux desktops); fall back to podman. The integration tests
// spin up a real PocketBase container before the suite runs.
const CONTAINER_CLI = (() => {
  const { execSync } = require('child_process') as typeof import('child_process');
  try {
    execSync('command -v docker', { stdio: 'ignore' });
    return 'docker';
  } catch {
    return 'podman';
  }
})();

let pbInstance: PocketBase | null = null;
let containerId: string | null = null;

class ContainerExitedError extends Error {}

// Vitest globalSetup runs in the main process, but tests run in forked
// workers. Module-level state is not shared, so persist the auth token to
// a temp file that workers can read.
const stateFilePath = (): string =>
  nodePath.resolve(process.cwd(), 'test-results', 'pb-state.json');

function writePbState(token: string, record: unknown): void {
  const dir = nodePath.dirname(stateFilePath());
  if (!nodeFs.existsSync(dir)) nodeFs.mkdirSync(dir, { recursive: true });
  nodeFs.writeFileSync(stateFilePath(), JSON.stringify({ token, record, pbUrl: PB_URL }));
}

function readPbState(): { token: string; record: unknown; pbUrl: string } | null {
  try {
    const raw = nodeFs.readFileSync(stateFilePath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearPbState(): void {
  try {
    nodeFs.unlinkSync(stateFilePath());
  } catch {}
}

export async function startPocketBase(): Promise<PocketBase> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const startContainer = async (): Promise<PocketBase> => {
    await cleanup();

    // With --network=host a second PB can't bind the port and exits, while
    // the health loop below happily talks to whatever is already there.
    // Refuse to run against a leftover instance instead of testing stale hooks.
    const alreadyUp = await fetch(`${PB_URL}/api/health`).then(() => true, () => false);
    if (alreadyUp) {
      throw new Error(
        `${PB_URL} is already serving before the test container started — ` +
        `stop the leftover instance (e.g. \`${CONTAINER_CLI} ps\`) and re-run.`
      );
    }

    let stdout: string;
    try {
      // '--network=host' puts PB on the runner's loopback (works on
      // GitHub-hosted runners and on Linux docker/podman).
      //
      // No '--rm': if PB exits during boot we still want its logs and
      // exit code. cleanup() removes the container (and its anonymous
      // pb_data volume) explicitly.
      const result = await execAsync(
        `${CONTAINER_CLI} run -d --network=host ` +
          `-e PB_SUPERUSER_EMAIL=${ADMIN_EMAIL} ` +
          `-e PB_SUPERUSER_PASSWORD=${ADMIN_PASSWORD} ` +
          `-e STJORNA_SETUP_TOKEN=${SETUP_TOKEN} ` +
          `${PB_IMAGE}`,
        { encoding: 'utf8' },
      );
      stdout = result.stdout;
    } catch (e: any) {
      // Surface the actual container-runtime error instead of letting
      // the 30s health-check loop exhaust with a generic message.
      const stderr = e?.stderr?.toString?.() || e?.message || String(e);
      throw new Error(`Failed to start ${PB_IMAGE} via ${CONTAINER_CLI}: ${stderr.trim()}`);
    }
    containerId = stdout.trim();
    // eslint-disable-next-line no-console
    console.log(`[pb-test] started ${CONTAINER_CLI} container ${containerId.slice(0, 12)}`);

    const containerLogs = async (): Promise<string> => {
      try {
        const { stdout: out, stderr: err } = await execAsync(
          `${CONTAINER_CLI} logs --tail 100 ${containerId}`,
          { encoding: 'utf8' },
        );
        return `${out}${err}`;
      } catch {
        return '';
      }
    };

    // Fail fast when PB dies during boot (bad pb_data permissions,
    // migration crash, PB_SECRET check, …) instead of polling a dead
    // port for the full deadline.
    const assertContainerRunning = async (): Promise<void> => {
      let state = '';
      try {
        const { stdout: out } = await execAsync(
          `${CONTAINER_CLI} inspect --format '{{.State.Running}} {{.State.ExitCode}}' ${containerId}`,
          { encoding: 'utf8' },
        );
        state = out.trim();
      } catch (e: any) {
        state = `inspect failed: ${e?.stderr?.toString?.().trim() || e?.message}`;
      }
      if (state.startsWith('true')) return;
      const logs = await containerLogs();
      throw new ContainerExitedError(
        `PocketBase container exited during startup (${state}).\n` +
        (logs ? `Container logs:\n${logs}` : '(no container logs)')
      );
    };

    // First-boot PocketBase can take a while (especially on CI runners
    // with cold caches), so give it up to 300s. The wait has THREE
    // gates, each of which proves a different aspect of readiness:
    //
    //   1. /api/health responds (PB HTTP server is up).
    //   2. Superuser auth succeeds (PB has bootstrapped the
    //      headless superuser from the env vars passed to
    //      entrypoint.sh; entrypoint.sh runs `pocketbase superuser
    //      upsert` on first boot, guarded by a marker file).
    //   3. The `tenants` collection exists with at least one field
    //      (production migrations have run end-to-end and the schema
    //      is the real schema — not a stub).
    //
    // T-09 dropped the previous `setupCollections()` call that
    // rebuilt the schema in a v0.22-style layout AFTER migrations
    // had already created it. Production migrations are now the
    // single source of truth for the schema. Tests seed DATA, not
    // collections or fields.
    const deadline = Date.now() + 300_000;
    let lastError: unknown = null;
    while (Date.now() < deadline) {
      const pb = new PocketBase(PB_URL);
      try {
        await assertContainerRunning();

        // Raw fetch (instead of pb.health.check()) so we get a real
        // error message instead of the SDK's "Something went wrong."
        // generic catch.
        const healthRes = await fetch(`${PB_URL}/api/health`);
        if (!healthRes.ok) throw new Error(`health ${healthRes.status}`);

        const authRes = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
        });
        if (!authRes.ok) {
          const body = await authRes.text();
          throw new Error(`Admin auth failed ${authRes.status}: ${body}`);
        }
        const authData = await authRes.json();
        pb.authStore.save(authData.token, authData.record);

        // Gate 3: confirm at least one production-migration-managed
        // collection is reachable. `tenants` is created by the
        // very first collection-creation migration
        // (`1740000000_create_core_collections.js`); if it isn't
        // there yet, the migrations haven't finished.
        const tenants = await pb.collections.getOne('tenants').catch(() => null);
        if (!tenants) {
          throw new Error('migrations incomplete: tenants collection missing');
        }

        writePbState(authData.token, authData.record);
        pbInstance = pb;
        return pbInstance;
      } catch (e) {
        if (e instanceof ContainerExitedError) throw e;
        lastError = e;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    const logs = await containerLogs();
    throw new Error(
      `Failed to start PocketBase: ${PB_URL} not healthy after 300s.\n` +
      `  Last error: ${detail}\n` +
      (logs ? `Container logs:\n${logs}` : '')
    );
  };

  return await startContainer();
}

async function _legacySetupCollectionsRemovedInT09(_pb: PocketBase): Promise<void> {
  // T-09: removed. Production migrations in pb_migrations/*.js are the
  // single source of truth for the schema. The previous
  // setupCollections rebuilt the schema in a v0.22-style layout
  // AFTER migrations had already created it — every field was either
  // a duplicate (last_tenant, roles, user_tenants, api_keys, …) or
  // subtly different (text tenant field on categories/products/media
  // instead of a relation, which never actually fired because PB
  // v0.40 silently drops text fields on auth-collection users).
  // Tests now seed DATA via the createTenantFixture / createCategoryFixture
  // helpers, not schema. See `tests/helpers/fixtures.ts`.
  // Kept as a named stub so any future caller that looks at git
  // history finds a clear "this is where the v0.22 rebuild lived".
}

export async function cleanup(): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  if (containerId) {
    try {
      // -v also drops the anonymous pb_data volume (no --rm on run).
      await execAsync(`${CONTAINER_CLI} rm -f -v ${containerId} 2>/dev/null || true`);
    } catch {}
    containerId = null;
  }

  pbInstance = null;
  clearPbState();
}

export function getPb(): PocketBase {
  if (!pbInstance) {
    const state = readPbState();
    if (!state) {
      throw new Error('PocketBase not initialized. Call startPocketBase() first.');
    }
    pbInstance = new PocketBase(state.pbUrl);
    pbInstance.authStore.save(state.token, state.record as any);
  }
  return pbInstance;
}

export function getPbUrl(): string {
  return PB_URL;
}

export function getTestAdminCredentials(): { email: string; password: string } {
  return { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
}