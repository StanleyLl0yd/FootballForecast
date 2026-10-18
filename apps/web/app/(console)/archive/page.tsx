import {EmptyState,PageHeading} from '@/components/empty-state';
import {readPublicArchive} from '@/lib/public-archive';

export const dynamic='force-dynamic';

const date=new Intl.DateTimeFormat('ru-RU',{
  dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Moscow'
});
const percentage=new Intl.NumberFormat('ru-RU',{
  style:'percent',minimumFractionDigits:1,maximumFractionDigits:1
});

export default async function Page(){
  const snapshot=await readPublicArchive();
  return <><PageHeading eyebrow="ARCHIVE" title="Архив прогнозов"
    subtitle="Опубликованные предматчевые вероятности с оригинальной ревизией и хэшем, без переписывания истории."/>
    <section className="panel">
      <h2>История публикаций</h2>
      {snapshot.state==='ready' && snapshot.forecasts.length>0 ?
        <ol className="forecast-list">{snapshot.forecasts.map(f=>
          <li key={f.id}>
            <div className="forecast-record-head">
              <strong>{f.home} - {f.away}</strong>
              <span>Матч: {date.format(new Date(f.kickoffAt))} МСК</span>
            </div>
            <div className="forecast-probabilities" aria-label="Вероятности исходов">
              <span>П1 <strong>{percentage.format(f.homeWin)}</strong></span>
              <span>Х <strong>{percentage.format(f.draw)}</strong></span>
              <span>П2 <strong>{percentage.format(f.awayWin)}</strong></span>
            </div>
            <p className="forecast-provenance">Опубликовано: {date.format(new Date(f.predictedAt))} МСК
              {' · '}Ревизия {f.revision}
              {' · '}Модель {f.modelVersion}
              {' · '}SHA-256 {f.predictionHash.slice(0,12)}…</p>
          </li>
        )}</ol> :
        <EmptyState
          title={snapshot.state==='unavailable'?'Архив временно недоступен':
            snapshot.state==='not_configured'?'База пока не настроена':'Архив пуст'}
          description={snapshot.state==='unavailable'?'Не удалось подтвердить список публикаций через Supabase. Это не означает отсутствия прогнозов.':
            snapshot.state==='not_configured'?'Публичное соединение Supabase пока отсутствует.':
            'Ни один прогноз пока не опубликован. Новые ревизии никогда не перезаписывают прежние.'}/>}
    </section>
  </>;
}
