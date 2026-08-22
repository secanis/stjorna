import { Show, For } from 'solid-js';
import { ChevronDown } from 'lucide-solid';
import { authStore } from '~/stores/auth';

function getTenantName(tenantId: string | null): string {
  if (!tenantId) return 'Select tenant...';
  if (authStore.isPBAdmin && tenantId === 'instance') return 'Instance Settings';
  const tenant = authStore.tenants.find(t => t.tenant === tenantId);
  return tenant ? (tenant.tenantName || tenant.tenant).substring(0, 20) : 'Select tenant...';
}

export default function TenantSelector() {
  const currentValue = () => authStore.currentTenant || '';

  const handleChange = async (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    if (value === 'instance') {
      authStore.switchTenant(null);
    } else if (value) {
      authStore.switchTenant(value);
    }
  };

  return (
    <div class="relative group">
      <div class="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
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
                class={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${
                  currentValue() === t.tenant ? 'text-blue-600 dark:text-blue-400 bg-gray-50 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:text-white'
                }`}
              >
                <span class="truncate">{t.tenantName || t.tenant}</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-600 dark:text-gray-500">{t.role}</span>
                  <Show when={currentValue() === t.tenant}>
                    <span class="text-xs text-blue-600 dark:text-blue-400">✓</span>
                  </Show>
                </div>
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