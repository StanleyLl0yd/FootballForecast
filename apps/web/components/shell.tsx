import Link from 'next/link';
import {ThemeToggle} from '@/components/theme-toggle';
import {LayoutDashboard, CalendarDays, FlaskConical, ChartNoAxesCombined, Database, Archive, CircleDot, Wifi} from 'lucide-react';
const nav = [
  {href:'/dashboard',label:'Обзор',icon:LayoutDashboard},
  {href:'/matches',label:'Матчи и прогнозы',icon:CalendarDays},
  {href:'/models',label:'Лаборатория моделей',icon:FlaskConical},
  {href:'/analytics',label:'Качество прогнозов',icon:ChartNoAxesCombined},
  {href:'/data',label:'Центр данных',icon:Database},
  {href:'/archive',label:'Архив прогнозов',icon:Archive},
  {href:'/connectivity',label:'Проверка связи',icon:Wifi},
];
export function Shell({children}:{children:React.ReactNode}) {
  return <div className="application"><aside className="sidebar"><Link href="/dashboard" className="brand"><span className="logo-mark">F<span>F</span></span><span><strong>FOOTBALL</strong><small>FORECAST</small></span></Link><div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div><nav className="navigation" aria-label="Основная навигация">{nav.map(({href,label,icon:Icon})=><Link key={href} href={href}><Icon size={17} strokeWidth={1.8}/><span>{label}</span></Link>)}</nav><div className="sidebar-bottom"><span className="secure-label">Публичный просмотр · без регистрации</span></div></aside><div className="main-area"><header className="topbar"><span><CircleDot size={15} className="accent-dot"/> M1 · Проверенные матчи</span><span className="topbar-actions">РПЛ · Europe/Moscow <ThemeToggle/></span></header><main className="content">{children}</main></div></div>
}
