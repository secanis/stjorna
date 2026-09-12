import { useNavigate } from '@solidjs/router';
import LoginCard from '~/components/auth/LoginCard';

export default function SuperuserLogin() {
  const navigate = useNavigate();

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-2">STJÓRNA</h1>
          <p class="text-gray-500 dark:text-gray-400">Superuser sign in</p>
        </div>

        <LoginCard
          mode="admin"
          onSuccess={() => navigate('/')}
          errorHint="If this is a fresh PocketBase, run First-time setup below."
        />

        <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-3 text-center">
          <button
            onClick={() => navigate('/setup?mode=admin')}
            class="block w-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
          >
            First-time setup?
          </button>
          <button
            onClick={() => navigate('/login')}
            class="block w-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
          >
            Back to user login
          </button>
        </div>
      </div>
    </div>
  );
}
