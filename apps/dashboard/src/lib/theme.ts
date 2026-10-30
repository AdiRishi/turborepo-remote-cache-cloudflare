import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/** Runs before the first paint, from the document head, so the page never flashes the wrong theme. */
export const THEME_SCRIPT = `(() => {
  const stored = localStorage.getItem('${STORAGE_KEY}');
  const dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
})()`;

const listeners = new Set<() => void>();

const currentTheme = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const setTheme = (next: Theme) => {
  localStorage.setItem(STORAGE_KEY, next);
  document.documentElement.classList.toggle('dark', next === 'dark');
  for (const listener of listeners) {
    listener();
  }
};

export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'dark' as const);
  return {
    theme,
    toggle: () => {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    },
  };
};
