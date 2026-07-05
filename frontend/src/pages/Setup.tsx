import { createSignal, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import PocketBase from 'pocketbase';
import { checkHasAdmins } from '~/stores/auth';

type Step = 'connect' | 'admin' | 'collections' | 'tenant' | 'link' | 'done';

const collectionsToCreate = [
  {
    name: 'tenants',
    schema: [
      { name: 'name', type: 'text', required: true },
      { name: 'slug', type: 'text', required: true },
      { name: 'plan', type: 'select', options: { values: ['free', 'starter', 'professional', 'enterprise'], maxSelect: 1 } },
      { name: 'custom_domain', type: 'text' },
      { name: 'theme_config', type: 'json', options: { maxSize: 2000000 } },
    ],
    listRule: '@request.auth.admin = true || @request.auth.id != ""',
    viewRule: '@request.auth.admin = true || @request.auth.id != ""',
    createRule: null,
    updateRule: '@request.auth.admin = true',
    deleteRule: '@request.auth.admin = true',
  },
  {
    name: 'categories',
    schema: [
      { name: 'tenant', type: 'relation', options: { collectionId: 'tenants', maxSelect: 1, cascadeDelete: false } },
      { name: 'name', type: 'text', required: true },
      { name: 'slug', type: 'text', required: true },
      { name: 'description', type: 'text' },
      { name: 'active', type: 'bool' },
      { name: 'sort_order', type: 'number' },
    ],
    listRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
    viewRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
    createRule: '',
    updateRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
    deleteRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
  },
  {
    name: 'products',
    schema: [
      { name: 'tenant', type: 'relation', options: { collectionId: 'tenants', maxSelect: 1, cascadeDelete: false } },
      { name: 'category', type: 'relation', options: { collectionId: 'categories', maxSelect: 1, cascadeDelete: false } },
      { name: 'name', type: 'text', required: true },
      { name: 'slug', type: 'text', required: true },
      { name: 'price', type: 'number' },
      { name: 'description', type: 'editor' },
      { name: 'images', type: 'file', options: { maxSelect: 99, maxSize: 10485760, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] } },
      { name: 'active', type: 'bool' },
      { name: 'sort_order', type: 'number' },
      { name: 'custom_fields', type: 'json', options: { maxSize: 2000000 } },
    ],
    listRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
    viewRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
    createRule: '',
    updateRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
    deleteRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
  },
  {
    name: 'media',
    schema: [
      { name: 'tenant', type: 'relation', options: { collectionId: 'tenants', maxSelect: 1, cascadeDelete: false } },
      { name: 'filename', type: 'text', required: true },
      { name: 'original_name', type: 'text' },
      { name: 'mime_type', type: 'text' },
      { name: 'size', type: 'number' },
      { name: 'width', type: 'number' },
      { name: 'height', type: 'number' },
      { name: 's3_key', type: 'text' },
      { name: 's3_url', type: 'url' },
      { name: 'thumbnail_url', type: 'url' },
      { name: 'usage_count', type: 'number' },
      { name: 'createdUser', type: 'relation', options: { collectionId: '_pb_users_auth_', maxSelect: 1, cascadeDelete: false } },
    ],
    listRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
    viewRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
    createRule: '',
    updateRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
    deleteRule: '@request.auth.admin = true || @request.auth.user_tenants.any(tenant.id = tenant.id)',
  },
  {
    name: 'user_tenants',
    schema: [
      { name: 'user', type: 'relation', options: { collectionId: '_pb_users_auth_', maxSelect: 1, cascadeDelete: false } },
      { name: 'tenant', type: 'relation', options: { collectionId: 'tenants', maxSelect: 1, cascadeDelete: false } },
      { name: 'role', type: 'select', options: { values: ['viewer', 'editor', 'admin'], maxSelect: 1 } },
    ],
    listRule: '@request.auth.admin = true || user.id = @request.auth.id',
    viewRule: '@request.auth.admin = true || user.id = @request.auth.id',
    createRule: '',
    updateRule: '@request.auth.admin = true || (user.id = @request.auth.id && role = "admin")',
    deleteRule: '@request.auth.admin = true || (user.id = @request.auth.id && role = "admin")',
  },
  {
    name: 'instance_settings',
    schema: [
      { name: 'instance_name', type: 'text' },
      { name: 'instance_url', type: 'text' },
      { name: 'instance_logo_url', type: 'url' },
      { name: 'instance_tagline', type: 'text' },
      { name: 'setup_done', type: 'bool' },
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: '@request.auth.admin = true',
    deleteRule: null,
  },
];

async function ensureCollections(pb: PocketBase): Promise<void> {
  const existing = await pb.collections.getFullList({ perPage: 200 });
  const existingNames = new Set(existing.map(c => c.name.toLowerCase()));

  const phase1Names = ['tenants'];
  const phase2Names = ['categories', 'products', 'media', 'user_tenants'];
  const phase3Names = ['instance_settings'];

  let tenantsId: string | null = null;

  for (const name of phase1Names) {
    if (!existingNames.has(name)) {
      const col = collectionsToCreate.find(c => c.name === name)!;
      try {
        const created = await pb.collections.create(col);
        if (name === 'tenants') tenantsId = created.id;
      } catch (e: any) {
        console.warn(`Failed to create ${name}:`, JSON.stringify(e.data, null, 2));
      }
    } else {
      const col = await pb.collections.getFirstListItem(`name="${name}"`);
      if (name === 'tenants') tenantsId = col.id;
    }
  }

  if (!tenantsId) {
    console.warn('Could not get tenants collection ID');
    return;
  }

  const usersId = (await pb.collections.getOne('_pb_users_auth_')).id;

  const replaceCollectionId = (col: any): any => {
    return {
      ...col,
      schema: col.schema.map((field: any) => {
        if (field.type === 'relation' && field.options?.collectionId) {
          let targetId = field.options.collectionId;
          if (targetId === 'tenants') targetId = tenantsId!;
          if (targetId === '_pb_users_auth_') targetId = usersId;
          return {
            ...field,
            options: { ...field.options, collectionId: targetId },
          };
        }
        return field;
      }),
    };
  };

  for (const name of phase2Names) {
    if (!existingNames.has(name)) {
      const colTemplate = collectionsToCreate.find(c => c.name === name)!;
      const col = replaceCollectionId(colTemplate);
      try {
        await pb.collections.create(col);
      } catch (e: any) {
        if (e.status !== 400) console.warn(`Failed to create ${name}:`, e.message);
      }
    }
  }

  for (const name of phase3Names) {
    if (!existingNames.has(name)) {
      const col = collectionsToCreate.find(c => c.name === name)!;
      try {
        await pb.collections.create(col);
      } catch (e: any) {
        if (e.status !== 400) console.warn(`Failed to create ${name}:`, e.message);
      }
    }
  }
}

async function ensureUsersLastTenantField(pb: PocketBase): Promise<void> {
  try {
    const usersCollection = await pb.collections.getOne('_pb_users_auth_');
    const hasLastTenant = usersCollection.schema.some(f => f.name === 'last_tenant');
    if (!hasLastTenant) {
      const updatedSchema = [
        ...usersCollection.schema,
        { name: 'last_tenant', type: 'text' },
      ];
      await pb.collections.update(usersCollection.id, { schema: updatedSchema });
    }
  } catch (e: any) {
    console.warn('Failed to update users collection:', e.message);
  }
}

export default function Setup() {
  const navigate = useNavigate();

  onMount(async () => {
    const savedUrl = localStorage.getItem('stjorna_pb_url');
    if (savedUrl) {
      try {
        const checkPb = new PocketBase(savedUrl);
        try {
          const settings = await checkPb.collection('instance_settings').getList(1, 1);
          if (settings.items.length > 0 && settings.items[0].setup_done === true) {
            navigate('/login', { replace: true });
            return;
          }
        } catch (e: any) {
          if (e.status !== 404) console.warn('Setup check warning:', e.message);
        }
      } catch {}
    }
  });

  const [step, setStep] = createSignal<Step>('connect');
  const [pbUrl, setPbUrl] = createSignal('http://localhost:8090');
  const [adminEmail, setAdminEmail] = createSignal('');
  const [adminPassword, setAdminPassword] = createSignal('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = createSignal('');
  const [tenantName, setTenantName] = createSignal('Default Company');
  const [tenantSlug, setTenantSlug] = createSignal('default-company');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const pb = new PocketBase(pbUrl());
      await pb.health.check();

      const hasAdmins = await checkHasAdmins.call({ pb } as any);
      if (hasAdmins) {
        setStep('admin');
      } else {
        setStep('admin');
      }
    } catch (e: any) {
      setError(`Cannot connect to PocketBase at ${pbUrl()}: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    setLoading(true);
    setError('');
    try {
      const pb = new PocketBase(pbUrl());

      try {
        await pb.admins.create({
          email: adminEmail(),
          password: adminPassword(),
          passwordConfirm: adminPasswordConfirm(),
        });
      } catch (e: any) {
        if (e.status !== 400) throw e;
      }

      await pb.admins.authWithPassword(adminEmail(), adminPassword());
      await ensureCollections(pb);
      await ensureUsersLastTenantField(pb);
      setStep('tenant');
    } catch (e: any) {
      setError(e.message || 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    setLoading(true);
    setError('');
    try {
      const pb = new PocketBase(pbUrl());
      await pb.admins.authWithPassword(adminEmail(), adminPassword());
      const tenant = await pb.collection('tenants').create({
        name: tenantName(),
        slug: tenantSlug(),
        plan: 'starter',
      });
      setStep('link');
      (window as any).__setupTenantId = tenant.id;
      (window as any).__setupTenantSlug = tenantSlug();
    } catch (e: any) {
      setError(e.message || 'Failed to create tenant');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkAdmin = async () => {
    setLoading(true);
    setError('');
    try {
      const pb = new PocketBase(pbUrl());
      await pb.admins.authWithPassword(adminEmail(), adminPassword());
      const tenants = await pb.collection('tenants').getList(1, 1, {
        filter: `slug = "${(window as any).__setupTenantSlug}"`,
      });
      if (tenants.items.length === 0) throw new Error('Tenant not found');

      let adminUser: any;
      try {
        const existingUsers = await pb.collection('users').getList(1, 1, {
          filter: `email = "${adminEmail()}"`,
        });
        if (existingUsers.items.length > 0) {
          adminUser = existingUsers.items[0];
        }
      } catch {}

      if (!adminUser) {
        adminUser = await pb.collection('users').create({
          email: adminEmail(),
          password: adminPassword(),
          passwordConfirm: adminPasswordConfirm(),
          name: 'Admin',
        });
      }

      await pb.collection('user_tenants').create({
        user: adminUser.id,
        tenant: tenants.items[0].id,
        role: 'admin',
      });

      const existingSettings = await pb.collection('instance_settings').getList(1, 1).catch(() => null);
      if (existingSettings && existingSettings.items.length > 0) {
        await pb.collection('instance_settings').update(existingSettings.items[0].id, { setup_done: true });
      } else {
        await pb.collection('instance_settings').create({ setup_done: true });
      }

      localStorage.setItem('stjorna_pb_url', pbUrl());
      setStep('done');
      setTimeout(() => navigate('/login'), 1500);
    } catch (e: any) {
      setError(e.message || 'Failed to link admin to tenant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div class="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-white mb-2">STJÓRNA</h1>
          <p class="text-gray-400">First-time setup</p>
        </div>

        <div class="mb-6">
          <div class="flex justify-between text-xs text-gray-500 mb-2">
            <span class={['connect', 'admin', 'collections', 'tenant', 'link'].includes(step()) ? 'text-blue-400' : ''}>1. Connect</span>
            <span class={['admin', 'collections', 'tenant', 'link'].includes(step()) ? 'text-blue-400' : ''}>2. Admin</span>
            <span class={['collections', 'tenant', 'link'].includes(step()) ? 'text-blue-400' : ''}>3. Schema</span>
            <span class={['tenant', 'link'].includes(step()) ? 'text-blue-400' : ''}>4. Tenant</span>
            <span class={step() === 'link' ? 'text-blue-400' : ''}>5. Link</span>
          </div>
          <div class="h-1 bg-gray-700 rounded">
            <div
              class="h-1 bg-blue-500 rounded transition-all duration-300"
              style={{ width: step() === 'connect' ? '20%' : step() === 'admin' ? '40%' : step() === 'collections' ? '60%' : step() === 'tenant' ? '80%' : step() === 'link' ? '100%' : '100%' }}
            />
          </div>
        </div>

        <Show when={step() === 'connect'}>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">PocketBase URL</label>
              <input
                type="url"
                value={pbUrl()}
                onInput={(e) => setPbUrl(e.currentTarget.value)}
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                placeholder="http://localhost:8090"
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={loading()}
              class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {loading() ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </Show>

        <Show when={step() === 'admin'}>
          <div class="space-y-4">
            <p class="text-gray-400 text-sm mb-4">Enter your admin credentials:</p>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Admin Email</label>
              <input
                type="email"
                value={adminEmail()}
                onInput={(e) => setAdminEmail(e.currentTarget.value)}
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <input
                type="password"
                value={adminPassword()}
                onInput={(e) => setAdminPassword(e.currentTarget.value)}
                autocomplete="new-password"
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
              <input
                type="password"
                value={adminPasswordConfirm()}
                autocomplete="new-password"
                onInput={(e) => setAdminPasswordConfirm(e.currentTarget.value)}
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleCreateAdmin}
              disabled={loading() || !adminEmail() || !adminPassword() || adminPassword() !== adminPasswordConfirm()}
              class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {loading() ? 'Setting up...' : 'Continue'}
            </button>
          </div>
        </Show>

        <Show when={step() === 'tenant'}>
          <div class="space-y-4">
            <p class="text-gray-400 text-sm mb-4">Create your first tenant:</p>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Company Name</label>
              <input
                type="text"
                value={tenantName()}
                onInput={(e) => setTenantName(e.currentTarget.value)}
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Slug</label>
              <input
                type="text"
                value={tenantSlug()}
                onInput={(e) => setTenantSlug(e.currentTarget.value.toLowerCase().replace(/\s+/g, '-'))}
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleCreateTenant}
              disabled={loading() || !tenantName() || !tenantSlug()}
              class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {loading() ? 'Creating...' : 'Create Tenant'}
            </button>
          </div>
        </Show>

        <Show when={step() === 'link'}>
          <div class="space-y-4">
            <p class="text-gray-400 text-sm mb-4">Linking admin to tenant...</p>
            <button
              onClick={handleLinkAdmin}
              disabled={loading()}
              class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {loading() ? 'Linking...' : 'Complete Setup'}
            </button>
          </div>
        </Show>

        <Show when={step() === 'done'}>
          <div class="text-center">
            <p class="text-green-400 text-lg mb-4">Setup complete!</p>
            <p class="text-gray-400 text-sm">Redirecting to login...</p>
          </div>
        </Show>

        <Show when={error()}>
          <p class="text-red-400 text-sm mt-4">{error()}</p>
        </Show>
      </div>
    </div>
  );
}