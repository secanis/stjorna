import { render } from 'solid-js/web';
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

render(
  () => (
    <Suspense>
      <App />
    </Suspense>
  ),
  document.getElementById('root')!,
);