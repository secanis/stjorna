import { createSignal, createEffect, onCleanup } from 'solid-js';

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

// React to OS-level theme changes while in 'system' mode.
if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (mode() === 'system') applyTheme('system');
  };
  mq.addEventListener('change', onChange);
  // Keep the listener alive for the lifetime of the app. No cleanup
  // needed — the same handler is idempotent.
  onCleanup(() => mq.removeEventListener('change', onChange));
}