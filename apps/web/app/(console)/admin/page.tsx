import {requireOwner} from '@/lib/auth';
import {readOverdueScheduledCount} from '@/lib/current-freshness';
import {PageHeading} from '@/components/empty-state';

export const dynamic = 'force-dynamic';

export default async function Page(){
  await requireOwner();
  const freshness=await readOverdueScheduledCount();
  const status=freshness.state==='ready'
    ? freshness.count>0
      ? `Матчей со статусом «запланирован», начавшихся более двух часов назад: ${freshness.count}. Итоги не подтверждены в базе.`
      : 'Просроченных статусов по двухчасовому порогу не обнаружено.'
    : freshness.state==='not_configured'
      ? 'Публичное чтение Supabase не настроено; актуальность матчей не определена.'
      : 'Не удалось проверить актуальность статусов матчей.';
  return <>
    <PageHeading eyebrow="ADMIN" title="Состояние системы" subtitle="Административный раздел доступен только владельцу."/>
    <section className="panel informative">
      <h2>M1: защищённая проверка данных</h2>
      <p>Защищённый импорт Footbolno и сверка источников выполняются отдельно через GitHub Actions. Из веб-интерфейса нельзя запускать импорт, обучать модели или изменять источники. Прогнозы ещё не опубликованы, M2 не начат.</p>
      <h3>Актуальность результатов РПЛ</h3>
      <p>{status}</p>
      <p>Это только сигнал задержки источника после запланированного начала, а не подтверждение завершения матча. Записи и результаты автоматически не исправляются.</p>
    </section>
  </>;
}
