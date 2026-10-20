import { ParentProps, createEffect } from 'solid-js';
import Sidebar from './Sidebar';
import Header from './Header';
import MfaBanner from './MfaBanner';
import { authStore } from '~/stores/auth';
import { tenantTheme } from '~/stores/tenantTheme';

export default function Layout(props: ParentProps) {
  // (Re)load the per-tenant theme whenever the selected tenant changes
  // (and clear it for PB admins, who have no tenant selected).
  createEffect(() => {
    void tenantTheme.load(authStore.currentTenant ?? null);
  });

  return (
    <div class="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div class="flex-1 flex flex-col">
        <Header />
        <MfaBanner />
        <main class="flex-1 p-6">
          {props.children}
        </main>
      </div>
    </div>
  );
}