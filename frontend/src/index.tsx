import { render } from 'solid-js/web';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { Suspense } from 'solid-js';
import App from './App';
import './index.css';
import './styles/colors.css';

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