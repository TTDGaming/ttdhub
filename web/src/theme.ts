import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'mshub-theme';

function apply(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => (localStorage.getItem(KEY) as ThemeMode) || 'system');

  useEffect(() => {
    apply(mode);
    localStorage.setItem(KEY, mode);
    if (mode !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  return { mode, setMode };
}
