import { exec } from 'child_process';
import { promisify } from 'util';
import PocketBase from 'pocketbase';

const execAsync = promisify(exec);

const PB_PORT = 8090;
const PB_URL = `http://localhost:${PB_PORT}`;
const FRONTEND_URL = 'http://localhost:4173';
const ADMIN_EMAIL = 'admin@test.stjorna.local';
const ADMIN_PASSWORD = 'admin12345678test';
const REGULAR_USER_EMAIL = 'user@test.stjorna.local';
const REGULAR_USER_PASSWORD = 'user12345678test';

let containerId: string | null = null;
export let pb: PocketBase;

export async function startPBContainer(): Promise<PocketBase> {
  await cleanup();

  console.log('[Setup] Starting fresh PocketBase container...');
  const { stdout } = await execAsync(
    `podman run -d --rm --network=host localhost/stjorna-pocketbase:test`,
    { encoding: 'utf8' }
  );
  containerId = stdout.trim();
  console.log('[Setup] Container started:', containerId);

  await new Promise(resolve => setTimeout(resolve, 8000));

  try {
    const { stdout: execOut } = await execAsync(
      `podman exec ${containerId} ./pocketbase admin create ${ADMIN_EMAIL} ${ADMIN_PASSWORD}`,
      { encoding: 'utf8' }
    );
    console.log('[Setup] Admin create:', execOut.trim());
  } catch (e: any) {
    console.warn('[Setup] admin create warning:', e.stderr?.trim() || e.message);
  }

  let retries = 20;
  while (retries > 0) {
    const testPb = new PocketBase(PB_URL);
    try {
      await testPb.health.check();
      console.log('[Setup] PocketBase health check passed');

      const authResponse = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });

      if (!authResponse.ok) {
        const errBody = await authResponse.text();
        throw new Error(`Admin auth failed ${authResponse.status}: ${errBody}`);
      }

      const authData = await authResponse.json();
      testPb.authStore.save(authData.token, authData.admin);
      console.log('[Setup] Admin authenticated via fetch');

      await setupCollections(testPb);
      await setupInstanceSettings(testPb);
      await setupTestTenantAndUser(testPb);

      pb = testPb;
      console.log('[Setup] PocketBase setup complete');
      return pb;
    } catch (e: any) {
      console.warn('[Setup] retry:', retries, e.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries--;
    }
  }

  throw new Error('Failed to start PocketBase');
}

async function setupCollections(pb: PocketBase): Promise<void> {
  const existing = await pb.collections.getFullList({ perPage: 200 });
  const existingNames = new Set(existing.map(c => c.name.toLowerCase()));

  const collections = [
    {
      name: 'tenants',
      type: 'base' as const,
      schema: [
        { name: 'name', type: 'text' as const, required: true },
        { name: 'slug', type: 'text' as const, required: true },
        { name: 'plan', type: 'select' as const, options: { values: ['free', 'starter', 'professional', 'enterprise'], maxSelect: 1 } },
        { name: 'custom_domain', type: 'text' as const },
        { name: 'theme_config', type: 'json' as const, options: { maxSize: 2000000 } },
      ],
      listRule: '@request.auth.admin = true || @request.auth.id != ""',
      viewRule: '@request.auth.admin = true || @request.auth.id != ""',
      createRule: null,
      updateRule: '@request.auth.admin = true',
      deleteRule: '@request.auth.admin = true',
    },
    {
      name: 'categories',
      type: 'base' as const,
      schema: [
        { name: 'tenant', type: 'relation' as const, options: { collectionId: '_TENANTS_ID_', maxSelect: 1, cascadeDelete: false } },
        { name: 'name', type: 'text' as const, required: true },
        { name: 'slug', type: 'text' as const, required: true },
        { name: 'description', type: 'text' as const },
        { name: 'active', type: 'bool' as const },
        { name: 'sort_order', type: 'number' as const },
      ],
      listRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
      viewRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
      createRule: '',
      updateRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
      deleteRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
    },
    {
      name: 'products',
      type: 'base' as const,
      schema: [
        { name: 'tenant', type: 'relation' as const, options: { collectionId: '_TENANTS_ID_', maxSelect: 1, cascadeDelete: false } },
        { name: 'category', type: 'relation' as const, options: { collectionId: '_CATEGORIES_ID_', maxSelect: 1, cascadeDelete: false } },
        { name: 'name', type: 'text' as const, required: true },
        { name: 'slug', type: 'text' as const, required: true },
        { name: 'price', type: 'number' as const },
        { name: 'description', type: 'editor' as const },
        { name: 'images', type: 'file' as const, options: { maxSelect: 99, maxSize: 10485760, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] } },
        { name: 'active', type: 'bool' as const },
        { name: 'sort_order', type: 'number' as const },
        { name: 'custom_fields', type: 'json' as const, options: { maxSize: 2000000 } },
      ],
      listRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
      viewRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
      createRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
      updateRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
      deleteRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
    },
    {
      name: 'media',
      type: 'base' as const,
      schema: [
        { name: 'tenant', type: 'relation' as const, options: { collectionId: '_TENANTS_ID_', maxSelect: 1, cascadeDelete: false } },
        { name: 'filename', type: 'text' as const, required: true },
        { name: 'original_name', type: 'text' as const },
        { name: 'mime_type', type: 'text' as const },
        { name: 'size', type: 'number' as const },
        { name: 'width', type: 'number' as const },
        { name: 'height', type: 'number' as const },
        { name: 's3_key', type: 'text' as const },
        { name: 's3_url', type: 'url' as const },
        { name: 'thumbnail_url', type: 'url' as const },
        { name: 'usage_count', type: 'number' as const },
        { name: 'createdUser', type: 'relation' as const, options: { collectionId: '_pb_users_auth_', maxSelect: 1, cascadeDelete: false } },
      ],
      listRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
      viewRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
      createRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
      updateRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
      deleteRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
    },
    {
      name: 'user_tenants',
      type: 'base' as const,
      schema: [
        { name: 'user', type: 'relation' as const, options: { collectionId: '_pb_users_auth_', maxSelect: 1, cascadeDelete: false } },
        { name: 'tenant', type: 'relation' as const, options: { collectionId: '_TENANTS_ID_', maxSelect: 1, cascadeDelete: false } },
        { name: 'role', type: 'select' as const, options: { values: ['viewer', 'editor', 'admin'], maxSelect: 1 } },
      ],
      listRule: '@request.auth.admin = true || user.id = @request.auth.id',
      viewRule: '@request.auth.admin = true || user.id = @request.auth.id',
      createRule: null,
      updateRule: '@request.auth.admin = true || (@request.auth.user_tenants.user.id = @request.auth.id && @request.auth.user_tenants.role = "admin")',
      deleteRule: '@request.auth.admin = true || (@request.auth.user_tenants.user.id = @request.auth.id && @request.auth.user_tenants.role = "admin")',
    },
    {
      name: 'instance_settings',
      type: 'base' as const,
      schema: [
        { name: 'instance_name', type: 'text' as const },
        { name: 'instance_url', type: 'text' as const },
        { name: 'instance_logo_url', type: 'url' as const },
        { name: 'instance_tagline', type: 'text' as const },
        { name: 'setup_done', type: 'bool' as const },
      ],
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: '@request.auth.admin = true',
      deleteRule: null,
    },
  ];

  const phase1 = ['tenants'];
  const phase2 = ['categories', 'products', 'media', 'user_tenants'];
  const phase3 = ['instance_settings'];

  let tenantsId: string | null = null;

  for (const name of phase1) {
    if (!existingNames.has(name)) {
      const col = collections.find(c => c.name === name)!;
      const created = await pb.collections.create(col);
      if (name === 'tenants') tenantsId = created.id;
      console.log(`[Setup] Created collection: ${name}`);
    } else {
      const col = await pb.collections.getFirstListItem(`name="${name}"`);
      if (name === 'tenants') tenantsId = col.id;
    }
  }

  if (!tenantsId) throw new Error('Could not get tenants collection ID');
  const usersId = (await pb.collections.getOne('_pb_users_auth_')).id;

  let categoriesId = tenantsId;
  if (existingNames.has('categories')) {
    const catCol = await pb.collections.getFirstListItem('name="categories"');
    categoriesId = catCol.id;
  }

  const replaceIds = (col: any): any => ({
    ...col,
    schema: col.schema.map((field: any) => {
      if (field.type === 'relation' && field.options?.collectionId) {
        let targetId = field.options.collectionId;
        if (targetId === '_TENANTS_ID_') targetId = tenantsId!;
        if (targetId === '_CATEGORIES_ID_') targetId = categoriesId;
        if (targetId === '_pb_users_auth_') targetId = usersId;
        return { ...field, options: { ...field.options, collectionId: targetId } };
      }
      return field;
    }),
  });

  for (const name of phase2) {
    if (!existingNames.has(name)) {
      const colTemplate = collections.find(c => c.name === name)!;
      await pb.collections.create(replaceIds(colTemplate));
      console.log(`[Setup] Created collection: ${name}`);
    }
  }

  for (const name of phase3) {
    if (!existingNames.has(name)) {
      const col = collections.find(c => c.name === name)!;
      await pb.collections.create(col);
      console.log(`[Setup] Created collection: ${name}`);
    }
  }

  const usersCol = await pb.collections.getOne('_pb_users_auth_');
  const hasLastTenant = usersCol.schema.some((f: any) => f.name === 'last_tenant');
  if (!hasLastTenant) {
    await pb.collections.update(usersCol.id, {
      schema: [...usersCol.schema, { name: 'last_tenant', type: 'text' }],
    });
    console.log('[Setup] Added last_tenant field to users');
  }
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
  const tenant = await pb.collection('tenants').create({
    name: 'Test Company',
    slug: 'test-company',
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

  await pb.collection('user_tenants').create({
    user: testUserId,
    tenant: testTenantId,
    role: 'admin',
  });

  await pb.collection('categories').create({
    tenant: testTenantId,
    name: 'Test Category',
    slug: 'test-category',
    description: 'A test category',
    active: true,
    sort_order: 1,
  });

  await pb.collection('media').create({
    tenant: testTenantId,
    filename: 'test-image.jpg',
    original_name: 'test-image.jpg',
    mime_type: 'image/jpeg',
    size: 12345,
    usage_count: 0,
  });

  console.log('[Setup] Test tenant and user ready');
}

export async function cleanup(): Promise<void> {
  if (containerId) {
    try {
      await execAsync(`podman stop ${containerId} 2>/dev/null || true`);
      console.log('[Teardown] Container stopped');
    } catch {}
    containerId = null;
  }
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
    tenantId: null as string | null,
    userId: testUserId,
  };
}

export function getTenantId() {
  return testTenantId;
}

export default async function globalSetup() {
  await startPBContainer();
}