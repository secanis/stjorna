import { Show, For, createSignal, createEffect, onCleanup } from 'solid-js';
import { ChevronDown } from 'lucide-solid';
import { authStore } from '~/stores/auth';
import { pb } from '~/services/pocketbase';
import { getMediaFileUrl } from '~/utils/mediaUrl';
import type { TenantThemeConfig } from '~/types';

function getTenantName(tenantId: string | null): string {
  if (!tenantId) return 'Select tenant...';
  if (authStore.isPBAdmin && tenantId === 'instance') return 'Instance Settings';
  const tenant = authStore.tenants.find(t => t.tenant === tenantId);
  return tenant ? (tenant.tenantName || tenant.tenant).substring(0, 20) : 'Select tenant...';
}

// Resolves a tenant's logo media ID into a file URL, reactive to the
// protected-file token refresh. Falls back to the color swatch when there
// is no logo (or the media record is missing/inaccessible).
function TenantAvatar(props: { themeConfig?: TenantThemeConfig }) {
  const [media, setMedia] = createSignal<{ id: string; file: string } | null>(null);

  createEffect(() => {
    const mediaId = props.themeConfig?.logoMediaId?.trim();
    setMedia(null);
    if (!mediaId) return;
    let cancelled = false;
    void (async () => {
      try {
        const m = await pb.collection('media').getOne(mediaId);
        const file = String((m as any).file || '');
        if (!cancelled && file) setMedia({ id: m.id, file });
      } catch {
        // unknown/deleted media or no read access → fall through to swatch
      }
    })();
    onCleanup(() => { cancelled = true; });
  });

  const dark = () => props.themeConfig?.headerBgDark?.trim();
  const light = () => props.themeConfig?.headerBgLight?.trim();
  const swatchStyle = () => {
    if (light() && dark()) return { background: `linear-gradient(135deg, ${light()} 0%, ${light()} 50%, ${dark()} 50%, ${dark()} 100%)` };
    if (dark()) return { 'background-color': dark() };
    if (light()) return { 'background-color': light() };
    return undefined;
  };

  return (
    <Show
      when={media()}
      keyed
      fallback={
        <div
          class={`w-6 h-6 rounded-full flex-shrink-0 border border-gray-200 dark:border-gray-700 ${swatchStyle() ? '' : 'bg-gray-200 dark:bg-gray-700'}`}
          style={swatchStyle()}
        />
      }
    >
      {(m) => (
        <img src={getMediaFileUrl(m.id, m.file)} class="w-6 h-6 rounded-full object-cover flex-shrink-0" alt="" />
      )}
    </Show>
  );
}

export default function TenantSelector() {
  const currentValue = () => authStore.currentTenant || '';
  const currentTenant = () => authStore.tenants.find(t => t.tenant === currentValue());

  return (
    <div class="relative group">
      <div class="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
        <TenantAvatar themeConfig={currentTenant()?.themeConfig} />
        <span class="text-gray-900 dark:text-white text-sm truncate max-w-[150px]">
          {getTenantName(currentValue())}
        </span>
        <ChevronDown size={14} class="text-gray-500 dark:text-gray-400 flex-shrink-0" />
      </div>

      <div class="absolute left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div class="py-1">
          <Show when={authStore.isPBAdmin}>
            <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <div class="text-xs text-gray-600 dark:text-gray-500 uppercase">System</div>
            </div>
            <button
              onClick={() => authStore.switchTenant(null)}
              class={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${
                currentValue() === '' ? 'text-blue-600 dark:text-blue-400 bg-gray-50 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:text-white'
              }`}
            >
              <span>Instance Settings</span>
              <Show when={currentValue() === ''}>
                <span class="text-xs text-blue-600 dark:text-blue-400">✓</span>
              </Show>
            </button>
            <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 mt-1">
              <div class="text-xs text-gray-600 dark:text-gray-500 uppercase">Tenants</div>
            </div>
          </Show>

          <For each={authStore.tenants}>
            {(t) => (
              <button
                onClick={() => authStore.switchTenant(t.tenant)}
                class={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 ${
                  currentValue() === t.tenant ? 'text-blue-600 dark:text-blue-400 bg-gray-50 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:text-white'
                }`}
              >
                <TenantAvatar themeConfig={t.themeConfig} />
                <span class="flex-1 truncate">{t.tenantName || t.tenant}</span>
                <span class="text-xs text-gray-600 dark:text-gray-500">{t.role}</span>
                <Show when={currentValue() === t.tenant}>
                  <span class="text-xs text-blue-600 dark:text-blue-400">✓</span>
                </Show>
              </button>
            )}
          </For>

          <Show when={authStore.tenants.length === 0 && !authStore.isPBAdmin}>
            <div class="px-4 py-3 text-gray-600 dark:text-gray-500 text-sm">No tenants available</div>
          </Show>
        </div>
      </div>
    </div>
  );
}
