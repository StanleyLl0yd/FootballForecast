'use client';

import {useState,type ChangeEvent} from 'react';
import {inspectM2PreHoldoutLock} from '@/lib/m2-lock-viewer.mjs';

const limit=16*1024;
type Candidate={
  fileSha:string;codeSha:string;sourceSha256:string;modelSha256:string;
  trainRowsSha256:string;clubMappingSha256:string;snapshotIdentitySha256:string;
  homeWins:number;draws:number;awayWins:number;
};

export function ResearchLockViewer(){
  const [candidate,setCandidate]=useState<Candidate|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [working,setWorking]=useState(false);
  const onFile=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    setCandidate(null);setError(null);
    if(!file)return;
    if(file.size===0||file.size>limit){
      setError('Файл должен быть непустым и не превышать 16 КиБ.');
      return;
    }
    setWorking(true);
    try{
      const bytes=await file.arrayBuffer();
      if(bytes.byteLength>limit)throw new Error('Размер файла превышает 16 КиБ.');
      const parsed:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      const result=inspectM2PreHoldoutLock(parsed);
      const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
      const fileSha=Array.from(hash,n=>n.toString(16).padStart(2,'0')).join('');
      setCandidate({
        fileSha,
        codeSha:String(result.codeSha),sourceSha256:String(result.sourceSha256),
        modelSha256:String(result.modelSha256),trainRowsSha256:String(result.trainRowsSha256),
        clubMappingSha256:String(result.clubMappingSha256),
        snapshotIdentitySha256:String(result.snapshotIdentitySha256),
        homeWins:Number(result.homeWins),draws:Number(result.draws),awayWins:Number(result.awayWins)
      });
    }catch(caught){
      setError(caught instanceof SyntaxError?'Недопустимый JSON-файл.':
        caught instanceof Error?caught.message:'Не удалось проверить аттестат.');
    }finally{
      setWorking(false);
    }
  };
  return <section className="panel source-lab">
    <h2>Локальная проверка исследовательского аттестата</h2>
    <p>Просмотр только агрегированного JSON из защищённого задания GitHub Actions.
      Файл обрабатывается исключительно в браузере: без отправки на сервер, записи в базу или запуска обучения.
      Не загружайте CSV с матчами, пароли или приватные записи.</p>
    <div className="source-lab-controls">
      <label htmlFor="m2-lock-file">Аттестат M2 (.json, до 16 КиБ)</label>
      <input id="m2-lock-file" type="file" accept=".json,application/json"
        onChange={onFile} disabled={working} aria-describedby="m2-lock-privacy"/>
    </div>
    <p id="m2-lock-privacy" className="source-lab-note">
      Проверяются только формат, допустимые SHA, фиксированные 240 матчей / 16 клубов,
      тренировочные итоги и отсутствие заявленного доступа к holdout. Самостоятельно
      загруженный JSON <strong>не подтверждает подлинность GitHub-запуска, фиксацию в защищённой ветке,
      независимость источников или точность прогнозов</strong>.
    </p>
    {working?<p role="status" className="source-lab-note">Проверяю локальный файл…</p>:null}
    {error?<p role="alert" className="source-lab-error">{error}</p>:null}
    {candidate?<div className="source-lab-results" aria-live="polite">
      <h3>Кандидат M2 — не подтверждён независимой фиксацией</h3>
      <p>Тренировочных матчей: <strong>240</strong>; клубов: <strong>16</strong>;
        исходов хозяева/ничья/гости: <strong>{candidate.homeWins} / {candidate.draws} / {candidate.awayWins}</strong>.</p>
      <div className="source-lab-table-wrapper"><table className="source-lab-table">
        <caption className="source-lab-note">Локально прочитанные идентификаторы, не подтверждённые сервером</caption>
        <tbody>
          {([
            ['SHA-256 загруженного файла',candidate.fileSha],
            ['Git-коммит вычисления',candidate.codeSha],
            ['SHA-256 исходного CSV',candidate.sourceSha256],
            ['SHA-256 модели',candidate.modelSha256],
            ['SHA-256 обучающей выборки',candidate.trainRowsSha256],
            ['SHA-256 соответствия клубов',candidate.clubMappingSha256],
            ['SHA-256 идентификатора снимка',candidate.snapshotIdentitySha256]
          ] as const).map(([label,value])=><tr key={label}>
            <th scope="row">{label}</th><td><code>{value}</code></td>
          </tr>)}
        </tbody>
      </table></div>
      <p className="source-lab-warning">НЕ ПОДТВЕРЖДЕНО: ручная проверка SHA в защищённом GitHub,
        согласование со снимком базы и отдельная фиксация обязательны до первого чтения
        результатов 2025/26. Оценка модели не проводилась.</p>
    </div>:null}
  </section>;
}
