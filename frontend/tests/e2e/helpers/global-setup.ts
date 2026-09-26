import { exec } from 'child_process';
import { promisify } from 'util';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import PocketBase from 'pocketbase';

const execAsync = promisify(exec);

const PB_PORT = 8090;
const PB_URL = `http://localhost:${PB_PORT}`;
const FRONTEND_URL = 'http://localhost:4173';
const ADMIN_EMAIL = 'admin@test.stjorna.local';
const ADMIN_PASSWORD = 'admin12345678test';
const REGULAR_USER_EMAIL = 'user@test.stjorna.local';
const REGULAR_USER_PASSWORD = 'user12345678test';
const PB_IMAGE = 'localhost/stjorna-pocketbase:test';
// Mirrors backend tests/setup.ts — the shared container gets a fixed
// setup token so the bootstrap route's token gate can be exercised.
const SETUP_TOKEN = 'vitest-setup-token-0123456789';

// Pick the container runtime. Prefer docker (works on GitHub Actions
// and most Linux desktops), fall back to podman (the historical default).
const CONTAINER_CLI = (() => {
  try {
    execSync('command -v docker', { stdio: 'ignore' });
    return 'docker';
  } catch {
    return 'podman';
  }
})();
// Hoist execSync into scope for the IIFE above.
import { execSync } from 'node:child_process';

let containerId: string | null = null;
export let pb: PocketBase;

export async function startPBContainer(): Promise<PocketBase> {
  await cleanup();

  console.log('[Setup] Starting fresh PocketBase container...');

  // Refuse to run against a leftover instance — would silently talk to
  // a stale container with different hooks.
  const alreadyUp = await fetch(`${PB_URL}/api/health`).then(() => true, () => false);
  if (alreadyUp) {
    throw new Error(
      `${PB_URL} is already serving before the test container started — ` +
      `stop the leftover instance (e.g. \`${CONTAINER_CLI} ps\`) and re-run.`,
    );
  }

  // Bootstrap pattern: pass the headless superuser creds via env so
  // entrypoint.sh runs `pocketbase superuser upsert` on first boot
  // (guarded by a marker file). This is the production path — no
  // more `pocketbase admin create` (removed in v0.22) and no more
  // `/api/admins/auth-with-password` (removed in v0.22).
  const { stdout } = await execAsync(
    `${CONTAINER_CLI} run -d --rm --network=host ` +
      `-e PB_SUPERUSER_EMAIL=${ADMIN_EMAIL} ` +
      `-e PB_SUPERUSER_PASSWORD=${ADMIN_PASSWORD} ` +
      `-e STJORNA_SETUP_TOKEN=${SETUP_TOKEN} ` +
      `${PB_IMAGE}`,
    { encoding: 'utf8' },
  );
  containerId = stdout.trim();
  console.log('[Setup] Container started:', containerId);

  // Wait for PB: health endpoint AND a real schema managed by the
  // production migrations. Mirrors backend setup.ts (T-09).
  const deadline = Date.now() + 180_000;
  let lastError: unknown = null;
  let testPb: PocketBase | null = null;
  while (Date.now() < deadline) {
    testPb = new PocketBase(PB_URL);
    try {
      await testPb.health.check();

      // PB v0.40 superuser auth lives under /api/collections/_superusers.
      const authRes = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });
      if (!authRes.ok) {
        const errBody = await authRes.text();
        throw new Error(`Admin auth failed ${authRes.status}: ${errBody}`);
      }
      const authData = await authRes.json();
      testPb.authStore.save(authData.token, authData.record);

      // Confirm migrations finished: a production-managed collection
      // must be reachable. `tenants` is created by
      // 1740000000_create_core_collections.js.
      const tenants = await testPb.collections.getOne('tenants').catch(() => null);
      if (!tenants) {
        throw new Error('migrations incomplete: tenants collection missing');
      }

      console.log('[Setup] PocketBase health + migrations verified');

      await setupInstanceSettings(testPb);
      await setupTestTenantAndUser(testPb);

      pb = testPb;
      console.log('[Setup] PocketBase setup complete');
      return pb;
    } catch (e: any) {
      lastError = e;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Dump the container log on failure so CI shows WHY PB never came up.
  let logs = '';
  if (containerId) {
    try {
      const { stdout: logOut } = await execAsync(
        `${CONTAINER_CLI} logs --tail 100 ${containerId}`,
        { encoding: 'utf8' },
      );
      logs = logOut;
    } catch {}
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Failed to start PocketBase: ${PB_URL} not healthy after 180s. Last error: ${detail}\n` +
      (logs ? `Container logs:\n${logs}` : ''),
  );
}

async function setupInstanceSettings(pb: PocketBase): Promise<void> {
  try {
    const existing = await pb.collection('instance_settings').getList(1, 1);
    if (existing.items.length > 0) {
      await pb.collection('instance_settings').update(existing.items[0].id, { setup_done: true });
    } else {
      await pb.collection('instance_settings').create({ setup_done: true });
    }
    console.log('[Setup] instance_settings ready');
  } catch (e: any) {
    console.warn('[Setup] instance_settings error:', e.message);
  }
}

let testTenantId: string | null = null;
let testUserId: string | null = null;

async function setupTestTenantAndUser(pb: PocketBase): Promise<void> {
  // Production schema (1740000000_create_core_collections.js +
  // 1750000000_add_oidc_support.js + later migrations) — no custom
  // rebuild. The previous setupCollections overrode the production
  // rules with test-only rules; that was hiding real auth/rule
  // behavior from the e2e suite.
  const tenant = await pb.collection('tenants').create({
    name: 'Test Company',
    slug: 'test-company-' + Date.now(),
    plan: 'starter',
  });
  testTenantId = tenant.id;

  let testUser: any;
  try {
    const existing = await pb.collection('users').getList(1, 1, {
      filter: `email = "${REGULAR_USER_EMAIL}"`,
    });
    if (existing.items.length > 0) {
      testUser = existing.items[0];
    }
  } catch {}

  if (!testUser) {
    testUser = await pb.collection('users').create({
      email: REGULAR_USER_EMAIL,
      password: REGULAR_USER_PASSWORD,
      passwordConfirm: REGULAR_USER_PASSWORD,
      name: 'Test User',
    });
  }
  testUserId = testUser.id;

  // admin role for the user_tenants row — production FK integrity.
  const adminRole = await pb.collection('roles').getFirstListItem('name="admin"');

  await pb.collection('user_tenants').create({
    user: testUserId,
    tenant: testTenantId,
    role: adminRole.id,
  });

  await pb.collection('categories').create({
    tenant: testTenantId,
    name: 'Test Category',
    slug: 'test-category-' + Date.now(),
    description: 'A test category',
    active: true,
    sort_order: 1,
  });

  // 1x1 transparent PNG. PB sanitises the filename; the returned
  // record.file is what the URL builder needs.
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const pngBuffer = Buffer.from(pngBase64, 'base64');
  const testFile = new File([pngBuffer], 'test-image.png', { type: 'image/png' });
  const form = new FormData();
  form.append('file', testFile);
  form.append('filename', 'test-image.png');
  form.append('original_name', 'test-image.png');
  form.append('mime_type', 'image/png');
  form.append('size', String(pngBuffer.length));
  form.append('width', '1');
  form.append('height', '1');
  form.append('usage_count', '0');
  form.append('tenant', testTenantId);

  await pb.collection('media').create(form);

  console.log('[Setup] Test tenant and user ready');
}

export async function cleanup(): Promise<void> {
  if (containerId) {
    try {
      await execAsync(`${CONTAINER_CLI} stop ${containerId} 2>/dev/null || true`);
      console.log('[Teardown] Container stopped');
    } catch {}
    containerId = null;
  }
  clearE2EState();
  pb = undefined as any;
}

export function getTestCredentials() {
  return {
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
    userEmail: REGULAR_USER_EMAIL,
    userPassword: REGULAR_USER_PASSWORD,
    pbUrl: PB_URL,
    frontendUrl: FRONTEND_URL,
    tenantId: testTenantId,
    userId: testUserId,
  };
}

export function getTenantId() {
  // Worker processes don't see the module-level var set in global-setup
  // (main process). Fall back to the file written by writeE2EState().
  if (testTenantId) return testTenantId;
  return readE2EState().tenantId;
}

// Playwright runs global-setup in the main process and tests in worker
// processes; module-level state set in main is not visible in workers.
// Persist the bits tests need (tenantId, userId) to a file so workers can
// read them. The file lives under test-results/ (gitignored) and is removed
// on teardown.
const stateFilePath = (): string =>
  nodePath.resolve(process.cwd(), 'test-results', 'e2e-state.json');

export function writeE2EState(): void {
  const dir = nodePath.dirname(stateFilePath());
  if (!nodeFs.existsSync(dir)) nodeFs.mkdirSync(dir, { recursive: true });
  nodeFs.writeFileSync(
    stateFilePath(),
    JSON.stringify({ tenantId: testTenantId, userId: testUserId, containerId }, null, 2),
  );
}

export function readE2EState(): {
  tenantId: string | null;
  userId: string | null;
  containerId: string | null;
} {
  try {
    const raw = nodeFs.readFileSync(stateFilePath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { tenantId: null, userId: null, containerId: null };
  }
}

export function clearE2EState(): void {
  try {
    nodeFs.unlinkSync(stateFilePath());
  } catch {}
}

export default async function globalSetup() {
  await startPBContainer();
  writeE2EState();
}
