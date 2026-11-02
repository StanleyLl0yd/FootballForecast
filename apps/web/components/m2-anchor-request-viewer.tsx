'use client';

import {useState,type ChangeEvent} from 'react';
import {inspectM2PendingAnchorRequest} from '@/lib/m2-anchor-request-viewer.mjs';

const maxBytes=16*1024;
type Pending={
  state:string;codeSha:string;sourceSha256:string;fittedModelSha256:string;
  trainingAttestationCanonicalSha256:string;sourceComparisonCanonicalSha256:string;
  runnerImageSha256:string;dependencyManifestSha256:string;
  privateModelArtifactSha256:string;workflowRunId:number;workflowJobId:number;
};

export function M2AnchorRequestViewer(){
  const [pending,setPending]=useState<Pending|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const onFile=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    setPending(null);setError(null);
    if(!file)return;
    if(!file.size||file.size>maxBytes){
      setError('Выберите непустой JSON до 16 КиБ.');return;
    }
    setBusy(true);
    try{
      const bytes=await file.arrayBuffer();
      if(!bytes.byteLength||bytes.byteLength>maxBytes)throw Error('Превышен предел 16 КиБ.');
      const parsed:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      setPending(inspectM2PendingAnchorRequest(parsed) as Pending);
    }catch(caught){
      setError(caught instanceof SyntaxError?'Некорректный JSON-файл.':
        caught instanceof Error?caught.message:'Не удалось проверить JSON.');
    }finally{setBusy(false);}
  };
  return <section className="panel source-lab">
    <h2>Локальная проверка запроса на фиксацию исследования</h2>
    <p>Проверка будущего агрегированного <code>M2_STUDY_ANCHOR_REQUEST</code>.
      Выберите только JSON с SHA и метаданными, без CSV, коэффициентов модели или секретов.
      Файл обрабатывается в памяти браузера и никуда не передаётся.</p>
    <div className="source-lab-controls">
      <label htmlFor="m2-anchor-request-file">Запрос фиксации (.json, до 16 КиБ)</label>
      <input id="m2-anchor-request-file" type="file" accept=".json,application/json"
        onChange={onFile} disabled={busy} aria-describedby="m2-anchor-request-warning"/>
    </div>
    <p id="m2-anchor-request-warning" className="source-lab-note">
      Проверяются ровно 24 поля закрытой схемы, совпадение Git SHA задания и кода,
      ограничения протокола и статус <strong>PENDING_INDEPENDENT_REVIEW</strong>.
      Происхождение задания, независимость сверки CSV, приватное хранение модели и
      защищённая история Git здесь <strong>не подтверждаются</strong>.
    </p>
    {busy?<p role="status">Проверяю локальные метаданные…</p>:null}
    {error?<p role="alert" className="source-lab-error">{error}</p>:null}
    {pending?<div className="source-lab-results" aria-live="polite">
      <h3>Только запрос — независимая проверка не выполнена</h3>
      <p>GitHub workflow: <strong>#{pending.workflowRunId}</strong>;
        job: <strong>#{pending.workflowJobId}</strong>.</p>
      <div className="source-lab-table-wrapper"><table className="source-lab-table">
        <caption className="source-lab-note">Непроверенные снаружи хэши из локального JSON</caption>
        <tbody>{([
          ['Код задания',pending.codeSha],
          ['Исходный CSV',pending.sourceSha256],
          ['Модель',pending.fittedModelSha256],
          ['Аттестат обучения',pending.trainingAttestationCanonicalSha256],
          ['Сверка 240/240',pending.sourceComparisonCanonicalSha256],
          ['Runner image',pending.runnerImageSha256],
          ['Зависимости',pending.dependencyManifestSha256],
          ['Приватный артефакт модели',pending.privateModelArtifactSha256]
        ] as const).map(([label,value])=><tr key={label}>
          <th scope="row">{label}</th><td><code>{value}</code></td>
        </tr>)}</tbody>
      </table></div>
      <p className="source-lab-warning" role="status">
        Статус: PENDING_INDEPENDENT_REVIEW. Этот экран никогда не одобряет модель,
        не сохраняет коэффициенты, не создаёт immutable lock и не открывает holdout.
      </p>
    </div>:null}
  </section>;
}
