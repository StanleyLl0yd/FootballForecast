'use client';
import { useEffect, useState } from 'react';
import {Moon, Sun} from 'lucide-react';

type Theme = 'dark' | 'light';
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem('ff-theme'); } catch { /* Storage is optional. */ }
    const next: Theme = saved === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
  }, []);
  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
    try { window.localStorage.setItem('ff-theme', next); } catch { /* Still apply UI choice. */ }
  }
  return <button className="theme-toggle" type="button" onClick={toggle} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} title="Переключить тему">{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button>;
}
