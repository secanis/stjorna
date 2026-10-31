import { createSignal, Show, onMount, onCleanup, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';
import { getConfiguredPbUrl } from '~/services/config';
import { i18nStore } from '~/i18n';
import CornerLanguageSwitcher from '~/components/ui/CornerLanguageSwitcher';

type Step = 'admin' | 'storage' | 'tenant' | 'link' | 'done';

export default function Setup() {
  const navigate = useNavigate();

  const resolvePbUrl = () =>
    getConfiguredPbUrl() ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8090');

  const [step, setStep] = createSignal<Step>('admin');
  const [pbUrl] = createSignal(resolvePbUrl());
  const [adminEmail, setAdminEmail] = createSignal('');
  const [adminPassword, setAdminPassword] = createSignal('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = createSignal('');
  // T-04: one-time setup token required by POST /api/stjorna/setup-bootstrap-superuser.
  const [setupToken, setSetupToken] = createSignal('');
  // Where the backend got its token from: "env" (STJORNA_SETUP_TOKEN) or
  // "log" (generated at boot and printed to the PocketBase server log).
  const [setupTokenSource, setSetupTokenSource] = createSignal<'env' | 'log'>('log');
  // `bootstrapMode` = true:  no superuser exists yet, step 1 form CREATES one.
  // `bootstrapMode` = false: a superuser already exists, step 1 form logs in.
  // Determined on mount via GET /api/stjorna/setup-status.
  const [bootstrapMode, setBootstrapMode] = createSignal(true);
  const [statusChecked, setStatusChecked] = createSignal(false);
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
  // Set by the tenant step; consumed by the link step. Kept in component
  // state (was window.__setupTenantId before T-04).
  const [tenantId, setTenantId] = createSignal('');
  const [tenantReused, setTenantReused] = createSignal(false);
  // The tenant-admin `users` account gets its OWN password. Reusing the
  // superuser password for a tenant-level account was a T-04 finding.
  const [userPassword, setUserPassword] = createSignal('');
  const [userPasswordConfirm, setUserPasswordConfirm] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  // One in-memory PocketBase client for the whole wizard. `BaseAuthStore`
  // keeps the superuser JWT in memory only — the SDK's default
  // LocalAuthStore would persist it to localStorage where it outlives the
  // wizard. The store is cleared on finish and on unmount.
  const setupPb = new PocketBase(pbUrl(), new BaseAuthStore());
  onCleanup(() => setupPb.authStore.clear());

  onMount(async () => {
    // GET /api/stjorna/setup-status (pocketbase/pb_hooks/setup.pb.js) is
    // the single source of truth. It is unauthenticated on purpose — on a
    // fresh install there is no admin yet — and reports both flags the
    // wizard needs. It fails open to bootstrapMode=true (assume a fresh
    // install) if the hook is unreachable; the bootstrap route safely
    // 401s/409s if that assumption is wrong.
    try {
      const res = await fetch(`${pbUrl()}/api/stjorna/setup-status`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.setupDone === true) {
          navigate('/login', { replace: true });
          return;
        }
        if (data && typeof data.superuserExists === 'boolean') {
          setBootstrapMode(!data.superuserExists);
        }
        if (data && data.setupTokenSource === 'env') {
          setSetupTokenSource('env');
        }
      }
    } catch {
      // ignore — fall back to bootstrapMode=true
    }
    setStatusChecked(true);
  });

  // Every step after the first needs a live superuser session on the
  // shared client. If it is gone (token expired, page reloaded) send the
  // operator back to step 1 instead of failing with an opaque 401/403.
  const requireSession = (): boolean => {
    if (setupPb.authStore.isValid && setupPb.authStore.isSuperuser) return true;
    setupPb.authStore.clear();
    setStep('admin');
    setError(i18nStore.t('setup.sessionExpired'));
    return false;
  };

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
    if (!requireSession()) return;
    setS3TestStatus('testing');
    setS3TestMessage('');
    setS3TestPassed(false);
    let testRecordId: string | null = null;
    // Snapshot the current S3 settings so a failed check does not leave
    // the instance pointing at unreachable storage (every later upload
    // would fail). PB does not return the secret, so it is left as is.
    let previousS3: Record<string, unknown> | null = null;
    try {
      const { secret: _secret, ...rest } = ((await setupPb.settings.getAll()) as any)?.s3 || {};
      previousS3 = rest;
    } catch {}
    try {
      await saveS3Settings(setupPb);

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
        testRecord = await setupPb.collection('media').create(formData);
        testRecordId = testRecord.id;
      } catch (e: any) {
        throw new Error(i18nStore.t('setup.s3UploadFailed', { msg: categorizeS3Error(e) }));
      }

      // T-08: media.file is protected, so file requests need a short-lived
      // file token (not the auth JWT). Fetch one and append it to the URL.
      let fileToken: string;
      try {
        fileToken = await setupPb.files.getToken();
      } catch (e: any) {
        throw new Error(i18nStore.t('setup.s3FileTokenFailed', { msg: e?.message || e }));
      }
      const fileUrl = setupPb.files.getURL(testRecord, testRecord.file, { token: fileToken });
      let fileRes: Response;
      try {
        fileRes = await fetch(fileUrl);
      } catch (e: any) {
        throw new Error(i18nStore.t('setup.s3FileUrlUnreachable', { msg: e?.message || e }));
      }
      if (!fileRes.ok) {
        throw new Error(i18nStore.t('setup.s3FileNotAccessible', { status: fileRes.status }));
      }

      try {
        await setupPb.collection('media').delete(testRecord.id);
        testRecordId = null;
      } catch (e: any) {
        setS3TestStatus('success');
        setS3TestMessage(
          i18nStore.t('setup.s3VerifiedButNotDeleted', { id: testRecord.id })
        );
        setS3TestPassed(true);
        return;
      }

      setS3TestStatus('success');
      setS3TestMessage(
        i18nStore.t('setup.s3Verified', {
          bucket: s3Bucket(),
          region: s3Region(),
          endpoint: resolvedS3Endpoint(),
        })
      );
      setS3TestPassed(true);
    } catch (e: any) {
      setS3TestStatus('error');
      setS3TestMessage(categorizeS3Error(e));
      if (testRecordId) {
        try {
          await setupPb.collection('media').delete(testRecordId);
        } catch {}
      }
      try {
        await setupPb.settings.update({ s3: previousS3 ?? { enabled: false } });
      } catch {}
    }
  };

  const categorizeS3Error = (e: any): string => {
    const data = e?.data;
    if (data && typeof data === 'object') {
      const fileErr = data.file;
      if (fileErr && typeof fileErr === 'object') {
        if (fileErr.code === 'validation_invalid_mime_type') {
          return i18nStore.t('setup.s3MimeType');
        }
        if (fileErr.code === 'validation_required') {
          return i18nStore.t('setup.s3MissingFile');
        }
        if (fileErr.message) {
          return i18nStore.t('setup.s3ValidationFailed', { msg: fileErr.message });
        }
      }
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (val && typeof val === 'object' && val.message) {
          return `${key}: ${val.message}`;
        }
      }
    }

    const raw = e?.message || i18nStore.t('setup.s3TestFailed');
    const lower = raw.toLowerCase();
    if (lower.includes('failed to authenticate') || lower.includes('invalidaccesskeyid') || lower.includes('signaturedoesnotmatch')) {
      return i18nStore.t('setup.s3AuthFailed');
    }
    if (lower.includes('no such bucket') || lower.includes('nosuchbucket')) {
      return i18nStore.t('setup.s3BucketMissing');
    }
    if (lower.includes('access denied') || lower.includes('accessdenied')) {
      return i18nStore.t('setup.s3AccessDenied');
    }
    if (lower.includes('no such endpoint') || lower.includes('nosuchendpoint') || lower.includes('could not resolve')) {
      return i18nStore.t('setup.s3EndpointInvalid');
    }
    if (lower.includes('something went wrong')) {
      return i18nStore.t('setup.s3GenericError', { raw });
    }
    if (lower.includes('http 4') || lower.includes('http 5')) {
      return i18nStore.t('setup.s3HttpError', { raw });
    }
    return raw;
  };

  // T-07.1 / T-22: the S3 config (incl. credentials) is written ONLY to
  // PocketBase's own (PB_SECRET-encrypted) settings via saveS3Settings().
  // instance_settings no longer mirrors it (migration 1780001000).

  const handleSuperuserLogin = async () => {
    setLoading(true);
    setError('');
    try {
      if (bootstrapMode()) {
        // Create the very first superuser. The route is registered by
        // pocketbase/pb_hooks/setup.pb.js — it requires the one-time setup
        // token and refuses (HTTP 409) once any superuser exists or once
        // setup_done is set, so this branch can never mint an extra admin.
        if (adminPassword() !== adminPasswordConfirm()) {
          setError(i18nStore.t('setup.passwordMismatch'));
          setLoading(false);
          return;
        }
        if (!setupToken().trim()) {
          setError(i18nStore.t('setup.tokenRequired'));
          setLoading(false);
          return;
        }
        const res = await fetch(`${pbUrl()}/api/stjorna/setup-bootstrap-superuser`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Stjorna-Setup-Token': setupToken().trim(),
          },
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
          if (res.status === 409) {
            // Somebody (or a previous attempt) already bootstrapped —
            // flip to login mode so the operator can continue.
            setBootstrapMode(false);
          }
          throw new Error(msg);
        }
        // The token was single-use from the wizard's point of view; drop it.
        setSetupToken('');
      }

      // In PB v0.40+ superusers live in the _superusers collection. The
      // session lives in the in-memory store on `setupPb` and is reused
      // by every later step (no more re-auth with the raw password).
      await setupPb.collection('_superusers').authWithPassword(adminEmail(), adminPassword());
      setStep('storage');
    } catch (e: any) {
      setError(e.message || i18nStore.t('setup.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureStorage = async () => {
    setError('');
    if (!isS3Valid()) {
      setError(i18nStore.t('setup.s3FieldsRequired'));
      return;
    }
    if (!requireSession()) return;
    if (storageType() === 's3') {
      try {
        await saveS3Settings(setupPb);
      } catch (e: any) {
        setError(i18nStore.t('setup.couldNotSaveS3', { msg: e?.message || e }));
        return;
      }
    }
    setStep('tenant');
  };

  const handleCreateTenant = async () => {
    setLoading(true);
    setError('');
    try {
      if (!requireSession()) return;
      const slug = tenantSlug().trim();
      // Idempotent: re-running the step (or a re-run of the wizard by a
      // superuser) reuses the tenant with this slug instead of creating a
      // duplicate. UNIQUE(tenant, slug) on the child collections (T-02)
      // makes duplicates actively harmful.
      let tenant: any = null;
      try {
        tenant = await setupPb.collection('tenants').getFirstListItem(
          setupPb.filter('slug = {:slug}', { slug })
        );
      } catch (e: any) {
        if (e?.status !== 404) throw e;
      }
      if (tenant) {
        setTenantReused(true);
      } else {
        setTenantReused(false);
        tenant = await setupPb.collection('tenants').create({
          name: tenantName(),
          slug,
          plan: 'starter',
        });
      }
      setTenantId(tenant.id);
      setStep('link');
    } catch (e: any) {
      setError(e.message || i18nStore.t('setup.createTenantFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLinkAdmin = async () => {
    setLoading(true);
    setError('');
    try {
      if (!requireSession()) return;
      if (!tenantId()) throw new Error(i18nStore.t('setup.tenantNotFound'));

      // Tenant-admin `users` account. Reused if it already exists (e.g. the
      // wizard is being re-run); otherwise it gets its own password —
      // never the superuser one.
      let adminUser: any = null;
      try {
        adminUser = await setupPb.collection('users').getFirstListItem(
          setupPb.filter('email = {:email}', { email: adminEmail() })
        );
      } catch (e: any) {
        if (e?.status !== 404) throw e;
      }

      if (!adminUser) {
        if (userPassword().length < 10) {
          throw new Error(i18nStore.t('setup.adminPasswordMin'));
        }
        if (userPassword() !== userPasswordConfirm()) {
          throw new Error(i18nStore.t('setup.adminPasswordMismatch'));
        }
        if (userPassword() === adminPassword()) {
          throw new Error(i18nStore.t('setup.adminPasswordSameAsSuperuser'));
        }
        adminUser = await setupPb.collection('users').create({
          email: adminEmail(),
          password: userPassword(),
          passwordConfirm: userPasswordConfirm(),
          name: 'Admin',
        });
      }

      const adminRole = await setupPb.collection('roles').getFirstListItem('name="admin"');

      // Idempotent membership: UNIQUE(user, tenant) exists since T-02, so
      // look before creating.
      let membership: any = null;
      try {
        membership = await setupPb.collection('user_tenants').getFirstListItem(
          setupPb.filter('user = {:user} && tenant = {:tenant}', { user: adminUser.id, tenant: tenantId() })
        );
      } catch (e: any) {
        if (e?.status !== 404) throw e;
      }
      if (!membership) {
        await setupPb.collection('user_tenants').create({
          user: adminUser.id,
          tenant: tenantId(),
          role: adminRole.id,
          source: 'manual',
        });
      }

      const existingSettings = await setupPb.collection('instance_settings').getList(1, 1).catch(() => null);
      if (existingSettings && existingSettings.items.length > 0) {
        await setupPb.collection('instance_settings').update(existingSettings.items[0].id, {
          setup_done: true,
        });
      } else {
        await setupPb.collection('instance_settings').create({
          setup_done: true,
        });
      }

      // Sync the PocketBase app name so system emails don't show "Acme".
      await setupPb.settings.update({
        meta: {
          appName: 'STJÓRNA',
        },
      });

      // Done — drop the superuser session and the passwords held in state.
      setupPb.authStore.clear();
      setAdminPassword('');
      setAdminPasswordConfirm('');
      setUserPassword('');
      setUserPasswordConfirm('');
      setStep('done');
      setTimeout(() => navigate('/login'), 1500);
    } catch (e: any) {
      setError(e.message || i18nStore.t('setup.linkAdminFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <CornerLanguageSwitcher />
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">STJÓRNA</h1>
          <p class="text-gray-500 dark:text-gray-400">{i18nStore.t('setup.subtitle')}</p>
        </div>

        <div class="mb-6">
          <div class="flex justify-between text-xs text-gray-600 dark:text-gray-500 mb-2">
            <span class={['admin', 'storage', 'tenant', 'link'].includes(step()) ? 'text-blue-600 dark:text-blue-400' : ''}>{i18nStore.t('setup.stepSuperuser')}</span>
            <span class={['storage', 'tenant', 'link'].includes(step()) ? 'text-blue-600 dark:text-blue-400' : ''}>{i18nStore.t('setup.stepStorage')}</span>
            <span class={['tenant', 'link'].includes(step()) ? 'text-blue-600 dark:text-blue-400' : ''}>{i18nStore.t('setup.stepTenant')}</span>
            <span class={step() === 'link' ? 'text-blue-600 dark:text-blue-400' : ''}>{i18nStore.t('setup.stepLink')}</span>
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
                fallback={<>{i18nStore.t('setup.loginIntro')}</>}
              >
                {i18nStore.t('setup.bootstrapIntro')}
              </Show>
            </p>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('setup.superuserEmail')}</label>
              <input
                type="email"
                value={adminEmail()}
                onInput={(e) => setAdminEmail(e.currentTarget.value)}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('setup.password')}</label>
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
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('setup.confirmPassword')}</label>
                <input
                  type="password"
                  value={adminPasswordConfirm()}
                  onInput={(e) => setAdminPasswordConfirm(e.currentTarget.value)}
                  autocomplete="new-password"
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </Show>
            <Show when={bootstrapMode()}>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="setup-token">{i18nStore.t('setup.setupToken')}</label>
                <input
                  id="setup-token"
                  type="password"
                  value={setupToken()}
                  onInput={(e) => setSetupToken(e.currentTarget.value)}
                  autocomplete="off"
                  spellcheck={false}
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                />
                <p class="text-gray-600 dark:text-gray-500 text-xs mt-1">
                  <Show
                    when={setupTokenSource() === 'env'}
                    fallback={<>{i18nStore.t('setup.tokenHintLog')}</>}
                  >
                    {i18nStore.t('setup.tokenHintEnv')}
                  </Show>
                </p>
              </div>
            </Show>
            <button
              type="submit"
              disabled={loading() || !statusChecked() || !adminEmail() || !adminPassword() || (bootstrapMode() && (!adminPasswordConfirm() || !setupToken()))}
              class="w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {loading()
                ? (bootstrapMode() ? i18nStore.t('setup.creating') : i18nStore.t('setup.loggingIn'))
                : (bootstrapMode() ? i18nStore.t('setup.createSuperuser') : i18nStore.t('setup.continue'))}
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
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-2">{i18nStore.t('setup.storageIntro')}</p>

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
                  <div class="text-gray-900 dark:text-white font-medium text-sm">{i18nStore.t('setup.storageLocalTitle')}</div>
                  <div class="text-gray-500 dark:text-gray-400 text-xs mt-1">
                    {i18nStore.t('setup.storageLocalDesc')}
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
                  <div class="text-gray-900 dark:text-white font-medium text-sm">{i18nStore.t('setup.storageS3Title')}</div>
                  <div class="text-gray-500 dark:text-gray-400 text-xs mt-1">
                    {i18nStore.t('setup.storageS3Desc')}
                  </div>
                </div>
              </label>
            </div>

            <Show when={storageType() === 's3'}>
              <div class="space-y-3 pl-4 border-l-2 border-blue-500">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="s3-bucket">{i18nStore.t('setup.bucket')}</label>
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
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="s3-region">{i18nStore.t('setup.region')}</label>
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
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="s3-endpoint">{i18nStore.t('setup.endpoint')}</label>
                  <input
                    id="s3-endpoint"
                    type="text"
                    value={s3Endpoint()}
                    onInput={(e) => { setS3Endpoint(e.currentTarget.value); setS3TestPassed(false); }}
                    placeholder="https://s3.eu-central-1.amazonaws.com"
                    required
                    class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <p class="text-gray-600 dark:text-gray-500 text-xs mt-1">{i18nStore.t('setup.endpointHint')}</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="s3-access-key">{i18nStore.t('setup.accessKey')}</label>
                  <input
                    id="s3-access-key"
                    type="text"
                    value={s3AccessKey()}
                    onInput={(e) => { setS3AccessKey(e.currentTarget.value); setS3TestPassed(false); }}
                    class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="s3-secret-key">{i18nStore.t('setup.secretKey')}</label>
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
                  {i18nStore.t('setup.forcePathStyle')}
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
                  {s3TestStatus() === 'testing' ? i18nStore.t('setup.testing') : i18nStore.t('setup.verifyS3')}
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
                    {i18nStore.t('setup.testRecordNote')}
                  </p>
                </Show>
                <Show when={storageType() === 's3' && !s3TestPassed() && s3TestStatus() !== 'testing'}>
                  <p class="text-gray-600 dark:text-gray-500 text-xs italic mt-1">
                    {i18nStore.t('setup.clickVerify')}
                  </p>
                </Show>
              </div>
            </Show>

            <button
              type="submit"
              disabled={!isS3Valid() || (storageType() === 's3' && !s3TestPassed())}
              class="w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {i18nStore.t('setup.continue')}
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
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">{i18nStore.t('setup.tenantIntro')}</p>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('setup.companyName')}</label>
              <input
                type="text"
                value={tenantName()}
                onInput={(e) => setTenantName(e.currentTarget.value)}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('setup.slug')}</label>
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
              {loading() ? i18nStore.t('setup.saving') : i18nStore.t('setup.continue')}
            </button>
          </form>
        </Show>

        <Show when={step() === 'link'}>
          <form
            class="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleLinkAdmin();
            }}
          >
            <p class="text-gray-500 dark:text-gray-400 text-sm mb-2">
              {i18nStore.t('setup.linkIntro', {
                email: adminEmail(),
                where: tenantReused() ? i18nStore.t('setup.linkWhereExisting') : i18nStore.t('setup.linkWhereNew'),
                slug: tenantSlug(),
              })}
            </p>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="user-password">{i18nStore.t('setup.tenantAdminPassword')}</label>
              <input
                id="user-password"
                type="password"
                value={userPassword()}
                onInput={(e) => setUserPassword(e.currentTarget.value)}
                autocomplete="new-password"
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
              <p class="text-gray-600 dark:text-gray-500 text-xs mt-1">{i18nStore.t('setup.tenantAdminPasswordHint')}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="user-password-confirm">{i18nStore.t('setup.confirmTenantAdminPassword')}</label>
              <input
                id="user-password-confirm"
                type="password"
                value={userPasswordConfirm()}
                onInput={(e) => setUserPasswordConfirm(e.currentTarget.value)}
                autocomplete="new-password"
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading()}
              class="w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {loading() ? i18nStore.t('setup.linking') : i18nStore.t('setup.completeSetup')}
            </button>
          </form>
        </Show>

        <Show when={step() === 'done'}>
          <div class="text-center space-y-3">
            <p class="text-green-600 dark:text-green-400 text-lg mb-2">{i18nStore.t('setup.doneTitle')}</p>
            <Show when={storageType() === 's3'}>
              <div class="bg-green-500/10 border border-green-500/50 rounded p-3 text-left">
                <p class="text-green-700 dark:text-green-300 text-xs font-medium mb-1">{i18nStore.t('setup.s3Active')}</p>
                <p class="text-green-700/80 dark:text-green-200/80 text-xs">
                  {i18nStore.t('setup.s3ActiveDesc', { bucket: s3Bucket() })}
                </p>
              </div>
            </Show>
            <Show when={storageType() === 'local'}>
              <p class="text-gray-500 dark:text-gray-400 text-xs">{i18nStore.t('setup.localStorageDesc')}</p>
            </Show>
            <p class="text-gray-500 dark:text-gray-400 text-sm">{i18nStore.t('setup.redirecting')}</p>
          </div>
        </Show>

        <Show when={error()}>
          <p class="text-red-600 dark:text-red-400 text-sm mt-4">{error()}</p>
        </Show>
      </div>
    </div>
  );
}