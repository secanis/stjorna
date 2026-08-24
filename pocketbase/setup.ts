import PocketBase from 'pocketbase';
import { afterAll, beforeAll } from 'vitest';

const PB_PORT = 8090;
const PB_URL = `http://localhost:${PB_PORT}`;
const ADMIN_EMAIL = 'admin@test.stjorna.local';
const ADMIN_PASSWORD = 'admin12345678test';
const PB_IMAGE = 'localhost/stjorna-pocketbase:test';
const PB_VOLUME = 'stjorna-test-data';

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

export async function startPocketBase(): Promise<PocketBase> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const ensureAdminAuth = async (pb: PocketBase): Promise<boolean> => {
    try {
      await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    } catch (e: any) {
      if (e.status === 401 || e.message?.includes('fetch failed')) {

        return false;
      }
      if (e.status !== 400) throw e;
    }
    return true;
  };

  const tryConnect = async (): Promise<PocketBase | null> => {
    const pb = new PocketBase(PB_URL);
    try {
      await pb.health.check();
      const canAuth = await ensureAdminAuth(pb);
      if (canAuth) return pb;
    } catch {
    }
    return null;
  };

  const startContainer = async (): Promise<PocketBase> => {
    await cleanup();

    let stdout: string;
    try {
      const result = await execAsync(
        `${CONTAINER_CLI} run -d --rm --network=host -v ${PB_VOLUME}:/app/pb_data ${PB_IMAGE}`,
        { encoding: 'utf8' }
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

    // First-boot PocketBase can take a while (especially on CI runners
    // with cold caches) to create the initial superuser, so give it
    // up to 60s.
    const deadline = Date.now() + 60_000;
    let lastError: unknown = null;
    while (Date.now() < deadline) {
      const pb = new PocketBase(PB_URL);
      try {
        await pb.health.check();
        try {
          await pb.admins.create({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            passwordConfirm: ADMIN_PASSWORD,
          });
        } catch {
        }
        await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
        pbInstance = pb;
        await setupCollections(pbInstance);
        return pbInstance;
      } catch (e) {
        lastError = e;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Failed to start PocketBase: ${PB_URL} not healthy after 60s. Last error: ${detail}`);
  };

  try {
    const existingPb = await tryConnect();
    if (existingPb) {
      pbInstance = existingPb;
      return pbInstance;
    }
  } catch {
  }

  return await startContainer();
}

async function setupCollections(pb: PocketBase): Promise<void> {
  const collections = [
    {
      name: 'tenants',
      type: 'base',
      schema: [
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'plan', type: 'select', options: { values: ['free', 'starter', 'professional', 'enterprise'], maxSelect: 1 } },
        { name: 'custom_domain', type: 'text' },
        { name: 'theme_config', type: 'json', options: { maxSize: 2000000 } },
      ],
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    },
    {
      name: 'categories',
      type: 'base',
      schema: [
        { name: 'tenant', type: 'text', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'sort_order', type: 'number' },
        // The `media` relation is added by resolveRelationPlaceholders() below,
        // after the `media` collection exists. Declaring it here with a real
        // collectionId would fail on first run because `media` is defined later.
      ],
      listRule: '@request.auth.tenant = tenant',
      viewRule: '@request.auth.tenant = tenant',
      createRule: '@request.auth.tenant = tenant',
      updateRule: '@request.auth.tenant = tenant',
      deleteRule: '@request.auth.tenant = tenant',
    },
    {
      name: 'products',
      type: 'base',
      schema: [
        { name: 'tenant', type: 'text', required: true },
        { name: 'category', type: 'text' },
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'price', type: 'number' },
        { name: 'description', type: 'editor' },
        { name: 'media', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'sort_order', type: 'number' },
        { name: 'custom_fields', type: 'json', options: { maxSize: 2000000 } },
      ],
      listRule: '@request.auth.tenant = tenant',
      viewRule: '@request.auth.tenant = tenant',
      createRule: '@request.auth.tenant = tenant',
      updateRule: '@request.auth.tenant = tenant',
      deleteRule: '@request.auth.id != ""',
    },
    {
      name: 'media',
      type: 'base',
      schema: [
        { name: 'tenant', type: 'text', required: true },
        { name: 'file', type: 'file', options: { maxSelect: 1, maxSize: 524288000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'] } },
        { name: 'filename', type: 'text' },
        { name: 'original_name', type: 'text' },
        { name: 'mime_type', type: 'text' },
        { name: 'size', type: 'number' },
        { name: 'width', type: 'number' },
        { name: 'height', type: 'number' },
        { name: 's3_key', type: 'text' },
        { name: 's3_url', type: 'url' },
        { name: 'thumbnail_url', type: 'url' },
        { name: 'usage_count', type: 'number' },
        { name: 'createdUser', type: 'text' },
      ],
      listRule: '@request.auth.tenant = tenant',
      viewRule: '@request.auth.tenant = tenant',
      createRule: '@request.auth.tenant = tenant',
      updateRule: '@request.auth.tenant = tenant',
      deleteRule: '@request.auth.id != ""',
    },
    {
      name: 'product_media',
      type: 'base',
      schema: [
        { name: 'tenant', type: 'text', required: true },
        { name: 'product', type: 'text', required: true },
        { name: 'media', type: 'text', required: true },
        { name: 'sort_order', type: 'number' },
      ],
      listRule: '@request.auth.tenant = tenant',
      viewRule: '@request.auth.tenant = tenant',
      createRule: '@request.auth.tenant = tenant',
      updateRule: '@request.auth.tenant = tenant',
      deleteRule: '@request.auth.tenant = tenant',
    },
    {
      name: 'embed_configs',
      type: 'base',
      schema: [
        { name: 'tenant', type: 'text', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'embed_code', type: 'text' },
        { name: 'allowed_domains', type: 'json', options: { maxSize: 2000000 } },
        { name: 'active', type: 'bool' },
      ],
    },
    {
      name: 'analytics_events',
      type: 'base',
      schema: [
        { name: 'tenant', type: 'text', required: true },
        { name: 'media', type: 'text' },
        { name: 'product', type: 'text' },
        { name: 'embed_config', type: 'text' },
        { name: 'domain', type: 'text' },
        { name: 'referer', type: 'text' },
        { name: 'client_ip', type: 'text' },
        { name: 'user_agent', type: 'text' },
        { name: 'timestamp', type: 'date' },
      ],
    },
    {
      name: 'webhooks',
      type: 'base',
      schema: [
        { name: 'tenant', type: 'text', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'url', type: 'url', required: true },
        { name: 'events', type: 'json', options: { maxSize: 2000000 } },
        { name: 'secret', type: 'text' },
        { name: 'active', type: 'bool' },
      ],
    },
    {
      name: 'api_keys',
      type: 'base',
      schema: [
        { name: 'tenant', type: 'text', required: true, options: { min: 1, maxLen: 100 } },
        { name: 'name', type: 'text', required: true, options: { min: 1, maxLen: 200 } },
        { name: 'prefix', type: 'text', required: true, options: { min: 1, maxLen: 32, pattern: '^[a-zA-Z0-9_]+$' } },
        { name: 'key_hash', type: 'text', required: true, options: { min: 1, maxLen: 256 } },
        { name: 'permissions', type: 'json', options: { maxSize: 4096 } },
        { name: 'last_used', type: 'date' },
        { name: 'expires', type: 'date' },
        { name: 'revoked', type: 'bool' },
        { name: 'created_by', type: 'text', options: { maxLen: 100 } },
      ],
      // All four rules locked to null: access is exclusively through
      // the admin-only custom routes registered in pb_hooks/api_keys.pb.js.
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    },
    {
      name: 'users',
      type: 'base',
      schema: [
        { name: 'tenant', type: 'text', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'password', type: 'text', required: true },
        { name: 'role', type: 'select', options: { values: ['viewer', 'editor', 'admin'], maxSelect: 1 } },
      ],
      listRule: '@request.auth.tenant = tenant',
      viewRule: '@request.auth.tenant = tenant',
      createRule: null,
      updateRule: '@request.auth.id = id || @request.auth.tenant = tenant',
      deleteRule: '@request.auth.tenant = tenant',
    },
    {
      name: 'settings',
      type: 'base',
      schema: [
        { name: 'tenant', type: 'text', required: true },
        { name: 'config_json', type: 'json', options: { maxSize: 2000000 } },
      ],
    },
    {
      name: 'instance_settings',
      type: 'base',
      schema: [
        { name: 'instance_name', type: 'text' },
        { name: 'instance_url', type: 'text' },
        { name: 'instance_logo_url', type: 'url' },
        { name: 'instance_tagline', type: 'text' },
        { name: 'setup_done', type: 'bool' },
        { name: 'storage_type', type: 'text' },
        { name: 's3_bucket', type: 'text' },
        { name: 's3_region', type: 'text' },
        { name: 's3_endpoint', type: 'text' },
        { name: 's3_access_key', type: 'text' },
        { name: 's3_secret_key', type: 'text' },
        { name: 's3_force_path_style', type: 'bool' },
        { name: 'storage_configured', type: 'bool' },
      ],
    },
  ];

  const existing = await pb.collections.getFullList({ perPage: 200 });
  const existingNames = existing.map(c => c.name.toLowerCase());

  for (const col of collections) {
    if (!existingNames.includes(col.name.toLowerCase())) {
      try {
        await pb.collections.create(col);
      } catch (e: any) {
        if (e.status !== 400) throw e;
      }
    } else {
      // Collection exists — patch in any new fields it doesn't have yet.
      // This keeps the test setup idempotent as the schema evolves.
      try {
        const existingCol = await pb.collections.getFirstListItem(`name="${col.name}"`);
        const existingFieldNames = new Set(existingCol.schema.map((f: any) => f.name));
        const newFields = col.schema.filter((f: any) => !existingFieldNames.has(f.name));
        if (newFields.length > 0) {
          await pb.collections.update(existingCol.id, {
            schema: [...existingCol.schema, ...newFields],
          });
        }
      } catch {
        // best-effort: don't fail the test on patch errors
      }
    }
  }

  // Roles collection — STJÓRN A tracks role as a text slug on user_tenants,
  // but the e2e harness uses a proper `roles` collection for FK integrity.
  // Mirror the same shape here so the test infra matches production.
  if (!existingNames.includes('roles')) {
    try {
      await pb.collections.create({
        name: 'roles',
        type: 'base',
        schema: [{ name: 'name', type: 'text', required: true }],
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      });
      await pb.collection('roles').create({ name: 'viewer' });
      await pb.collection('roles').create({ name: 'editor' });
      await pb.collection('roles').create({ name: 'admin' });
    } catch {
    }
  }

  // Patch `last_tenant` onto the built-in auth collection — same as the
  // e2e global-setup does. The auth record's last_tenant is STJÓRN A's
  // tiebreaker for users in multiple tenants (see auth.ts:switchTenant).
  // We also patch `tenant` here so STJÓRN A's test rules
  // (`@request.auth.tenant = tenant`) can actually fire against auth
  // users — without this, PB silently drops every non-auth field on
  // create and the rules always evaluate to false.
  try {
    const authCol = await pb.collections.getOne('_pb_users_auth_');
    const fields = (authCol.schema || []).map((f: any) => f.name);
    const additions: any[] = [];
    if (!fields.includes('last_tenant')) additions.push({ name: 'last_tenant', type: 'text' });
    if (!fields.includes('tenant'))      additions.push({ name: 'tenant',      type: 'text' });
    if (additions.length > 0) {
      await pb.collections.update(authCol.id, {
        schema: [...authCol.schema, ...additions],
      });
    }
  } catch {
    // best-effort
  }

  // Second pass: resolve `_COLLECTION_ID_` placeholders in relation fields.
  // The first pass may have failed to create a relation because the target
  // collection didn't exist yet (e.g. `categories.media` → `media`).
  await resolveRelationPlaceholders(pb);
}

// Add the `media` relation field to categories after both collections exist.
// Categories couldn't declare it inline because the `media` collection is
// declared later in the array and PB rejects relations to non-existent targets.
async function resolveRelationPlaceholders(pb: PocketBase): Promise<void> {
  const all = await pb.collections.getFullList({ perPage: 200 });
  const byName = new Map<string, string>();
  for (const c of all) byName.set(c.name, c.id);

  // 1. Add `media` to categories if it isn't there yet
  const categories = byName.get('categories');
  const media = byName.get('media');
  if (categories && media) {
    try {
      const cat = all.find((c) => c.name === 'categories')!;
      if (!cat.schema.some((f: any) => f.name === 'media')) {
        await pb.collections.update(cat.id, {
          schema: [
            ...cat.schema,
            { name: 'media', type: 'relation', options: { collectionId: media, maxSelect: 1, cascadeDelete: false } },
          ],
        });
      }
    } catch {
      // best-effort
    }
  }
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
}

export function getPb(): PocketBase {
  if (!pbInstance) {
    throw new Error('PocketBase not initialized. Call startPocketBase() first.');
  }
  return pbInstance;
}

export function getPbUrl(): string {
  return PB_URL;
}

export function getTestAdminCredentials(): { email: string; password: string } {
  return { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
}

beforeAll(async () => {
  await startPocketBase();
}, 60000);

afterAll(async () => {
  await cleanup();
});