'use client';
import { createBrowserClient } from '@supabase/ssr';
import { useState } from 'react';
export function LoginButton() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function login() {
    setBusy(true); setError('');
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    const {error} = await supabase.auth.signInWithOAuth({provider: 'github', options: {redirectTo: `${window.location.origin}/auth/callback`}});
    if (error) {setError('Не удалось открыть GitHub OAuth.'); setBusy(false);}
  }
  return <><button className="primary-action" onClick={login} disabled={busy}>{busy ? 'Подключаем…' : 'Войти через GitHub →'}</button>{error && <p role="alert" className="error-text">{error}</p>}</>;
}
