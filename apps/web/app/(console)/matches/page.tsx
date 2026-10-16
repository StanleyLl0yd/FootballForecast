import {EmptyState,PageHeading} from '@/components/empty-state';
import {readPublicOverview} from '@/lib/public-overview';

export const dynamic='force-dynamic';
export default async function Page(){
  const data=await readPublicOverview();
  return <><PageHeading eyebrow="МАТЧИ" title="Матчи и прогнозы"
    subtitle="Проверенные матчи РПЛ и опубликованные предматчевые вероятности. Без вымышленных результатов."/>
    <section className="panel">
      {data.fixtures.length ? <ul className="fixture-list">{data.fixtures.map(f=>
        <li key={f.id}><strong>{f.home} - {f.away}</strong>
        <span>{new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(f.kickoffAt))} МСК</span></li>
      )}</ul> : <EmptyState
        title={data.state==='unavailable'?'Временная ошибка получения данных':
          data.state==='not_configured'?'Подключение данных не настроено':'Каталог пуст'}
        description={data.state==='unavailable'?'Публичные данные временно недоступны. Попробуйте позже.':
          data.state==='not_configured'?'Администратор ещё не указал публичные настройки Supabase.':
          'Матчи появятся после импорта верифицированного календаря РПЛ. Демонстрационные результаты скрыты.'}/>}
    </section></>;
}
