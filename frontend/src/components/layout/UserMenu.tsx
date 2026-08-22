import { Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { LogOut, User } from 'lucide-solid';
import { authStore } from '~/stores/auth';

function getInitials(email: string): string {
  if (!email) return '?';
  const parts = email.split('@')[0].split('.');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

function getRoleLabel(): string {
  if (authStore.isPBAdmin) return 'PB Admin';
  const role = authStore.role;
  if (!role) return 'No role';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function UserMenu() {
  const navigate = useNavigate();

  const email = () => authStore.user?.email || '';
  const initials = () => getInitials(email());
  const roleLabel = () => {
    const label = getRoleLabel();
    if (authStore.isPBAdmin) return label;
    const tenant = authStore.tenants.find(t => t.tenant === authStore.currentTenant);
    return tenant ? `${label} · ${tenant.tenant.substring(0, 12)}...` : label;
  };

  return (
    <div class="relative group">
      <div class="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-gray-900 dark:text-white text-sm font-medium">
          {initials()}
        </div>
        <span class="text-gray-700 dark:text-gray-300 text-sm hidden md:block">{email()}</span>
      </div>

      <div class="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div class="text-gray-900 dark:text-white text-sm font-medium truncate">{email()}</div>
          <div class="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{roleLabel()}</div>
        </div>
<button
          type="button"
          onClick={() => navigate('/profile')}
          data-testid="user-menu-profile"
          class="w-full text-left px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white text-sm flex items-center gap-2"
        >
          <User size={16} />
          Profile
        </button>
        <button
          onClick={async () => { await authStore.logout(); window.location.href = '/login'; }}
          class="w-full text-left px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white text-sm flex items-center gap-2"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  );
}