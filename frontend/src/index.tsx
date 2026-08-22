import { render } from 'solid-js/web';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { Suspense } from 'solid-js';
import App from './App';
import './index.css';
import './styles/colors.css';
import { applyTheme } from './stores/theme';

// Apply the persisted theme before SolidJS mounts so the initial paint
// uses the correct colors. No flash of wrong theme on reload.
applyTheme(
  (typeof window !== 'undefined' && (window.localStorage.getItem('stjorna_theme_mode') as 'light' | 'dark' | 'system' | null)) || 'system'
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

render(
  () => (
    <QueryClientProvider client={queryClient}>
      <Suspense>
        <App />
      </Suspense>
    </QueryClientProvider>
  ),
  document.getElementById('root')!,
);