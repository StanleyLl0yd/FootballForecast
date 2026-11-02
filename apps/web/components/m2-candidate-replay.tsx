'use client';

import {useState,type ChangeEvent} from 'react';
import {compareM2StoredCandidates} from '@/lib/m2-candidate-replay.mjs';

const maxFileBytes=16*1024;
const fingerprintLabels:Record<string,string>={
  codeSha:'Коммит исследовательского кода',
  sourceSha256:'Закреплённый SHA исходного CSV',
  snapshotIdentitySha256:'Идентичность приватного снимка',
  trainRowsSha256:'Тренировочные строки',
  clubMappingSha256:'Соответствие клубов',
  fittedModelSha256:'Временная модель'
};
type Comparison={
  equal:boolean;
  mismatches:string[];
  common:Record<string,string>|null;
};

export function M2CandidateReplay(){
  const [comparison,setComparison]=useState<Comparison|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const onFiles=async(event:ChangeEvent<HTMLInputElement>)=>{
    const files=Array.from(event.currentTarget.files??[]);
    event.currentTarget.value='';
    setComparison(null);
    setError(null);
    if(files.length===0)return;
    if(files.length!==2||files.some(file=>file.size===0||file.size>maxFileBytes)){
      setError('Выберите ровно два непустых JSON-отчёта, каждый не более 16 КиБ.');
      return;
    }
    setBusy(true);
    try{
      const parsed=await Promise.all(files.map(async file=>{
        const bytes=await file.arrayBuffer();
        if(bytes.byteLength>maxFileBytes)throw Error('Превышен предел 16 КиБ.');
        return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown;
      }));
      setComparison(compareM2StoredCandidates(parsed[0],parsed[1]));
    }catch(caught){
      setError(caught instanceof SyntaxError?'Некорректный JSON.':
        caught instanceof Error?caught.message:'Не удалось проверить отчёты.');
    }finally{
      setBusy(false);
    }
  };

  return <section className="panel source-lab">
    <h2>Сверка двух временных train-only запусков</h2>
    <p>Выберите два оригинальных агрегатных JSON-отчёта <code>M2_STORED_TRAIN_CANDIDATE</code>.
      Сравниваются шесть идентификаторов, включая SHA-256 временной модели. Проверка
      выполняется только в браузере, без отправки файлов, запросов к базе или чтения
      результатов контрольного сезона. Не выбирайте CSV матчей либо секреты.</p>
    <div className="source-lab-controls">
      <label htmlFor="m2-candidate-files">Два отчёта (.json, каждый до 16 КиБ)</label>
      <input id="m2-candidate-files" type="file" multiple
        accept=".json,application/json" onChange={onFiles} disabled={busy}
        aria-describedby="m2-candidate-explanation"/>
    </div>
    <p id="m2-candidate-explanation" className="source-lab-note">
      JSON проверяется по закрытой схеме: ровно 240 тренировочных матчей, 16 клубов,
      отсутствие проверки внешнего источника, одобрения lock, чтения holdout и оценки точности.
      Отчёты могут быть подделаны: равенство локально загруженных SHA
      <strong> не подтверждает подлинность GitHub Actions или утверждение модели</strong>.
    </p>
    {busy?<p className="source-lab-note" role="status">Сверяю локальные отчёты…</p>:null}
    {error?<p className="source-lab-error" role="alert">{error}</p>:null}
    {comparison?<div className="source-lab-results" aria-live="polite">
      <h3>{comparison.equal?'Шесть идентификаторов совпали':'Идентификаторы не совпали'}</h3>
      {comparison.equal&&comparison.common?
        <div className="source-lab-table-wrapper"><table className="source-lab-table">
          <caption className="source-lab-note">Локальное равенство двух непроверенных отчётов</caption>
          <tbody>{Object.entries(fingerprintLabels).map(([key,label])=>
            <tr key={key}><th scope="row">{label}</th>
              <td><code>{comparison.common?.[key]}</code></td></tr>)}</tbody>
        </table></div>:
        <p role="alert">Несовпадающие поля: {comparison.mismatches.map(
          key=>fingerprintLabels[key]??key).join(', ')}. Не объединяйте эти результаты.</p>}
      <p className="source-lab-warning">Статус: только временное исследовательское обучение.
        Внешний источник не перепроверен, модель не сохранена и не утверждена.
        Запрещено открывать 2025/26 holdout по результатам этой локальной сверки.</p>
    </div>:null}
  </section>;
}
