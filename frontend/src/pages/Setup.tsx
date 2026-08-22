import { createSignal, Show, onMount, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import PocketBase from 'pocketbase';
import { checkHasAdmins } from '~/stores/auth';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';

type Step = 'connect' | 'admin' | 'storage' | 'collections' | 'tenant' | 'link' | 'done';

const collectionsToCreate = [
  {
    name: 'roles',
    schema: [
      { name: 'name', type: 'text', required: true },
    ],
    listRule: '@request.auth.admin = true',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.admin = true',
    updateRule: '@request.auth.admin = true',
    deleteRule: '@request.auth.admin = true',
  },
  {
    name: 'tenants',
    schema: [
      { name: 'name', type: 'text', required: true },
      { name: 'slug', type: 'text', required: true },
      { name: 'plan', type: 'select', options: { values: ['free', 'starter', 'professional', 'enterprise'], maxSelect: 1 } },
      { name: 'custom_domain', type: 'text' },
      { name: 'theme_config', type: 'json', options: { maxSize: 2000000 } },
      { name: 'users', type: 'relation', options: { collectionId: '_pb_users_auth_', maxSelect: 99, cascadeDelete: false } },
    ],
    listRule: '',
    viewRule: '@request.auth.id != ""',
    createRule: '',
    updateRule: '',
    deleteRule: '',
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
      { name: 'media', type: 'relation', options: { collectionId: 'media', maxSelect: 1, cascadeDelete: false } },
    ],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != "" || @request.auth.admin = true',
    deleteRule: '@request.auth.id != "" || @request.auth.admin = true',
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
      { name: 'media', type: 'relation', options: { collectionId: 'media', maxSelect: 99, cascadeDelete: false } },
      { name: 'active', type: 'bool' },
      { name: 'sort_order', type: 'number' },
      { name: 'custom_fields', type: 'json', options: { maxSize: 2000000 } },
    ],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != "" || @request.auth.admin = true',
    deleteRule: '@request.auth.id != "" || @request.auth.admin = true',
  },
  {
    name: 'media',
    schema: [
      { name: 'tenant', type: 'relation', options: { collectionId: 'tenants', maxSelect: 1, cascadeDelete: false } },
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
      { name: 'createdUser', type: 'relation', options: { collectionId: '_pb_users_auth_', maxSelect: 1, cascadeDelete: false } },
    ],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != "" || @request.auth.admin = true',
    deleteRule: '@request.auth.id != "" || @request.auth.admin = true',
  },
  {
    name: 'user_tenants',
    schema: [
      { name: 'user', type: 'relation', options: { collectionId: '_pb_users_auth_', maxSelect: 1, cascadeDelete: false } },
      { name: 'tenant', type: 'relation', options: { collectionId: 'tenants', maxSelect: 1, cascadeDelete: false } },
      { name: 'role', type: 'relation', options: { collectionId: 'roles', maxSelect: 1, cascadeDelete: false } },
    ],
    listRule: '@request.auth.admin = true || user.id = @request.auth.id',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.admin = true',
    updateRule: '@request.auth.admin = true',
    deleteRule: '@request.auth.admin = true',
  },
  {
    name: 'instance_settings',
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

  const phase1Names = ['roles', 'tenants', 'media'];
  const phase2Names = ['categories', 'products', 'user_tenants'];
  const phase3Names = ['instance_settings'];

  const usersId = (await pb.collections.getOne('_pb_users_auth_')).id;

  let tenantsId: string | null = null;
  let rolesId: string | null = null;
  let mediaId: string | null = null;
  let categoriesId: string | null = null;

  // Resolve placeholder names in relation fields (`tenants`, `_pb_users_auth_`,
  // `roles`, `categories`, `media`, `products`) to real collection IDs. Only
  // replaces when the target ID is known — fields that reference collections
  // not yet created are left with their string name for PB to resolve.
  const replaceCollectionId = (col: any): any => ({
    ...col,
    schema: col.schema.map((field: any) => {
      if (field.type !== 'relation' || !field.options?.collectionId) return field;
      const name = field.options.collectionId;
      let targetId: string | null = null;
      if (name === 'tenants' && tenantsId) targetId = tenantsId;
      else if (name === '_pb_users_auth_' && usersId) targetId = usersId;
      else if (name === 'roles' && rolesId) targetId = rolesId;
      else if (name === 'categories' && categoriesId) targetId = categoriesId;
      else if (name === 'media' && mediaId) targetId = mediaId;
      if (targetId) {
        return { ...field, options: { ...field.options, collectionId: targetId } };
      }
      return field;
    }),
  });

  for (const name of phase1Names) {
    if (!existingNames.has(name)) {
      const colTemplate = collectionsToCreate.find(c => c.name === name)!;
      const col = replaceCollectionId(colTemplate);
      try {
        const created = await pb.collections.create(col);
        console.log(`[Setup] Created collection: ${name}`);
        if (name === 'tenants') tenantsId = created.id;
        if (name === 'roles') rolesId = created.id;
        if (name === 'media') mediaId = created.id;
      } catch (e: any) {
        console.warn(`[Setup] Failed to create ${name}:`, e.status, JSON.stringify(e.data));
      }
    } else {
      const col = await pb.collections.getFirstListItem(`name="${name}"`);
      if (name === 'tenants') tenantsId = col.id;
      if (name === 'roles') rolesId = col.id;
      if (name === 'media') mediaId = col.id;
    }
  }

  if (!rolesId) {
    console.warn('Could not get roles collection ID');
    return;
  }

  if (!existingNames.has('roles')) {
    await pb.collection('roles').create({ name: 'viewer' });
    await pb.collection('roles').create({ name: 'editor' });
    await pb.collection('roles').create({ name: 'admin' });
    console.log('[Setup] Created default roles');
  }

  if (!tenantsId) {
    console.warn('Could not get tenants collection ID');
    return;
  }

  for (const name of phase2Names) {
    if (!existingNames.has(name)) {
      const colTemplate = collectionsToCreate.find(c => c.name === name)!;
      const col = replaceCollectionId(colTemplate);
      try {
        const created = await pb.collections.create(col);
        console.log(`[Setup] Created collection: ${name}`);
        if (name === 'categories') categoriesId = created.id;
      } catch (e: any) {
        console.warn(`[Setup] Failed to create ${name}:`, e.status, JSON.stringify(e.data));
      }
    }
  }

  for (const name of phase3Names) {
    if (!existingNames.has(name)) {
      const col = collectionsToCreate.find(c => c.name === name)!;
      try {
        await pb.collections.create(col);
        console.log(`[Setup] Created collection: ${name}`);
      } catch (e: any) {
        console.warn(`[Setup] Failed to create ${name}:`, e.status, JSON.stringify(e.data));
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
    const envUrl = (import.meta.env.VITE_PB_URL as string | undefined)?.replace(/\/+$/, '');
    const initialUrl = envUrl || '';
    if (initialUrl) {
      try {
        const checkPb = new PocketBase(initialUrl);
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
  const [pbUrl, setPbUrl] = createSignal(
    ((import.meta.env.VITE_PB_URL as string | undefined)?.replace(/\/+$/, '') || 'http://localhost:8090')
  );
  const [adminEmail, setAdminEmail] = createSignal('');
  const [adminPassword, setAdminPassword] = createSignal('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = createSignal('');
  const [storageType, setStorageType] = createSignal<'local' | 's3'>('local');
  const [s3Bucket, setS3Bucket] = createSignal('');
  const [s3Region, setS3Region] = createSignal('');
  const [s3Endpoint, setS3Endpoint] = createSignal('');
  const [s3AccessKey, setS3AccessKey] = createSignal('');
  const [s3SecretKey, setS3SecretKey] = createSignal('');
  const [s3ForcePathStyle, setS3ForcePathStyle] = createSignal(false);
  const [s3TestStatus, setS3TestStatus] = createSignal<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [s3TestMessage, setS3TestMessage] = createSignal('');
  const [s3TestPassed, setS3TestPassed] = createSignal(false);
  const [tenantName, setTenantName] = createSignal('Default Company');
  const [tenantSlug, setTenantSlug] = createSignal('default-company');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const isS3Valid = () => {
    if (storageType() !== 's3') return true;
    return !!(s3Bucket() && s3Region() && s3Endpoint() && s3AccessKey() && s3SecretKey());
  };

  const resolvedS3Endpoint = () => {
    const e = s3Endpoint().trim();
    if (e) return e;
    const r = s3Region().trim();
    if (r) return `https://s3.${r}.amazonaws.com`;
    return '';
  };

  createEffect(() => {
    if (storageType() !== 's3') return;
    const r = s3Region();
    const e = s3Endpoint();
    if (r && !e) {
      setS3Endpoint(`https://s3.${r}.amazonaws.com`);
    }
  });

  const saveS3Settings = async (pb: PocketBase) => {
    await pb.settings.update({
      s3: {
        enabled: true,
        bucket: s3Bucket(),
        region: s3Region(),
        endpoint: resolvedS3Endpoint(),
        accessKey: s3AccessKey(),
        secret: s3SecretKey(),
        forcePathStyle: s3ForcePathStyle(),
      },
    });
  };

  // 1x1 transparent PNG (67 bytes) — base64-encoded.
  // Must use an allowed mime type (image/png) so the media collection's file
  // field accepts it.
  const TINY_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const handleTestS3 = async () => {
    if (!isS3Valid()) return;
    setS3TestStatus('testing');
    setS3TestMessage('');
    setS3TestPassed(false);
    const testPb = new PocketBase(pbUrl());
    let testRecordId: string | null = null;
    try {
      await testPb.admins.authWithPassword(adminEmail(), adminPassword());
      await saveS3Settings(testPb);

      const ts = Date.now();
      const testFilename = `__stjorna_s3_test__${ts}.png`;

      const binary = atob(TINY_PNG_BASE64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const testFile = new File([bytes], testFilename, { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', testFile);
      formData.append('filename', testFilename);
      formData.append('original_name', testFilename);
      formData.append('mime_type', 'image/png');
      formData.append('size', String(testFile.size));

      let testRecord: any;
      try {
        testRecord = await testPb.collection('media').create(formData);
        testRecordId = testRecord.id;
      } catch (e: any) {
        throw new Error(`Upload to S3 failed: ${categorizeS3Error(e)}`);
      }

      const fileUrl = `${pbUrl()}/api/files/media/${testRecord.id}/${testRecord.file}`;
      let fileRes: Response;
      try {
        fileRes = await fetch(fileUrl, {
          headers: { Authorization: testPb.authStore.token },
        });
      } catch (e: any) {
        throw new Error(`Could not reach S3 file URL: ${e?.message || e}`);
      }
      if (!fileRes.ok) {
        throw new Error(`S3 file not accessible: HTTP ${fileRes.status}`);
      }

      try {
        await testPb.collection('media').delete(testRecord.id);
        testRecordId = null;
      } catch (e: any) {
        setS3TestStatus('success');
        setS3TestMessage(
          `S3 connection verified. Test record (id: ${testRecord.id}) was created but could not be auto-deleted — please delete it from the media list.`
        );
        setS3TestPassed(true);
        return;
      }

      setS3TestStatus('success');
      setS3TestMessage(
        `S3 connection verified (bucket: ${s3Bucket()}, region: ${s3Region()}, endpoint: ${resolvedS3Endpoint()}). Continue to finish setup.`
      );
      setS3TestPassed(true);
    } catch (e: any) {
      setS3TestStatus('error');
      setS3TestMessage(categorizeS3Error(e));
      if (testRecordId) {
        try {
          await testPb.collection('media').delete(testRecordId);
        } catch {}
      }
    }
  };

  const categorizeS3Error = (e: any): string => {
    const data = e?.data;
    if (data && typeof data === 'object') {
      const fileErr = data.file;
      if (fileErr && typeof fileErr === 'object') {
        if (fileErr.code === 'validation_invalid_mime_type') {
          return 'Test file mime type not allowed by the media collection. (This is a wizard bug, not your S3.)';
        }
        if (fileErr.code === 'validation_required') {
          return 'Test file is missing. (This is a wizard bug.)';
        }
        if (fileErr.message) {
          return `File validation failed: ${fileErr.message}`;
        }
      }
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (val && typeof val === 'object' && val.message) {
          return `${key}: ${val.message}`;
        }
      }
    }

    const raw = e?.message || 'S3 test failed';
    const lower = raw.toLowerCase();
    if (lower.includes('failed to authenticate') || lower.includes('invalidaccesskeyid') || lower.includes('signaturedoesnotmatch')) {
      return 'Could not authenticate. Check your access key and secret key.';
    }
    if (lower.includes('no such bucket') || lower.includes('nosuchbucket')) {
      return 'Bucket does not exist. Check the bucket name.';
    }
    if (lower.includes('access denied') || lower.includes('accessdenied')) {
      return 'Access denied. Check the IAM permissions for the access key (needs s3:PutObject, s3:GetObject, s3:DeleteObject).';
    }
    if (lower.includes('no such endpoint') || lower.includes('nosuchendpoint') || lower.includes('could not resolve')) {
      return 'Endpoint URL is invalid or unreachable. Check the endpoint and region.';
    }
    if (lower.includes('something went wrong')) {
      return `S3 request failed (PocketBase returned a generic error). Check credentials, bucket, region, endpoint, and IAM permissions. (${raw})`;
    }
    if (lower.includes('http 4') || lower.includes('http 5')) {
      return `S3 returned an error. Check credentials, bucket, region, endpoint, and IAM permissions. (${raw})`;
    }
    return raw;
  };

  const buildStorageConfig = () => {
    if (storageType() !== 's3') {
      return {
        storage_type: 'local',
        s3_bucket: '',
        s3_region: '',
        s3_endpoint: '',
        s3_access_key: '',
        s3_secret_key: '',
        s3_force_path_style: false,
      };
    }
    return {
      storage_type: 's3',
      s3_bucket: s3Bucket(),
      s3_region: s3Region(),
      s3_endpoint: resolvedS3Endpoint(),
      s3_access_key: s3AccessKey(),
      s3_secret_key: s3SecretKey(),
      s3_force_path_style: s3ForcePathStyle(),
    };
  };

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
      setStep('storage');
    } catch (e: any) {
      setError(e.message || 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureStorage = async () => {
    setError('');
    if (!isS3Valid()) {
      setError('Please fill in all required S3 fields');
      return;
    }
    if (storageType() === 's3') {
      try {
        const pb = new PocketBase(pbUrl());
        await pb.admins.authWithPassword(adminEmail(), adminPassword());
        await saveS3Settings(pb);
      } catch (e: any) {
        setError(`Could not save S3 settings: ${e?.message || e}`);
        return;
      }
    }
    setStep('tenant');
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

      const adminRole = await pb.collection('roles').getFirstListItem('name="admin"');

      await pb.collection('user_tenants').create({
        user: adminUser.id,
        tenant: tenants.items[0].id,
        role: adminRole.id,
      });

      const existingSettings = await pb.collection('instance_settings').getList(1, 1).catch(() => null);
      const storageConfig = buildStorageConfig();
      if (existingSettings && existingSettings.items.length > 0) {
        await pb.collection('instance_settings').update(existingSettings.items[0].id, {
          setup_done: true,
          ...storageConfig,
        });
      } else {
        await pb.collection('instance_settings').create({
          setup_done: true,
          ...storageConfig,
        });
      }

      setStep('done');
      setTimeout(() => navigate('/login'), 1500);
    } catch (e: any) {
      setError(e.message || 'Failed to link admin to tenant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">STJÓRNA</h1>
          <p class="text-gray-500 dark:text-gray-400">First-time setup</p>
        </div>

        <div class="mb-6">
          <div class="flex justify-between text-xs text-gray-600 dark:text-gray-500 mb-2">
            <span class={['connect', 'admin', 'storage', 'collections', 'tenant', 'link'].includes(step()) ? 'text-blue-600 dark:text-blue-400' : ''}>1. Connect</span>
            <span class={['admin', 'storage', 'collections', 'tenant', 'link'].includes(step()) ? 'text-blue-600 dark:text-blue-400' : ''}>2. Admin</span>
            <span class={['storage', 'collections', 'tenant', 'link'].includes(step()) ? 'text-blue-600 dark:text-blue-400' : ''}>3. Storage</span>
            <span class={['collections', 'tenant', 'link'].includes(step()) ? 'text-blue-600 dark:text-blue-400' : ''}>4. Schema</span>
            <span class={['tenant', 'link'].includes(step()) ? 'text-blue-600 dark:text-blue-400' : ''}>5. Tenant</span>
            <span class={step() === 'link' ? 'text-blue-600 dark:text-blue-400' : ''}>6. Link</span>
          </div>
          <div class="h-1 bg-gray-50 dark:bg-gray-700 rounded">
            <div
              class="h-1 bg-blue-500 rounded transition-all duration-300"
              style={{
                width: step() === 'connect' ? '16%'
                  : step() === 'admin' ? '32%'
                  : step() === 'storage' ? '48%'
                  : step() === 'collections' ? '64%'
                  : step() === 'tenant' ? '80%'
                  : '100%'
              }}
            />
          </div>
        </div>

        <Show when={step() === 'connect'}>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PocketBase URL</label>
              <input
                type="url"
                value={pbUrl()}
                onInput={(e) => setPbUrl(e.currentTarget.value)}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                placeholder="http://localhost:8090"
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={loading()}
              class="w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {loading() ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </Show>

        <Show when={step() === 'admin'}>
          <div class="space-y-4">
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">Enter your admin credentials:</p>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Admin Email</label>
              <input
                type="email"
                value={adminEmail()}
                onInput={(e) => setAdminEmail(e.currentTarget.value)}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <input
                type="password"
                value={adminPassword()}
                onInput={(e) => setAdminPassword(e.currentTarget.value)}
                autocomplete="new-password"
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
              <input
                type="password"
                value={adminPasswordConfirm()}
                autocomplete="new-password"
                onInput={(e) => setAdminPasswordConfirm(e.currentTarget.value)}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleCreateAdmin}
              disabled={loading() || !adminEmail() || !adminPassword() || adminPassword() !== adminPasswordConfirm()}
              class="w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {loading() ? 'Setting up...' : 'Continue'}
            </button>
          </div>
        </Show>

        <Show when={step() === 'storage'}>
          <div class="space-y-4">
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-2">Choose how STJÓRNA should store uploaded files:</p>

            <div class="space-y-2">
              <label class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                <input
                  type="radio"
                  name="storage"
                  checked={storageType() === 'local'}
                  onChange={() => setStorageType('local')}
                  class="mt-1"
                />
                <div class="flex-1">
                  <div class="text-gray-900 dark:text-white font-medium text-sm">Local filesystem (default)</div>
                  <div class="text-gray-500 dark:text-gray-400 text-xs mt-1">
                    Files are stored inside the PocketBase container at <code class="text-gray-700 dark:text-gray-300">pb_data/storage/</code>.
                    Best for development. Make sure to mount a volume in production to persist data.
                  </div>
                </div>
              </label>

              <label class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                <input
                  type="radio"
                  name="storage"
                  checked={storageType() === 's3'}
                  onChange={() => setStorageType('s3')}
                  class="mt-1"
                />
                <div class="flex-1">
                  <div class="text-gray-900 dark:text-white font-medium text-sm">S3 (or S3-compatible)</div>
                  <div class="text-gray-500 dark:text-gray-400 text-xs mt-1">
                    Files are stored in an S3 bucket. Works with AWS S3, Cloudflare R2, Backblaze B2, MinIO, etc.
                    Requires restart of PocketBase after setup.
                  </div>
                </div>
              </label>
            </div>

            <Show when={storageType() === 's3'}>
              <div class="space-y-3 pl-4 border-l-2 border-blue-500">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="s3-bucket">Bucket *</label>
                  <input
                    id="s3-bucket"
                    type="text"
                    value={s3Bucket()}
                    onInput={(e) => { setS3Bucket(e.currentTarget.value); setS3TestPassed(false); }}
                    placeholder="my-bucket"
                    class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="s3-region">Region *</label>
                  <input
                    id="s3-region"
                    type="text"
                    value={s3Region()}
                    onInput={(e) => { setS3Region(e.currentTarget.value); setS3TestPassed(false); }}
                    placeholder="eu-central-1"
                    class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="s3-endpoint">Endpoint *</label>
                  <input
                    id="s3-endpoint"
                    type="text"
                    value={s3Endpoint()}
                    onInput={(e) => { setS3Endpoint(e.currentTarget.value); setS3TestPassed(false); }}
                    placeholder="https://s3.eu-central-1.amazonaws.com"
                    required
                    class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <p class="text-gray-600 dark:text-gray-500 text-xs mt-1">Auto-filled from region for AWS, override for R2 / B2 / MinIO</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="s3-access-key">Access Key *</label>
                  <input
                    id="s3-access-key"
                    type="text"
                    value={s3AccessKey()}
                    onInput={(e) => { setS3AccessKey(e.currentTarget.value); setS3TestPassed(false); }}
                    class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="s3-secret-key">Secret Key *</label>
                  <input
                    id="s3-secret-key"
                    type="password"
                    value={s3SecretKey()}
                    onInput={(e) => { setS3SecretKey(e.currentTarget.value); setS3TestPassed(false); }}
                    autocomplete="new-password"
                    class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={s3ForcePathStyle()}
                    onChange={(e) => { setS3ForcePathStyle(e.currentTarget.checked); setS3TestPassed(false); }}
                  />
                  Force path-style addressing (MinIO, local S3)
                </label>
              </div>

              <div class="pl-4 border-l-2 border-blue-500 space-y-2">
                <button
                  type="button"
                  onClick={handleTestS3}
                  disabled={!isS3Valid() || s3TestStatus() === 'testing'}
                  class="w-full bg-gray-100 dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50"
                  data-testid="s3-test-btn"
                >
                  {s3TestStatus() === 'testing' ? 'Testing…' : 'Verify S3 settings'}
                </button>
                <Show when={s3TestStatus() === 'success'}>
                  <div
                    data-testid="s3-test-success"
                    class="bg-green-500/10 border border-green-500 rounded p-2 text-green-700 dark:text-green-300 text-xs"
                  >
                    {s3TestMessage()}
                  </div>
                </Show>
                <Show when={s3TestStatus() === 'error'}>
                  <div
                    data-testid="s3-test-error"
                    class="bg-red-500/10 border border-red-500 rounded p-2 text-red-700 dark:text-red-300 text-xs break-words"
                  >
                    {s3TestMessage()}
                  </div>
                </Show>
                <Show when={s3TestStatus() === 'error'}>
                  <p class="text-gray-600 dark:text-gray-500 text-xs italic mt-1">
                    If a test record was created, it will appear in the media list with a <code class="bg-gray-50 dark:bg-gray-700 px-1 rounded">__stjorna_s3_test__</code> filename. You can safely delete it.
                  </p>
                </Show>
                <Show when={storageType() === 's3' && !s3TestPassed() && s3TestStatus() !== 'testing'}>
                  <p class="text-gray-600 dark:text-gray-500 text-xs italic mt-1">
                    Click "Verify S3 settings" before continuing.
                  </p>
                </Show>
              </div>
            </Show>

            <button
              onClick={handleConfigureStorage}
              disabled={!isS3Valid() || (storageType() === 's3' && !s3TestPassed())}
              class="w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </Show>

        <Show when={step() === 'tenant'}>
          <div class="space-y-4">
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">Create your first tenant:</p>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
              <input
                type="text"
                value={tenantName()}
                onInput={(e) => setTenantName(e.currentTarget.value)}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
              <input
                type="text"
                value={tenantSlug()}
                onInput={(e) => setTenantSlug(e.currentTarget.value.toLowerCase().replace(/\s+/g, '-'))}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleCreateTenant}
              disabled={loading() || !tenantName() || !tenantSlug()}
              class="w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {loading() ? 'Creating...' : 'Create Tenant'}
            </button>
          </div>
        </Show>

        <Show when={step() === 'link'}>
          <div class="space-y-4">
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">Linking admin to tenant...</p>
            <button
              onClick={handleLinkAdmin}
              disabled={loading()}
              class="w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {loading() ? 'Linking...' : 'Complete Setup'}
            </button>
          </div>
        </Show>

        <Show when={step() === 'done'}>
          <div class="text-center space-y-3">
            <p class="text-green-600 dark:text-green-400 text-lg mb-2">Setup complete!</p>
            <Show when={storageType() === 's3'}>
              <div class="bg-green-500/10 border border-green-500/50 rounded p-3 text-left">
                <p class="text-green-700 dark:text-green-300 text-xs font-medium mb-1">S3 storage active</p>
                <p class="text-green-700/80 dark:text-green-200/80 text-xs">
                  New uploads will be stored in bucket <code class="bg-gray-50 dark:bg-gray-700 px-1 rounded">{s3Bucket()}</code>.
                </p>
              </div>
            </Show>
            <Show when={storageType() === 'local'}>
              <p class="text-gray-500 dark:text-gray-400 text-xs">Using local filesystem storage.</p>
            </Show>
            <p class="text-gray-500 dark:text-gray-400 text-sm">Redirecting to login...</p>
          </div>
        </Show>

        <Show when={error()}>
          <p class="text-red-600 dark:text-red-400 text-sm mt-4">{error()}</p>
        </Show>
      </div>
    </div>
  );
}