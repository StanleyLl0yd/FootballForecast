import Link from 'next/link';
import { signOut } from '@/app/actions';
import {ThemeToggle} from '@/components/theme-toggle';
import {LayoutDashboard, CalendarDays, FlaskConical, ChartNoAxesCombined, Database, Archive, Settings2, ShieldCheck, CircleDot} from 'lucide-react';
const nav = [
  {href:'/dashboard',label:'Обзор',icon:LayoutDashboard},
  {href:'/matches',label:'Матчи и прогнозы',icon:CalendarDays},
  {href:'/models',label:'Лаборатория моделей',icon:FlaskConical},
  {href:'/analytics',label:'Качество прогнозов',icon:ChartNoAxesCombined},
  {href:'/data',label:'Центр данных',icon:Database},
  {href:'/archive',label:'Архив прогнозов',icon:Archive},
  {href:'/admin',label:'Настройки',icon:Settings2},
];
export function Shell({children}:{children:React.ReactNode}) {
  return <div className="application"><aside className="sidebar"><Link href="/dashboard" className="brand"><span className="logo-mark">F<span>F</span></span><span><strong>FOOTBALL</strong><small>FORECAST</small></span></Link><div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div><nav className="navigation" aria-label="Основная навигация">{nav.map(({href,label,icon:Icon})=><Link key={href} href={href}><Icon size={17} strokeWidth={1.8}/><span>{label}</span></Link>)}</nav><div className="sidebar-bottom"><div className="secure-label"><ShieldCheck size={17}/> Приватная платформа</div><form action={signOut}><button className="logout-button">Выйти</button></form></div></aside><div className="main-area"><header className="topbar"><span><CircleDot size={15} className="accent-dot"/> M0 · Подготовка данных</span><span className="topbar-actions">РПЛ · Europe/Moscow <ThemeToggle/></span></header><main className="content">{children}</main></div></div>
}
