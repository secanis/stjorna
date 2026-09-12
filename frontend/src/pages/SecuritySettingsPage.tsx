import { onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Shield } from 'lucide-solid';
import { authStore } from '~/stores/auth';
import SecuritySettings from '~/components/settings/SecuritySettings';
import DescriptionBlock from '~/components/settings/DescriptionBlock';

export default function SecuritySettingsPage() {
  const navigate = useNavigate();

  onMount(async () => {
    await authStore.init();
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    if (!authStore.isPBAdmin) {
      navigate('/', { replace: true });
      return;
    }
  });

  return (
    <div class="space-y-6 max-w-3xl">
      <div class="flex items-center gap-3">
        <Shield size={24} class="text-gray-500 dark:text-gray-400" />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Security Settings</h1>
      </div>

      <DescriptionBlock>
        <p>Control how superusers and regular users authenticate.</p>
        <p>
          Email OTP allows login with a code instead of a password. MFA requires two different login methods
          and applies to every account in the selected collection.
        </p>
      </DescriptionBlock>

      <SecuritySettings />
    </div>
  );
}
