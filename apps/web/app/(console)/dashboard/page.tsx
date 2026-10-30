import {EmptyState,PageHeading} from '@/components/empty-state';
import {CalendarDays,ChartNoAxesCombined,Database,FlaskConical} from 'lucide-react';
import {readPublicOverview} from '@/lib/public-overview';
export const dynamic='force-dynamic';
export default async function Dashboard(){
  const data=await readPublicOverview();
  const connection=data.state==='ready'?'Публичная база подключена':
    data.state==='not_configured'?'Публичная база ещё не настроена':'Данные временно недоступны';
  return <><PageHeading eyebrow="ОБЗОР / РОССИЙСКАЯ ПРЕМЬЕР-ЛИГА" title="Футбольная аналитика" subtitle="Прогнозы и статистика с проверяемым происхождением данных. Время: Москва (МСК)."/><div className="stat-grid"><div className="stat"><span>Матчей в базе</span><strong>{data.matches ?? "—"}</strong><small>{connection}</small></div><div className="stat"><span>Опубликованных прогнозов</span><strong>{data.forecasts ?? "—"}</strong><small>{data.state==="ready"?"Публичный архив":"Нет подтверждённых данных"}</small></div><div className="stat"><span>Log Loss</span><strong>—</strong><small>Оценка не проводилась</small></div><div className="stat"><span>Последняя синхронизация</span><strong>—</strong><small>Время следующего обновления не подтверждено</small></div></div><div className="panel-grid"><section className="panel"><div className="panel-heading"><CalendarDays size={18}/><h2>Ближайшие матчи</h2></div>{data.fixtures.length ? <ul className="fixture-list">{data.fixtures.map(f=>
  <li key={f.id}><strong>{f.home} - {f.away}</strong>
  <span>{new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(f.kickoffAt))} МСК</span></li>
)}</ul> : <EmptyState
 title={data.state==='unavailable'?'Данные недоступны':
   data.state==='not_configured'?'Подключение данных не настроено':
   'Нет ближайших матчей с подтверждённым временем'}
 description={data.state==='unavailable'?
   'Не удалось получить сведения из публичной базы. Показатели не подменяются нулями.':
   data.state==='not_configured'?'Публичное подключение Supabase ещё не настроено.':
   'Исторические результаты уже доступны в разделе «Матчи». Встречи без подтверждённого часа начала не показываются как точное расписание.'} />}</section><section className="panel"><div className="panel-heading"><ChartNoAxesCombined size={18}/><h2>Вероятностная оценка</h2></div><EmptyState title="Нет проверенных прогнозов" description="Показатели появятся только после исторического тестирования и калибровки." /></section></div><div className="panel-grid secondary-panels"><section className="panel informative"><div className="panel-heading"><Database size={18}/><h2>Покрытие данных</h2></div><p>Минимум РПЛ: 2024/25 для базовой модели, 2025/26 для независимой проверки и 2026/27 для текущих матчей. Footbolno: три проверенных сезона в защищённой базе; качество прогнозов ещё не измерялось.</p><span className="status-chip">Источник: Footbolno CC BY 4.0</span></section><section className="panel informative"><div className="panel-heading"><FlaskConical size={18}/><h2>Жизненный цикл моделей</h2></div><p>Сначала проверенные исторические данные, затем Poisson, Dixon-Coles, Elo и независимое тестирование.</p><span className="status-chip">Текущий этап: M1</span></section></div><p className="source-disclaimer">Данные матчей: <a href="https://footbolno.ru/otkrytye-dannye" target="_blank" rel="noopener noreferrer">Footbolno (CC BY 4.0)</a>. Неизвестное точное время начала не заменяется фиктивным. Опубликованных прогнозов пока нет.</p></>}
