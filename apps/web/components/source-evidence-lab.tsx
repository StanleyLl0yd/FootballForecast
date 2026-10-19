'use client';

import {useState,type ChangeEvent} from 'react';
import registry from '../../../docs/M0_FREE_SOURCE_REGISTRY.json';
import {evaluateSourceEvidenceCore,type QualityReport} from '../../../scripts/m0-multi-source-core.mjs';

const maxBytes=4*1024*1024;
const names=new Map(registry.sources.map(source=>[source.id,source.title]));
const percent=(value:number|null)=>value===null?'нет данных':(value*100).toFixed(1)+'%';
const sha256=async(bytes:ArrayBuffer)=>{
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
};

// This download contains ONLY invented clubs and an example.org placeholder URL.
const syntheticExample={
  schemaVersion:1,
  cases:[{
    key:'SYNTHETIC-NOT-A-REAL-MATCH-001',
    officialEvidenceUrl:'https://example.org/fictional/001',
    official:{
      homeId:'Fictional-Home',awayId:'Fictional-Away',
      kickoffAt:'2025-01-01T12:00:00Z',
      status:'played',homeGoals:2,awayGoals:1
    },
    observations:[{
      sourceId:'footbolno',publisherGroup:null,publishedAt:null,
      observedAt:'2026-10-19T12:00:00Z',
      homeId:'Fictional-Home',awayId:'Fictional-Away',
      kickoffAt:'2025-01-01T12:00:00Z',
      status:'played',homeGoals:2,awayGoals:1
    }]
  }]
};
function anonymizedSummary(report:QualityReport,hash:string|null){
  return {
    ...report,
    sources:report.sources.map(source=>{
      // User-entered publisherGroup values can contain private text:
      // retain only aggregate group counts, never names/labels from evidence.
      const {declaredGroups,...upstream}=source.upstream;
      return {...source,upstream:{...upstream,declaredGroupCount:declaredGroups.length}};
    }),
    originalFileSHA256:hash,
    warning:'RESEARCH ONLY: source rights, references, independence and as-of history are NOT authenticated'
  };
}
function downloadLocalJson(filename:string,payload:unknown){
  const data=JSON.stringify(payload,null,2)+'\n';
  const url=URL.createObjectURL(new Blob([data],{type:'application/json;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;
  link.download=filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Defer revocation so Safari/Firefox can finish the user-initiated download.
  window.setTimeout(()=>URL.revokeObjectURL(url),4000);
}

export function SourceEvidenceLab(){
  const [result,setResult]=useState<QualityReport|null>(null);
  const [fileHash,setFileHash]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [working,setWorking]=useState(false);
  const onFile=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    setResult(null);setFileHash(null);setError(null);
    if(!file)return;
    if(file.size===0||file.size>maxBytes){
      setError('Нужен непустой JSON-файл размером не более 4 МиБ.');
      return;
    }
    setWorking(true);
    try{
      const bytes=await file.arrayBuffer();
      if(bytes.byteLength>maxBytes)throw new Error('Файл превышает лимит 4 МиБ.');
      const content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
      const candidate:unknown=JSON.parse(content);
      // This pure evaluator has no HTTP, storage, analytics or Next.js server action.
      const evaluated=evaluateSourceEvidenceCore(candidate,registry);
      const checksum=await sha256(bytes);
      setResult(evaluated);setFileHash(checksum);
    }catch(caught){
      setError(caught instanceof Error?caught.message:'Не удалось проверить локальный файл.');
    }finally{
      setWorking(false);
    }
  };
  return <section className="panel source-lab">
    <h2>Локальная проверка точности источников</h2>
    <p>Загрузите подготовленный JSON со ссылками на официальные протоколы и наблюдениями из разрешённых источников. Файл обрабатывается <strong>только в вашем браузере</strong>: приложение не отправляет его на сервер, не сохраняет в Supabase и не подключается к поставщикам.</p>
    <div className="source-lab-controls">
      <label htmlFor="source-evidence-input">Файл свидетельств (.json, не более 4 МиБ)</label>
      <input id="source-evidence-input" type="file" accept=".json,application/json"
        onChange={onFile} disabled={working} aria-describedby="source-evidence-privacy"/>
    </div>
    <p id="source-evidence-privacy" className="source-lab-note">
      Нужен формат из <a href="https://github.com/StanleyLl0yd/FootballForecast/blob/main/docs/M0_SOURCE_ACCURACY_PROTOCOL.md"
        target="_blank" rel="noopener noreferrer">документации</a>. Проверяются структура, ошибки и интервалы неопределённости, но не подлинность ссылок, лицензии или независимость публикаций.
    </p>
    <button type="button" className="source-lab-download" onClick={()=>downloadLocalJson(
      'footballforecast-synthetic-example.json',syntheticExample)}>
      Скачать пример формата (вымышленный матч)
    </button>
    {working?<p role="status" className="source-lab-note">Проверка файла в браузере…</p>:null}
    {error?<p role="alert" className="source-lab-error">Не удалось проверить данные: {error}</p>:null}
    {result?<div className="source-lab-results" aria-live="polite">
      <h3>Исследовательский отчёт (не подтверждён официально)</h3>
      <p>Сопоставлено эталонных матчей: <strong>{result.observationCount}</strong>.
        Представлено источников: <strong>{result.sources.length}</strong>.
        Расчёт не включает новые сетевые запросы.</p>
      <p className="source-lab-note">SHA-256 загруженного файла: <code>{fileHash}</code></p>
      <button type="button" className="source-lab-download" onClick={()=>downloadLocalJson(
        'footballforecast-research-report.json',anonymizedSummary(result,fileHash))}>
        Сохранить обезличенный JSON-отчёт
      </button>
      {result.fieldRankings.fixtureIntegrity.length===0?<p className="source-lab-warning">
        Для предварительного ранжирования требуется не менее {result.minimumScoredMatches} завершённых эталонных матчей. Ошибки ниже носят только описательный характер.
      </p>:<p className="source-lab-warning">
        Порядок по общей правильности матчей предварительный: интервалы могут пересекаться,
        а права, достоверность протоколов и независимость источников не подтверждены.
      </p>}
      {result.sources.length?<div className="source-lab-table-wrapper">
        <table className="source-lab-table">
          <thead><tr><th scope="col">Источник</th><th scope="col">Матчи</th>
            <th scope="col">Пропуски</th><th scope="col">Ошибки полного матча</th>
            <th scope="col">Счёт при сопоставлении</th></tr></thead>
          <tbody>{result.sources.map(source=><tr key={source.sourceId}>
            <th scope="row">{names.get(source.sourceId)??source.sourceId}</th>
            <td>{source.observed}/{source.referenceCases}</td>
            <td>{source.missing}</td>
            <td>{source.fixtureIntegrity.errors}/{source.fixtureIntegrity.compared}
              {source.fixtureIntegrity.compared>=result.minimumScoredMatches?
                <small>{percent(source.fixtureIntegrity.errorRate)}</small>:null}
            </td>
            <td>{source.finalScore.errors}/{source.finalScore.compared}</td>
          </tr>)}</tbody>
        </table>
      </div>:<p className="source-lab-note">В файле нет наблюдений поставщиков. Рейтинг не сформирован.</p>}
      {result.fieldRankings.fixtureIntegrity.length?<p className="source-lab-note">
        Предварительный порядок по общей правильности:
        {' '}{result.fieldRankings.fixtureIntegrity.map((item,i)=>
          `${i+1}. ${names.get(item.sourceId)??item.sourceId} (${percent(item.errorRate)}, n=${item.compared})`).join('; ')}.
      </p>:null}
      <p className="source-lab-warning">Это не прогноз и не разрешение на использование данных.
        Реестр и рабочая база не изменены.</p>
    </div>:null}
  </section>;
}
