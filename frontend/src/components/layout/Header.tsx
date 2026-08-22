import { Show } from 'solid-js';
import TenantSelector from './TenantSelector';
import UserMenu from './UserMenu';
import { authStore } from '~/stores/auth';

export default function Header() {
  return (
    <header class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
      <div class="text-xl font-bold text-gray-900 dark:text-white">STJÓRNA</div>
      <div class="flex items-center gap-4">
        <Show when={!authStore.isPBAdmin}>
          <TenantSelector />
          <div class="border-l border-gray-200 dark:border-gray-700 h-6" />
        </Show>
        <UserMenu />
      </div>
    </header>
  );
}