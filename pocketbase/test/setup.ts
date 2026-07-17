import PocketBase from 'pocketbase';
import { afterAll, beforeAll } from 'vitest';

const PB_PORT = 8090;
const PB_URL = `http://localhost:${PB_PORT}`;
const ADMIN_EMAIL = 'admin@test.stjorna.local';
const ADMIN_PASSWORD = 'admin12345678test';

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

    const { stdout } = await execAsync(
      `podman run -d --rm --network=host -v stjorna-test-data:/app/pb_data localhost/stjorna-pocketbase:test`,
      { encoding: 'utf8' }
    );
    containerId = stdout.trim();

    await new Promise(resolve => setTimeout(resolve, 3000));

    let pb: PocketBase;
    let retries = 30;
    while (retries > 0) {
      pb = new PocketBase(PB_URL);
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
      } catch {
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries--;
      }
    }

    throw new Error('Failed to start PocketBase');
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
        { name: 'file', type: 'file', options: { maxSelect: 1, maxSize: 10485760, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'] } },
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
        { name: 'tenant', type: 'text', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'key_hash', type: 'text', required: true },
        { name: 'permissions', type: 'json', options: { maxSize: 2000000 } },
        { name: 'last_used', type: 'date' },
        { name: 'expires', type: 'date' },
      ],
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
    }
  }
}

export async function cleanup(): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  if (containerId) {
    try {
      await execAsync(`podman stop ${containerId} 2>/dev/null || true`);
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