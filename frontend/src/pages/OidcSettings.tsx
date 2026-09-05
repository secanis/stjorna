import { createSignal, Show, For, onMount } from 'solid-js';
import { pb } from '~/services/pocketbase';
import { Save } from 'lucide-solid';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';

interface OidcFormData {
  enabled: boolean;
  providerName: string;
  displayName: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string;
  pkce: boolean;
  groupClaim: string;
  groupSeparator: string;
  defaultRole: string;
  roleMapping: string;
  denyOnNoGroup: boolean;
  disablePasswordLogin: boolean;
}

const DEFAULT_ROLE_MAPPING = '_admin:admin,_editor:editor,_viewer:viewer';

// In PocketBase v0.22.7 generic OIDC slots are configured at the app settings
// level, not inside the auth collection. The providerName stored in
// instance_settings maps to one of these keys.
const SLOT_SETTINGS_KEY: Record<string, string> = {
  oidc: 'oidcAuth',
  oidc2: 'oidc2Auth',
  oidc3: 'oidc3Auth',
};

function providerSettingsKey(name: string): string {
  return SLOT_SETTINGS_KEY[name] || `${name}Auth`;
}

function parseRoleMapping(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of input.split(',')) {
    const kv = part.split(':');
    if (kv.length === 2) {
      out[String(kv[0]).trim()] = String(kv[1]).trim();
    }
  }
  return out;
}

function formatRoleMapping(mapping: Record<string, string>): string {
  return Object.entries(mapping)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
}

// OIDC configuration section. Intended to be rendered inside the main
// Settings page, which already handles auth and admin gating.
export default function OidcSettings() {
  const [form, setForm] = createSignal<OidcFormData>({
    enabled: false,
    providerName: 'oidc',
    displayName: 'Sign in with OIDC',
    clientId: '',
    clientSecret: '',
    authUrl: '',
    tokenUrl: '',
    userInfoUrl: '',
    scopes: 'openid,email,profile,groups',
    pkce: true,
    groupClaim: 'groups',
    groupSeparator: '_',
    defaultRole: 'viewer',
    roleMapping: DEFAULT_ROLE_MAPPING,
    denyOnNoGroup: true,
    disablePasswordLogin: false,
  });

  const [settingsId, setSettingsId] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);
  const [hasExistingSecret, setHasExistingSecret] = createSignal(false);

  onMount(async () => {
    try {
      // Load instance_settings OIDC mapping config.
      const settingsRes = await pb.collection('instance_settings').getList(1, 1);
      let providerName = 'oidc';
      if (settingsRes.items.length > 0) {
        const s = settingsRes.items[0];
        setSettingsId(s.id);
        providerName = String(s.oidc_provider_name || 'oidc');
        const rm = String(s.oidc_role_mapping || '');
        setForm({
          enabled: !!s.oidc_enabled,
          providerName,
          displayName: String(s.oidc_display_name || 'Sign in with OIDC'),
          clientId: String(s.oidc_client_id || ''),
          clientSecret: '',
          authUrl: String(s.oidc_auth_url || ''),
          tokenUrl: String(s.oidc_token_url || ''),
          userInfoUrl: String(s.oidc_user_info_url || ''),
          scopes: String(s.oidc_scopes || 'openid,email,profile,groups'),
          pkce: true,
          groupClaim: String(s.oidc_group_claim || 'groups'),
          groupSeparator: String(s.oidc_group_separator || '_'),
          defaultRole: String(s.oidc_default_role || 'viewer'),
          roleMapping: rm || DEFAULT_ROLE_MAPPING,
          denyOnNoGroup: s.oidc_deny_on_no_group !== false,
          disablePasswordLogin: !!s.oidc_disable_password_login,
        });
      }

      // Load the actual OIDC provider config from PB app settings.
      const appSettings: any = await pb.settings.getAll();
      const key = providerSettingsKey(providerName);
      const provider: any = appSettings[key] || {};
      if (provider && typeof provider === 'object') {
        setForm((f) => ({
          ...f,
          providerName,
          displayName: String(provider.displayName || f.displayName),
          clientId: String(provider.clientId || f.clientId || ''),
          authUrl: String(provider.authUrl || f.authUrl || ''),
          tokenUrl: String(provider.tokenUrl || f.tokenUrl || ''),
          userInfoUrl: String(provider.userApiUrl || f.userInfoUrl || ''),
          pkce: provider.pkce !== false,
          enabled: !!provider.enabled,
        }));
        setHasExistingSecret(!!provider.clientSecret);
      }

      // Reflect current password auth state.
      const emailAuth: any = appSettings.emailAuth || {};
      setForm((f) => ({ ...f, disablePasswordLogin: emailAuth.enabled === false }));
    } catch (e: any) {
      setError(e.message || 'Failed to load OIDC settings');
    } finally {
      setLoading(false);
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    const f = form();

    if (f.enabled) {
      if (!f.clientId) { setError('Client ID is required'); setSaving(false); return; }
      if (!f.authUrl) { setError('Authorization URL is required'); setSaving(false); return; }
      if (!f.tokenUrl) { setError('Token URL is required'); setSaving(false); return; }
      // PocketBase v0.22.7 requires a client secret for the generic OIDC slot
      // even when PKCE is enabled. Leaving it blank is only allowed when an
      // existing secret is already stored.
      if (!f.clientSecret && !hasExistingSecret()) {
        setError('Client secret is required');
        setSaving(false);
        return;
      }
      const mapping = parseRoleMapping(f.roleMapping);
      if (!mapping['_admin'] || !mapping['_editor'] || !mapping['_viewer']) {
        setError('Role mapping must define _admin, _editor and _viewer suffixes');
        setSaving(false);
        return;
      }
    }

    if (f.disablePasswordLogin && !f.enabled) {
      setError('Cannot disable password login while OIDC is disabled');
      setSaving(false);
      return;
    }

    try {
      // Save instance_settings mapping config.
      const instancePayload = {
        oidc_enabled: f.enabled,
        oidc_provider_name: f.providerName,
        oidc_display_name: f.displayName,
        oidc_client_id: f.clientId,
        oidc_client_secret: f.clientSecret,
        oidc_auth_url: f.authUrl,
        oidc_token_url: f.tokenUrl,
        oidc_user_info_url: f.userInfoUrl,
        oidc_scopes: f.scopes,
        oidc_group_claim: f.groupClaim,
        oidc_group_separator: f.groupSeparator,
        oidc_default_role: f.defaultRole,
        oidc_role_mapping: f.roleMapping,
        oidc_deny_on_no_group: f.denyOnNoGroup,
        oidc_disable_password_login: f.disablePasswordLogin,
      };

      if (settingsId()) {
        await pb.collection('instance_settings').update(settingsId()!, instancePayload);
      } else {
        const created = await pb.collection('instance_settings').create(instancePayload);
        setSettingsId(created.id);
      }

      // Update the actual OIDC provider config in PB app settings.
      const key = providerSettingsKey(f.providerName);
      const providerConfig: any = {
        enabled: f.enabled,
        clientId: f.clientId,
        authUrl: f.authUrl,
        tokenUrl: f.tokenUrl,
        userApiUrl: f.userInfoUrl,
        displayName: f.displayName,
        pkce: f.pkce,
      };
      // Only send a new secret when the user typed one. Omitting it keeps the
      // existing secret on the server.
      if (f.clientSecret) {
        providerConfig.clientSecret = f.clientSecret;
      }

      await pb.settings.update({
        [key]: providerConfig,
        emailAuth: {
          enabled: !f.disablePasswordLogin,
        },
      });

      setHasExistingSecret(f.enabled && (!!f.clientSecret || hasExistingSecret()));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save OIDC settings');
    } finally {
      setSaving(false);
    }
  };

  const redirectUrl = () => {
    const base = (import.meta.env.VITE_PB_URL as string | undefined)?.replace(/\/+$/, '') || window.location.origin;
    return `${base}/api/oauth2-redirect`;
  };

  return (
    <div class="space-y-6 max-w-3xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">OIDC Settings</h1>

      <Show when={loading()}>
        <div class="text-gray-500 dark:text-gray-400">Loading...</div>
      </Show>

      <Show when={error() && !loading()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-600 dark:text-red-400 text-sm">
          {error()}
        </div>
      </Show>

      <Show when={success()}>
        <div class="bg-green-500/10 border border-green-500 rounded p-4 text-green-600 dark:text-green-400 text-sm">
          OIDC settings saved successfully.
        </div>
      </Show>

      <Show when={!loading()}>
        <form onSubmit={handleSubmit} class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-6">
          <div>
            <label class="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form().enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.currentTarget.checked }))}
              />
              <span class="text-gray-900 dark:text-white font-medium">Enable OIDC login</span>
            </label>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provider slot</label>
              <input
                type="text"
                value={form().providerName}
                onInput={(e) => setForm((f) => ({ ...f, providerName: e.currentTarget.value.trim() }))}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">PocketBase generic OIDC slot, usually "oidc".</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display name</label>
              <input
                type="text"
                value={form().displayName}
                onInput={(e) => setForm((f) => ({ ...f, displayName: e.currentTarget.value }))}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client ID</label>
              <input
                type="text"
                value={form().clientId}
                onInput={(e) => setForm((f) => ({ ...f, clientId: e.currentTarget.value.trim() }))}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client secret</label>
              <input
                type="password"
                value={form().clientSecret}
                placeholder={hasExistingSecret() ? '••••••••' : ''}
                onInput={(e) => setForm((f) => ({ ...f, clientSecret: e.currentTarget.value }))}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {hasExistingSecret() && !form().clientSecret
                  ? 'Required by PocketBase for the OIDC slot. Leave blank to keep the existing secret.'
                  : 'Required by PocketBase for the OIDC slot, even with PKCE enabled.'}
              </p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Authorization URL</label>
            <input
              type="url"
              value={form().authUrl}
              onInput={(e) => setForm((f) => ({ ...f, authUrl: e.currentTarget.value.trim() }))}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Token URL</label>
              <input
                type="url"
                value={form().tokenUrl}
                onInput={(e) => setForm((f) => ({ ...f, tokenUrl: e.currentTarget.value.trim() }))}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">UserInfo URL</label>
              <input
                type="url"
                value={form().userInfoUrl}
                onInput={(e) => setForm((f) => ({ ...f, userInfoUrl: e.currentTarget.value.trim() }))}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Optional. Leave empty to read claims from the ID token.</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scopes</label>
              <input
                type="text"
                value={form().scopes}
                onInput={(e) => setForm((f) => ({ ...f, scopes: e.currentTarget.value }))}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Comma-separated. Include the scope that exposes the groups claim.</p>
            </div>

            <div class="flex items-center">
              <label class="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form().pkce}
                  onChange={(e) => setForm((f) => ({ ...f, pkce: e.currentTarget.checked }))}
                />
                <span class="text-gray-900 dark:text-white font-medium">Use PKCE</span>
              </label>
            </div>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Group mapping</h2>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Groups claim</label>
                <input
                  type="text"
                  value={form().groupClaim}
                  onInput={(e) => setForm((f) => ({ ...f, groupClaim: e.currentTarget.value.trim() }))}
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Separator</label>
                <input
                  type="text"
                  value={form().groupSeparator}
                  onInput={(e) => setForm((f) => ({ ...f, groupSeparator: e.currentTarget.value }))}
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default role</label>
                <select
                  value={form().defaultRole}
                  onChange={(e) => setForm((f) => ({ ...f, defaultRole: e.currentTarget.value }))}
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role mapping</label>
              <input
                type="text"
                value={form().roleMapping}
                onInput={(e) => setForm((f) => ({ ...f, roleMapping: e.currentTarget.value }))}
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Format: _admin:admin,_editor:editor,_viewer:viewer</p>
            </div>

            <div class="mt-4 flex flex-col gap-3">
              <label class="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form().denyOnNoGroup}
                  onChange={(e) => setForm((f) => ({ ...f, denyOnNoGroup: e.currentTarget.checked }))}
                />
                <span class="text-gray-900 dark:text-white font-medium">Deny login if no matching tenant group is found</span>
              </label>
            </div>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Password login</h2>
            <label class="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form().disablePasswordLogin}
                onChange={(e) => setForm((f) => ({ ...f, disablePasswordLogin: e.currentTarget.checked }))}
              />
              <span class="text-gray-900 dark:text-white font-medium">Disable regular user password login</span>
            </label>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              PB admin login is not affected. Requires OIDC to be enabled.
            </p>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Redirect URL</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 break-all font-mono bg-gray-50 dark:bg-gray-700 rounded p-2">
              {redirectUrl()}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Register this redirect URL in your OIDC client.</p>
          </div>

          <button
            type="submit"
            disabled={saving()}
            class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-6 rounded disabled:opacity-50 flex items-center gap-2`}
          >
            <Save size={16} />
            {saving() ? 'Saving...' : 'Save OIDC Settings'}
          </button>
        </form>
      </Show>
    </div>
  );
}
