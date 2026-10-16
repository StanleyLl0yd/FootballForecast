import Link from 'next/link';
export default function Denied() {return <main className="auth-container"><div className="auth-card"><p className="eyebrow">403 / ДОСТУП ЗАПРЕЩЁН</p><h1>Аккаунт не разрешён</h1><p>Войти может только GitHub-аккаунт с идентификатором владельца.</p><Link href="/login" className="back-link">Вернуться ко входу →</Link></div></main>}
