import { createSignal, Show, onMount, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import PocketBase from 'pocketbase';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';

type Step = 'admin' | 'storage' | 'tenant' | 'link' | 'done';

export default function Setup() {
  const navigate = useNavigate();

  const resolvePbUrl = () =>
    (import.meta.env.VITE_PB_URL as string | undefined)?.replace(/\/+$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8090');

  onMount(async () => {
    try {
      const checkPb = new PocketBase(resolvePbUrl());
      const settings = await checkPb.collection('instance_settings').getList(1, 1);
      if (settings.items.length > 0 && settings.items[0].setup_done === true) {
        navigate('/login', { replace: true });
        return;
      }
    } catch (e: any) {
      if (e.status !== 404) console.warn('Setup check warning:', e.message);
    }
    // Decide whether step 1 should CREATE the first superuser or LOG IN
    // to an existing one. The status endpoint is registered by
    // pocketbase/pb_hooks/setup.pb.js — fails open to bootstrapMode=true
    // (assume a fresh install) if the hook is unreachable, since the
    // bootstrap endpoint will safely 409 instead.
    try {
      const res = await fetch(`${resolvePbUrl()}/api/stjorna/setup-status`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.superuserExists === 'boolean') {
          setBootstrapMode(!data.superuserExists);
        }
      }
    } catch {
      // ignore — fall back to bootstrapMode=true
    }
  });

  const [step, setStep] = createSignal<Step>('admin');
  const [pbUrl] = createSignal(resolvePbUrl());
  const [adminEmail, setAdminEmail] = createSignal('');
  const [adminPassword, setAdminPassword] = createSignal('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = createSignal('');
  // `bootstrapMode` = true: no superuser exists yet, step 1 form CREATES one.
  // `bootstrapMode` = false: a superuser already exists, step 1 form logs in.
  // Determined on mount via GET /api/stjorna/setup-status.
  const [bootstrapMode, setBootstrapMode] = createSignal(true);
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

  const handleSuperuserLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const pb = new PocketBase(pbUrl());

      if (bootstrapMode()) {
        // Create the very first superuser. The route is registered by
        // pocketbase/pb_hooks/setup.pb.js — it refuses (HTTP 409) once any
        // superuser exists, so this branch can never mint an extra admin.
        if (adminPassword() !== adminPasswordConfirm()) {
          setError('Password and confirmation do not match');
          setLoading(false);
          return;
        }
        const res = await fetch(`${resolvePbUrl()}/api/stjorna/setup-bootstrap-superuser`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: adminEmail(),
            password: adminPassword(),
            passwordConfirm: adminPasswordConfirm(),
          }),
        });
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const body = await res.json();
            if (body && body.error && body.error.message) msg = body.error.message;
          } catch {}
          throw new Error(msg);
        }
      }

      // In PB v0.40+ superusers live in the _superusers collection. The
      // setup UI logs in with those credentials; the schema is created by
      // the backend migrations before the wizard runs.
      await pb.collection('_superusers').authWithPassword(adminEmail(), adminPassword());
      setStep('storage');
    } catch (e: any) {
      setError(e.message || 'Superuser login failed');
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
        await pb.collection('_superusers').authWithPassword(adminEmail(), adminPassword());
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
      await pb.collection('_superusers').authWithPassword(adminEmail(), adminPassword());
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
      await pb.collection('_superusers').authWithPassword(adminEmail(), adminPassword());
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
          passwordConfirm: adminPassword(),
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
          instance_name: 'STJÓRNA',
          ...storageConfig,
        });
      } else {
        await pb.collection('instance_settings').create({
          setup_done: true,
          instance_name: 'STJÓRNA',
          ...storageConfig,
        });
      }

      // Sync the PocketBase app name so system emails don't show "Acme".
      await pb.settings.update({
        meta: {
          appName: 'STJÓRNA',
        },
      });

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
            <span class={['admin', 'storage', 'tenant', 'link'].includes(step()) ? 'text-blue-600 dark:text-blue-400' : ''}>1. Superuser</span>
            <span class={['storage', 'tenant', 'link'].includes(step()) ? 'text-blue-600 dark:text-blue-400' : ''}>2. Storage</span>
            <span class={['tenant', 'link'].includes(step()) ? 'text-blue-600 dark:text-blue-400' : ''}>3. Tenant</span>
            <span class={step() === 'link' ? 'text-blue-600 dark:text-blue-400' : ''}>4. Link</span>
          </div>
          <div class="h-1 bg-gray-50 dark:bg-gray-700 rounded">
            <div
              class="h-1 bg-blue-500 rounded transition-all duration-300"
              style={{
                width: step() === 'admin' ? '25%'
                  : step() === 'storage' ? '50%'
                  : step() === 'tenant' ? '75%'
                  : '100%'
              }}
            />
          </div>
        </div>

        <Show when={step() === 'admin'}>
          <form
            class="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSuperuserLogin();
            }}
          >
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
              <Show
                when={bootstrapMode()}
                fallback={<>Log in with the PocketBase superuser that already exists.</>}
              >
                No PocketBase superuser exists yet. Create the first one — it
                can administer every tenant in this instance, so pick something
                you'll remember. (Helm installs: the chart ships default
                credentials you can reuse; see the <code class="text-gray-700 dark:text-gray-300">helm install</code> output.)
              </Show>
            </p>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Superuser Email</label>
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
                autocomplete={bootstrapMode() ? 'new-password' : 'current-password'}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <Show when={bootstrapMode()}>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm password</label>
                <input
                  type="password"
                  value={adminPasswordConfirm()}
                  onInput={(e) => setAdminPasswordConfirm(e.currentTarget.value)}
                  autocomplete="new-password"
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </Show>
            <button
              type="submit"
              disabled={loading() || !adminEmail() || !adminPassword() || (bootstrapMode() && !adminPasswordConfirm())}
              class="w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {loading()
                ? (bootstrapMode() ? 'Creating...' : 'Logging in...')
                : (bootstrapMode() ? 'Create superuser & continue' : 'Continue')}
            </button>
          </form>
        </Show>

        <Show when={step() === 'storage'}>
          <form
            class="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleConfigureStorage();
            }}
          >
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
              type="submit"
              disabled={!isS3Valid() || (storageType() === 's3' && !s3TestPassed())}
              class="w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              Continue
            </button>
          </form>
        </Show>

        <Show when={step() === 'tenant'}>
          <form
            class="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateTenant();
            }}
          >
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
              type="submit"
              disabled={loading() || !tenantName() || !tenantSlug()}
              class="w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {loading() ? 'Creating...' : 'Create Tenant'}
            </button>
          </form>
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