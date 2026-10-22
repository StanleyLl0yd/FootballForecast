'use client';

import {useRef,useState} from 'react';
import {summarizeFootbolno,summarizeSportScore,type ProviderPreview} from '@/lib/source-preview-core.mjs';

// Only publisher-documented public GET endpoints. No proxy, key or database.
const endpoints={
  footbolno:'https://footbolno.ru/data/league/235.json',
  sportscore:'https://sportscore.com/api/widget/matches/?sport=football&limit=10'
} as const;
type Provider=keyof typeof endpoints;
const maxResponseCharacters=512*1024;
const cooldownMs=60000;

export function OpenProviderPreview(){
  const [reports,setReports]=useState<Partial<Record<Provider,ProviderPreview>>>({});
  const [errors,setErrors]=useState<Partial<Record<Provider,string>>>({});
  const [loading,setLoading]=useState<Provider|null>(null);
  const lastRequests=useRef<Partial<Record<Provider,number>>>({});

  const inspect=async(provider:Provider)=>{
    if(loading)return;
    const now=Date.now();
    if(now-(lastRequests.current[provider]??0)<cooldownMs){
      setErrors(old=>({...old,[provider]:'Повторная проверка доступна через минуту.'}));
      return;
    }
    lastRequests.current[provider]=now;
    setLoading(provider);
    setErrors(old=>({...old,[provider]:''}));
    setReports(old=>({...old,[provider]:undefined}));
    try{
      const response=await fetch(endpoints[provider],{
        method:'GET',credentials:'omit',cache:'no-store',
        referrerPolicy:'no-referrer',redirect:'error',
        headers:{Accept:'application/json'},
        signal:AbortSignal.timeout(10000)
      });
      if(!response.ok||response.status!==200)throw new Error('Provider unavailable');
      const type=response.headers.get('content-type')??'';
      if(!/application\/json|\+json/i.test(type))throw new Error('Unexpected content type');
      const declaredLength=Number(response.headers.get('content-length'));
      if(declaredLength>maxResponseCharacters)throw new Error('Payload too large');
      const text=await response.text();
      if(text.length===0||text.length>maxResponseCharacters)
        throw new Error('Payload size invalid');
      const decoded:unknown=JSON.parse(text);
      const report=provider==='footbolno'
        ?summarizeFootbolno(decoded)
        :summarizeSportScore(decoded);
      setReports(old=>({...old,[provider]:report}));
    }catch{
      setErrors(old=>({...old,[provider]:
        'Источник недоступен или ответ не соответствует опубликованному формату. Импорт не выполнялся.'}));
    }finally{
      setLoading(null);
    }
  };

  return <section className="panel historical-source-evidence">
    <h2>Проверка бесплатных источников по запросу</h2>
    <p>Получение только после нажатия кнопки: запрос идёт непосредственно из браузера к открытым API,
      без серверного посредника, ключей, аккаунта или записи в Supabase.
      Ответ используется только для краткого просмотра и не сохраняется.</p>
    <div className="source-preview-grid">
      <div className="source-preview-item">
        <h3>Footbolno: сводка РПЛ</h3>
        <p>Открытая JSON-сводка турнира 235. Статистика опубликована поставщиком,
          но проверка каждого матча, версий и первоисточников не завершена.</p>
        <button type="button" className="source-lab-download" onClick={()=>inspect('footbolno')}
          disabled={loading!==null}>Проверить сводку РПЛ</button>
        {loading==='footbolno'?<p role="status">Загрузка открытой сводки…</p>:null}
        {errors.footbolno?<p role="alert" className="source-lab-error">{errors.footbolno}</p>:null}
        {reports.footbolno?<p role="status">Строк таблицы: {reports.footbolno.count}.
          Обновление по данным поставщика: {reports.footbolno.updated??'не указано'}.
          Дата проверки в браузере не заменяет дату обновления источника.</p>:null}
        <p className="source-lab-note">Источник данных:
          {' '}<a href="https://footbolno.ru/otkrytye-dannye">Footbolno.ru (CC BY 4.0)</a>
        </p>
      </div>
      <div className="source-preview-item">
        <h3>SportScore: последние футбольные матчи</h3>
        <p>Только 10 последних матчей из общей мировой футбольной ленты.
          Отсутствие РПЛ в таком ответе не означает отсутствия РПЛ у провайдера.</p>
        <button type="button" className="source-lab-download" onClick={()=>inspect('sportscore')}
          disabled={loading!==null}>Проверить открытый API</button>
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
    <p className="source-lab-warning">Исследовательский просмотр, не прогноз и не производственный импорт.
      Ни один результат не допускается к обучению без проверки счёта, условий использования
      и отсутствия информации из будущего. Автообновления и фоновых запросов нет.</p>
  </section>;
}
