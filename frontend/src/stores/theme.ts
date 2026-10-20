import { createSignal } from 'solid-js';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'stjorna_theme_mode';

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

// Effective mode for the `dark` class: 'system' resolves to OS preference.
function resolveEffective(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

// Apply the dark class to <html> based on the effective mode. Safe to
// call before SolidJS mounts — used in index.tsx to avoid a flash of
// the wrong theme on initial paint.
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const effective = resolveEffective(mode);
  document.documentElement.classList.toggle('dark', effective === 'dark');
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage may be unavailable (private mode, etc.) — ignore.
  }
}

const [mode, setModeSignal] = createSignal<ThemeMode>(readStoredMode());

export const themeStore = {
  get mode() {
    return mode();
  },
  get effective() {
    return resolveEffective(mode());
  },
  setMode(next: ThemeMode) {
    setModeSignal(next);
    applyTheme(next);
  },
};

// React to OS-level theme changes while in 'system' mode. The listener
// lives for the lifetime of the page; onCleanup() at module scope has
// no owner and never runs, so it is intentionally not used here.
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (mode() === 'system') applyTheme('system');
  });
}