import {configured} from '@/lib/auth';
import {LoginButton} from '@/components/login-button';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export default function Login(){
  const enabled=configured();
  return <main className="auth-container"><div className="auth-card">
    <div className="logo-mark">F<span>F</span></div>
    <p className="eyebrow">АДМИНИСТРИРОВАНИЕ / M0</p>
    <h1>Вход администратора</h1>
    <p>Просмотр матчей и прогнозов открыт всем. Учётная запись для него не требуется.</p>
    {enabled ? <LoginButton /> :
      <p className="fine-print">Административный вход пока не настроен. Изменение данных и запуск обучения недоступны.</p>}
    <Link className="back-link" href="/dashboard">Вернуться к публичному обзору →</Link>
  </div></main>;
}
