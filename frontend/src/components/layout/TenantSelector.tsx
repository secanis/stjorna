import { Show, For, createSignal, createEffect, onCleanup, onMount } from 'solid-js';
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
// protected-file token refresh. Falls back to the tenant's initials (first
// two chars of the name) when there is no logo or the media record is
// missing/inaccessible.
function initialsOf(name: string): string {
  const t = (name || '').trim();
  return t ? t.slice(0, 2).toUpperCase() : '?';
}

function TenantAvatar(props: { name?: string; themeConfig?: TenantThemeConfig }) {
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
        // unknown/deleted media or no read access → fall through to initials
      }
    })();
    onCleanup(() => { cancelled = true; });
  });

  return (
    <Show
      when={media()}
      keyed
      fallback={
        <div class="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
          {initialsOf(props.name || '')}
        </div>
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

  // Keyboard/click accessible menu (WAI-ARIA menu button pattern). Hover
  // still opens it for pointer users; Enter/Space/ArrowDown on the
  // trigger, arrow keys/Home/End inside, Escape/Tab/outside click close.
  const [open, setOpen] = createSignal(false);
  let rootRef: HTMLDivElement | undefined;
  let triggerRef: HTMLButtonElement | undefined;
  let menuRef: HTMLDivElement | undefined;

  const items = () => Array.from(menuRef?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
  const focusItem = (index: number) => {
    const list = items();
    if (list.length === 0) return;
    list[(index + list.length) % list.length].focus();
  };
  const openMenu = (focus: 'current' | 'first' | 'last' = 'current') => {
    setOpen(true);
    queueMicrotask(() => {
      const list = items();
      if (focus === 'last') return focusItem(list.length - 1);
      const checked = list.findIndex((el) => el.getAttribute('aria-checked') === 'true');
      focusItem(focus === 'current' && checked >= 0 ? checked : 0);
    });
  };
  const closeMenu = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef?.focus();
  };
  const select = (tenantId: string | null) => {
    closeMenu();
    void authStore.switchTenant(tenantId);
  };

  const onTriggerKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu(e.key === 'ArrowDown' ? 'first' : 'current');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu('last');
    }
  };
  const onMenuKeyDown = (e: KeyboardEvent) => {
    const list = items();
    const idx = list.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); focusItem(idx + 1); break;
      case 'ArrowUp': e.preventDefault(); focusItem(idx - 1); break;
      case 'Home': e.preventDefault(); focusItem(0); break;
      case 'End': e.preventDefault(); focusItem(list.length - 1); break;
      case 'Escape': e.preventDefault(); closeMenu(); break;
      case 'Tab': closeMenu(false); break;
    }
  };

  onMount(() => {
    const onDocPointer = (e: PointerEvent) => {
      if (open() && rootRef && !rootRef.contains(e.target as Node)) closeMenu(false);
    };
    document.addEventListener('pointerdown', onDocPointer);
    onCleanup(() => document.removeEventListener('pointerdown', onDocPointer));
  });

  return (
    <div class="relative group" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        id="tenant-selector-trigger"
        aria-haspopup="menu"
        aria-expanded={open()}
        aria-controls="tenant-selector-menu"
        aria-label={`Current tenant: ${getTenantName(currentValue())}. Switch tenant`}
        onClick={() => (open() ? closeMenu() : openMenu())}
        onKeyDown={onTriggerKeyDown}
        class="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <TenantAvatar
          name={currentTenant()?.tenantName || currentTenant()?.tenant}
          themeConfig={currentTenant()?.themeConfig}
        />
        <span class="text-gray-900 dark:text-white text-sm truncate max-w-[150px]">
          {getTenantName(currentValue())}
        </span>
        <ChevronDown size={14} class="text-gray-500 dark:text-gray-400 flex-shrink-0" />
      </button>

      <div
        ref={menuRef}
        id="tenant-selector-menu"
        role="menu"
        aria-labelledby="tenant-selector-trigger"
        onKeyDown={onMenuKeyDown}
        classList={{ 'opacity-100 visible': open(), 'opacity-0 invisible': !open() }}
        class="absolute left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 group-hover:opacity-100 group-hover:visible transition-all z-50"
      >
        <div class="py-1">
          <Show when={authStore.isPBAdmin}>
            <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700" role="presentation">
              <div class="text-xs text-gray-600 dark:text-gray-500 uppercase">System</div>
            </div>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={currentValue() === ''}
              tabIndex={-1}
              onClick={() => select(null)}
              class={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${
                currentValue() === '' ? 'text-blue-600 dark:text-blue-400 bg-gray-50 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:text-white'
              }`}
            >
              <span>Instance Settings</span>
              <Show when={currentValue() === ''}>
                <span class="text-xs text-blue-600 dark:text-blue-400">✓</span>
              </Show>
            </button>
            <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 mt-1" role="presentation">
              <div class="text-xs text-gray-600 dark:text-gray-500 uppercase">Tenants</div>
            </div>
          </Show>

          <For each={authStore.tenants}>
            {(t) => (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={currentValue() === t.tenant}
                tabIndex={-1}
                onClick={() => select(t.tenant)}
                class={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 ${
                  currentValue() === t.tenant ? 'text-blue-600 dark:text-blue-400 bg-gray-50 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:text-white'
                }`}
              >
                <TenantAvatar name={t.tenantName || t.tenant} themeConfig={t.themeConfig} />
                <span class="flex-1 truncate">{t.tenantName || t.tenant}</span>
                <span class="text-xs text-gray-600 dark:text-gray-500">{t.role}</span>
                <Show when={currentValue() === t.tenant}>
                  <span class="text-xs text-blue-600 dark:text-blue-400" aria-hidden="true">✓</span>
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
