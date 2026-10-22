'use client';

import {useRef,useState} from 'react';
import {
  summarizeFootbolno,summarizeSportScore,summarizeFootbolnoRplCsv,
  type ProviderPreview,type RplCsvAudit
} from '@/lib/source-preview-core.mjs';
import {readResponseTextBounded} from '@/lib/limited-response.mjs';

// Publisher-documented public endpoints. No proxy, keys or server storage.
const endpoints={
  footbolno:'https://footbolno.ru/data/league/235.json',
  sportscore:'https://sportscore.com/api/widget/matches/?sport=football&limit=10',
  footbolnoCsv:'https://footbolno.ru/data/league/235-matches.csv'
} as const;
type Provider=keyof typeof endpoints;
const maxJsonBytes=512*1024;
const maxCsvBytes=2_000_000;
const cooldownMs=60000;
const requestOptions=(accept:string)=>({
  method:'GET',credentials:'omit' as const,cache:'no-store' as const,
  referrerPolicy:'no-referrer' as const,redirect:'error' as const,
  headers:{Accept:accept},
  signal:AbortSignal.timeout(10000)
});

export function OpenProviderPreview(){
  const [reports,setReports]=useState<Partial<Record<'footbolno'|'sportscore',ProviderPreview>>>({});
  const [csvAudit,setCsvAudit]=useState<RplCsvAudit|null>(null);
  const [errors,setErrors]=useState<Partial<Record<Provider,string>>>({});
  const [loading,setLoading]=useState<Provider|null>(null);
  const lastRequests=useRef<Partial<Record<Provider,number>>>({});

  const canRequest=(provider:Provider)=>{
    if(loading)return false;
    const now=Date.now();
    if(now-(lastRequests.current[provider]??0)<cooldownMs){
      setErrors(old=>({...old,[provider]:'Повторная проверка доступна через минуту.'}));
      return false;
    }
    lastRequests.current[provider]=now;
    setLoading(provider);
    setErrors(old=>({...old,[provider]:''}));
    return true;
  };

  const inspect=async(provider:'footbolno'|'sportscore')=>{
    if(!canRequest(provider))return;
    setReports(old=>({...old,[provider]:undefined}));
    try{
      const response=await fetch(endpoints[provider],requestOptions('application/json'));
      const type=response.headers.get('content-type')??'';
      if(!/application\/json|\+json/i.test(type))throw new Error('Unexpected JSON content type');
      const payload=await readResponseTextBounded(response,maxJsonBytes);
      const decoded:unknown=JSON.parse(payload);
      const report=provider==='footbolno'
        ?summarizeFootbolno(decoded)
        :summarizeSportScore(decoded);
      setReports(old=>({...old,[provider]:report}));
    }catch{
      setErrors(old=>({...old,[provider]:
        'Источник недоступен или ответ не соответствует опубликованному формату. Импорт не выполнялся.'}));
    }finally{setLoading(null)}
  };

  const inspectCsv=async()=>{
    if(!canRequest('footbolnoCsv'))return;
    setCsvAudit(null);
    try{
      const response=await fetch(endpoints.footbolnoCsv,
        requestOptions('text/csv,text/plain;q=0.9'));
      const type=response.headers.get('content-type')??'';
      if(!/text\/csv|text\/plain|application\/octet-stream/i.test(type))
        throw new Error('Unexpected CSV content type');
      const text=await readResponseTextBounded(response,maxCsvBytes);
      setCsvAudit(summarizeFootbolnoRplCsv(text));
    }catch{
      setErrors(old=>({...old,footbolnoCsv:
        'CSV недоступен или структура изменилась. Результаты не импортированы.'}));
    }finally{setLoading(null)}
  };

  return <section className="panel historical-source-evidence">
    <h2>Проверка бесплатных источников по запросу</h2>
    <p>Запросы только после нажатия. Браузер обращается к опубликованным API напрямую,
      без сервера-посредника, ключей и записи исходных данных в Supabase.
      Результаты вычисляются в памяти этой вкладки, без постоянного хранения.</p>
    <div className="source-preview-grid">
      <div className="source-preview-item">
        <h3>Footbolno: РПЛ и три сезона</h3>
        <p>Лицензия CC BY 4.0. Одна JSON-сводка либо один CSV турнира 235.
          CSV анализируется локально: 2024/25, 2025/26 и 2026/27,
          без сохранения отдельных матчей.</p>
        <button type="button" className="source-lab-download"
          onClick={()=>inspect('footbolno')} disabled={loading!==null}>
          Проверить таблицу РПЛ
        </button>
        <button type="button" className="source-lab-download"
          onClick={inspectCsv} disabled={loading!==null}>
          Проверить три сезона по CSV
        </button>
        {loading==='footbolno'||loading==='footbolnoCsv'
          ?<p role="status">Проверка опубликованных данных…</p>:null}
        {errors.footbolno?<p role="alert" className="source-lab-error">{errors.footbolno}</p>:null}
        {errors.footbolnoCsv?<p role="alert" className="source-lab-error">{errors.footbolnoCsv}</p>:null}
        {reports.footbolno?<p role="status">
          Строк таблицы: {reports.footbolno.count}.
          Обновление по данным поставщика: {reports.footbolno.updated??'не указано'}.
        </p>:null}
        {csvAudit?<div role="status">
          <p>Всего строк CSV в памяти: {csvAudit.publisherRows}.
            Это свежая проверка браузера, а не достоверная дата обновления каждой записи.</p>
          <table className="rpl-source-csv-table">
            <caption>Структурная проверка результатов Footbolno, не официальная приёмка</caption>
            <thead><tr><th scope="col">Сезон</th><th scope="col">Всего</th>
              <th scope="col">Сыграно</th><th scope="col">Ожидают</th>
              <th scope="col">Голы</th><th scope="col">Структура</th></tr></thead>
            <tbody>{csvAudit.seasonSummaries.map(s=><tr key={s.season}>
              <th scope="row">{s.season}</th><td>{s.matches}</td>
              <td>{s.finished}</td><td>{s.scheduled}</td>
              <td>{s.homeGoals+s.awayGoals}</td>
              <td>{s.structuralCandidate?'Без структурных ошибок':'Требует проверки'}</td>
            </tr>)}</tbody>
          </table>
          <h4>Ближайшие матчи РПЛ 2026/27 из того же CSV</h4>
          {csvAudit.upcomingFixtures.length
            ?<ul className="rpl-upcoming-fixtures">
              {csvAudit.upcomingFixtures.map((f,i)=><li key={i}>
                <strong>{f.home} - {f.away}</strong>
                {' · '}{f.timeConfirmed
                  ?new Intl.DateTimeFormat('ru-RU',{
                    timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',
                    hour:'2-digit',minute:'2-digit'
                  }).format(new Date(f.kickoffUtc))+' МСК'
                  :f.kickoffUtc.slice(0,10)+' (время не подтверждено)'}
              </li>)}
            </ul>
            :<p>В опубликованном CSV не найдено предстоящих матчей
              с пригодной датой. Это не доказательство отсутствия матчей РПЛ.</p>}
          <p>Список поставщика показан без независимого подтверждения календаря
            и переносов. На каждый просмотр используется тот же одиночный CSV-запрос.</p>
          <p>Проблемы структуры, дат и прошлых запланированных матчей: {csvAudit.seasonSummaries.reduce(
            (n,s)=>n+s.duplicates+s.duplicateMatchIds+s.missingTeams+s.invalidScores+
                  s.invalidDates+s.invalidTimeFlags+s.pastScheduled,0)}.
            Технические результаты, сторонние исправления и историческая дата публикации
            каждого матча всё ещё требуют отдельной сверки.</p>
        </div>:null}
        <p className="source-lab-note">Источник данных:
          {' '}<a href="https://footbolno.ru/otkrytye-dannye">Footbolno.ru (CC BY 4.0)</a>
        </p>
      </div>
      <div className="source-preview-item">
        <h3>SportScore: последние футбольные матчи</h3>
        <p>Только 10 матчей из мировой футбольной ленты.
          Это не полный календарь РПЛ и не база исторических сезонов.</p>
        <button type="button" className="source-lab-download"
          onClick={()=>inspect('sportscore')} disabled={loading!==null}>
          Проверить открытый API
        </button>
        {loading==='sportscore'?<p role="status">Загрузка публичной ленты…</p>:null}
        {errors.sportscore?<p role="alert" className="source-lab-error">{errors.sportscore}</p>:null}
        {reports.sportscore?<div role="status">
          <p>Получено матчей: {reports.sportscore.count}.
            Обновление по данным поставщика: {reports.sportscore.updated??'не указано'}.</p>
          {reports.sportscore.examples.length?<ul>{reports.sportscore.examples.map((m,i)=>
            <li key={i}>{m.home??'Неизвестно'} - {m.away??'Неизвестно'}
              {' '}({m.status??'статус неизвестен'})</li>)}</ul>:null}
        </div>:null}
        <p className="source-lab-note">Данные:
          {' '}<a href="https://sportscore.com/" rel="dofollow"
            title="Sports data by SportScore">Powered by SportScore</a>
        </p>
      </div>
    </div>
    <p className="source-lab-warning">Это исследовательская проверка опубликованных сведений, не прогноз
      и не производственный импорт. Совпадение числа матчей и голов не подтверждает
      права первоисточников, корректность всех результатов или отсутствие утечки будущей
      информации в модель. Автообновления и фоновых запросов нет.</p>
  </section>;
}
