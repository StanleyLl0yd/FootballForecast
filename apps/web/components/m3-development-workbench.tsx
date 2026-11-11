'use client';

import {useState} from 'react';

type Model='both'|'poisson'|'baseline';
type Metric='logLoss'|'brier'|'rps';
type Fold={season:string;trainN:number;scoredN:number;abstainedN:number;unseenN:number;
  baseline:Record<Metric,number>;poisson:Record<Metric,number>;
  gain:number;approx95HalfWidth:number};
type Summary={state:string;acceptedTechnicalGates:number;totalCorrespondences:number;
  playedCandidates:number;excluded:number;strictAsOf:boolean;productionApproved:boolean;
  seasons:ReadonlyArray<{season:string;linked:number;playedCandidates:number;excluded:number}>;
  folds:ReadonlyArray<Fold>;
  model:{name:string;baseline:string}|null;
  links:{development:string;correlation:string;source:string;protocol:string;
    developmentDigest:string;correlationDigest:string}|null};

const METRIC_NAMES:Record<Metric,string>={
  logLoss:'Log Loss',brier:'Brier (H/D/A)',rps:'RPS'
};

export function M3DevelopmentWorkbench({summary}:{summary:Summary}){
  const [metric,setMetric]=useState<Metric>('logLoss');
  const [model,setModel]=useState<Model>('both');
  if(summary.state!=='verified_retrospective'||!summary.links||!summary.model){
    return <section className="panel informative" role="alert">
      <h2>M3 · результаты недоступны</h2>
      <p className="source-lab-error">Агрегированные свидетельства не прошли проверку.
        Исторические результаты и допуск модели скрыты до исправления.</p>
    </section>;
  }
  const fmt=(x:number)=>x.toFixed(4);
  return <section className="panel informative" aria-label="M3 owner-only development workbench">
    <h2>M3 · Исследование на реальных исторических данных</h2>
    <p className="source-lab-note"><strong>Технически принято A1–A6: 6/8.</strong>{' '}
      Режим NON_STRICT_RETROSPECTIVE: обучение строго по прошлым завершённым
      сезонам, без оригинального предматчевого as-of и без новой оценки holdout.
      A7 и A8 ещё открыты до отдельной приёмки.</p>
    <div className="stat-grid">
      <div className="stat"><span>Независимые соответствия матчей</span>
        <strong>{summary.totalCorrespondences}/1680</strong>
        <small>Семь сезонов, даты и хозяева/гости; публичная сверка.</small></div>
      <div className="stat"><span>Ретроспективные кандидаты сыгранных матчей</span>
        <strong>{summary.playedCandidates}</strong>
        <small>Не окончательные as-of метки, а результаты сверки источников.</small></div>
      <div className="stat"><span>Исключения: технические/пересмотренные</span>
        <strong>{summary.excluded}</strong>
        <small>6 несостоявшихся матчей, 1 официальный пересмотр 1:1 → 0:3.</small></div>
      <div className="stat"><span>Хронологические folds</span>
        <strong>{summary.folds.length}/5</strong>
        <small>Проведены внутри защищённого SELECT-only исследования.</small></div>
    </div>
    <h3>Модель и метрика</h3>
    <div className="source-lab-note">
      <label htmlFor="m3-model-choice">Отображение моделей: </label>{' '}
      <select id="m3-model-choice" value={model}
        onChange={e=>setModel(e.target.value as Model)}>
        <option value="both">Обе модели: сравнение</option>
        <option value="poisson">Team Poisson</option>
        <option value="baseline">H/D/A baseline</option>
      </select>{' '}
      <label htmlFor="m3-metric-choice">Метрика: </label>{' '}
      <select id="m3-metric-choice" value={metric}
        onChange={e=>setMetric(e.target.value as Metric)}>
        <option value="logLoss">Log Loss</option>
        <option value="brier">Brier</option>
        <option value="rps">RPS</option>
      </select>
    </div>
    <p className="source-lab-note">Меньше лучше. Выбор меняет только отображение,
      не запускает обучение, не изменяет гиперпараметры и не открывает приватные строки.</p>
    <div className="source-lab-table-wrapper"><table className="source-lab-table">
      <caption className="source-lab-note">Пять последовательных ретроспективных folds;
        идентичные матчи у обеих моделей, метрика {METRIC_NAMES[metric]}</caption>
      <thead><tr><th scope="col">Сезон проверки</th>
        <th scope="col">Обучение N</th><th scope="col">Оценено / отказ</th>
        <th scope="col">Новые клубы</th>
        {model!=='poisson'&&<th scope="col">Baseline</th>}
        {model!=='baseline'&&<th scope="col">Poisson</th>}
        {model==='both'&&<th scope="col">Разница</th>}</tr></thead>
      <tbody>{summary.folds.map(f=><tr key={f.season}>
        <th scope="row">{f.season}</th><td>{f.trainN}</td>
        <td>{f.scoredN} / {f.abstainedN}</td><td>{f.unseenN}</td>
        {model!=='poisson'&&<td>{fmt(f.baseline[metric])}</td>}
        {model!=='baseline'&&<td>{fmt(f.poisson[metric])}</td>}
        {model==='both'&&<td>{fmt(f.baseline[metric]-f.poisson[metric])}</td>}
      </tr>)}</tbody></table></div>
    <p className="source-lab-warning">Парные 95% интервалы для Log Loss
      основаны на приближении по матчам и не корректируют повторяемость клубов:
      они не подтверждают статистическое превосходство во всех сезонах.
      Аутентичных букмекерских коэффициентов на единый cutoff нет. Публикация
      прогнозов и использование sealed holdout 2025/26 запрещены.</p>
    <h3>Качество исторического набора</h3>
    <div className="source-lab-table-wrapper"><table className="source-lab-table">
      <caption className="source-lab-note">Ретроспективная сверка и карантин,
        не оригинальные timestamp-as-of</caption>
      <thead><tr><th scope="col">Сезон</th><th scope="col">Сопоставлено</th>
        <th scope="col">Кандидаты</th><th scope="col">Исключено</th></tr></thead>
      <tbody>{summary.seasons.map(s=><tr key={s.season}><th scope="row">{s.season}</th>
        <td>{s.linked}/240</td><td>{s.playedCandidates}</td><td>{s.excluded}</td>
      </tr>)}</tbody></table></div>
    <h3>Воспроизводимость · защищённые свидетельства</h3>
    <p><a className="sources-method" href={summary.links.source} target="_blank"
      rel="noopener noreferrer">480 публичных матчей RSSSF ↗</a>{' '}
      <a className="sources-method" href={summary.links.correlation} target="_blank"
        rel="noopener noreferrer">Реальное owner-only сопоставление ↗</a>{' '}
      <a className="sources-method" href={summary.links.development} target="_blank"
        rel="noopener noreferrer">Реальная оценка пяти folds ↗</a>{' '}
      <a className="sources-method" href={summary.links.protocol} target="_blank"
        rel="noopener noreferrer">Критерии M3 #271 ↗</a></p>
    <p className="source-lab-note">SHA-256 корреляции:
      {' '}<code>{summary.links.correlationDigest}</code>.
      SHA-256 оценки: <code>{summary.links.developmentDigest}</code>.
      Ни приватные клубные ID, ни матчи, ни коэффициенты модели не передаются клиенту.</p>
  </section>;
}
