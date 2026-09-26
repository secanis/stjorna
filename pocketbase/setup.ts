import PocketBase from 'pocketbase';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';

const PB_PORT = 8090;
// PB_URL can be overridden by env so a CI runner with a different
// host (or a test rig using a port-forward) can point us at a
// non-loopback endpoint. Default is the loopback we expose via
// '-p 127.0.0.1:8090:8090' on the container.
const PB_URL = process.env.PB_URL || `http://localhost:${PB_PORT}`;
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
      // `-p 127.0.0.1:8090:8090` is more portable across CI runners
      // than `--network=host` (some sandboxed Docker setups restrict
      // the host network namespace but allow port-mapping). We also
      // bind explicitly to the loopback so another PB instance on the
      // host can't accidentally be probed instead.
      const result = await execAsync(
        `${CONTAINER_CLI} run -d --rm -p 127.0.0.1:8090:8090 ` +
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

    // Dump the container's IP right after start. On some CI runners
    // (sandboxed Docker, GitHub Actions Docker-in-Docker) the host
    // loopback is unreachable from the test process, so we have to
    // hit the container's bridge IP directly. We try PB_URL first
    // (the configured URL) and fall back to the bridge IP.
    let containerIP = '';
    try {
      const { stdout: ipOut } = await execAsync(
        `${CONTAINER_CLI} inspect --format '{{.NetworkSettings.IPAddress}}' ${containerId}`,
        { encoding: 'utf8' },
      );
      containerIP = ipOut.trim();
      console.log(`[pb-test] container IP: ${containerIP || '<none>'}`);
    } catch {}
    const candidateURLs = [PB_URL, containerIP ? `http://${containerIP}:8090` : ''].filter(Boolean);

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
    let workingURL = '';
    while (Date.now() < deadline) {
      const pb = new PocketBase(workingURL || PB_URL);
      try {
        // Try every candidate URL until one responds. Most local
        // runs succeed on PB_URL; CI may need the container IP.
        if (!workingURL) {
          for (const url of candidateURLs) {
            try {
              const r = await fetch(`${url}/api/health`);
              if (r.ok) { workingURL = url; break; }
            } catch {}
          }
          if (!workingURL) throw new Error('no candidate URL responded to /api/health');
        }

        // Raw fetch (instead of pb.health.check()) so we get a real
        // error message instead of the SDK's "Something went wrong."
        // generic catch.
        const healthRes = await fetch(`${workingURL}/api/health`);
        if (!healthRes.ok) throw new Error(`health ${healthRes.status}`);

        const authRes = await fetch(`${workingURL}/api/collections/_superusers/auth-with-password`, {
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
        // Persist the working URL so forked workers (if any) hit the
        // same endpoint.
        if (workingURL !== PB_URL) {
          process.env.PB_URL = workingURL;
        }
        return pbInstance;
      } catch (e) {
        lastError = e;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    let logs = '';
    if (containerId) {
      try {
        const { stdout } = await execAsync(`${CONTAINER_CLI} logs --tail 100 ${containerId}`, { encoding: 'utf8' });
        logs = stdout;
      } catch {}
    }
    // Final dump: which URLs did we try?
    const triedURLs = candidateURLs.join(', ');
    throw new Error(
      `Failed to start PocketBase: not healthy after 300s.\n` +
      `  Tried URLs: ${triedURLs}\n` +
      `  Container IP: ${containerIP || '<none>'}\n` +
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
      await execAsync(`${CONTAINER_CLI} stop ${containerId} 2>/dev/null || true`);
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