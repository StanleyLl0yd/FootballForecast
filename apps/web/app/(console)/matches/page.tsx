import {EmptyState,PageHeading} from '@/components/empty-state';
import {readPublicOverview} from '@/lib/public-overview';
import {readRecentResults} from '@/lib/public-results';

export const dynamic='force-dynamic';
export default async function Page(){
  const [data,recent]=await Promise.all([readPublicOverview(),readRecentResults()]);
  return <><PageHeading eyebrow="МАТЧИ" title="Матчи и прогнозы"
    subtitle="Проверенные результаты и расписание РПЛ. Прогнозы появятся после оценки статистической модели."/>
    <section className="panel"><h2>Ближайшие матчи</h2>
      {data.fixtures.length ? <ul className="fixture-list">{data.fixtures.map(f=>
        <li key={f.id}><strong>{f.home} - {f.away}</strong>
        <span>{new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(f.kickoffAt))} МСК</span></li>
      )}</ul> : <EmptyState
        title={data.state==='unavailable'?'Временная ошибка получения данных':
          data.state==='not_configured'?'Подключение данных не настроено':'Нет ближайших матчей с подтверждённым временем'}
        description={data.state==='unavailable'?'Публичные данные временно недоступны. Попробуйте позже.':
          data.state==='not_configured'?'Администратор ещё не указал публичные настройки Supabase.':
          'Часть будущих встреч пока имеет только дату без подтверждённого часа начала. Такие матчи не отображаются как точное расписание.'}/>}
    </section>
    <section className="panel"><h2>Последние результаты РПЛ</h2>
      {recent.results.length ? <ul className="fixture-list">{recent.results.map(r=>
        <li key={r.id}><strong>{r.home} {r.homeGoals}:{r.awayGoals} {r.away}</strong>
        <span>{new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(r.kickoffAt))} МСК</span></li>
      )}</ul> : <EmptyState
        title={recent.state==='unavailable'?'Результаты временно недоступны':
          recent.state==='not_configured'?'Подключение данных не настроено':'Нет подтверждённых результатов'}
        description="Здесь отображаются только завершённые матчи с проверенными счётом и временем начала."/>}
    </section><p className="source-disclaimer">Данные результатов и календаря: <a href="https://footbolno.ru/otkrytye-dannye" target="_blank" rel="noopener noreferrer">Footbolno (CC BY 4.0)</a>. Время и статус будущих матчей могут меняться; неподтверждённые часы начала не публикуются. Проверенных прогнозов пока нет.</p></>;
}
