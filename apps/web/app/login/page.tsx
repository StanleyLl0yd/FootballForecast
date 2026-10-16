import {configured} from '@/lib/auth';
import {LoginButton} from '@/components/login-button';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default function Login() {return <main className="auth-container"><div className="auth-card"><div className="logo-mark">F<span>F</span></div><p className="eyebrow">ПРИВАТНАЯ АНАЛИТИЧЕСКАЯ ПЛАТФОРМА</p><h1>FootballForecast</h1><p>Только владелец проекта имеет доступ к данным, прогнозам и управлению моделями.</p>{configured() ? <LoginButton /> : <Link className="primary-action" href="/setup">Сначала подключить Supabase</Link>}<p className="fine-print">Вход через GitHub. Проверяется неизменяемый ID аккаунта, не отображаемое имя.</p></div></main>}
