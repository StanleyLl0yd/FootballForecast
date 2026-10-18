import Link from 'next/link';
export default function Setup(){
  return <main className="auth-container"><div className="auth-card">
    <p className="eyebrow">FOOTBALLFORECAST / M0</p>
    <h1>Административный вход пока не настроен</h1>
    <p>Публичный обзор работает без регистрации. GitHub OAuth для управления моделями и данными пока не включён.</p>
    <p className="secondary">Вход администратора можно настроить отдельно после разрешения соответствующих функций и проверки безопасности.</p>
    <Link className="back-link" href="/dashboard">Открыть публичный обзор →</Link>
  </div></main>;
}
