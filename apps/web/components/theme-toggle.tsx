'use client';
import {useEffect, useSyncExternalStore} from 'react';
import {Moon, Sun} from 'lucide-react';

type Theme = 'dark' | 'light';
function snapshot(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem('ff-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* Storage can be disabled. */ }
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener('ff-theme-change', listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener('ff-theme-change', listener);
  };
}
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { window.localStorage.setItem('ff-theme', next); } catch { /* Choice remains active in this tab. */ }
    window.dispatchEvent(new Event('ff-theme-change'));
  }
  return <button className="theme-toggle" type="button" onClick={toggle} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} title="Переключить тему">{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button>;
}
