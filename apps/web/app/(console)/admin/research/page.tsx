import {requireOwner} from '@/lib/auth';
import {PageHeading} from '@/components/empty-state';
import {M2CandidateReplay} from '@/components/m2-candidate-replay';
import {ResearchLockViewer} from '@/components/research-lock-viewer';
import {M2AnchorRequestViewer} from '@/components/m2-anchor-request-viewer';
import {readM2TrainOnlyRun,readM2PublicSourcesRun} from '@/lib/m2-run-status';
import {summarizeM2OwnerEvidence} from '@/lib/m2-owner-research.mjs';
import recordedEvidence from '../../../../../../docs/M2_STORED_TRAIN_REPLAY_EVIDENCE.json';

export const dynamic='force-dynamic';

export default async function Page(){
  // Authorize before inspecting any further state; redirect is fail-closed.
  await requireOwner();
  const evidence=summarizeM2OwnerEvidence(recordedEvidence);
  const [latest,publicSources]=await Promise.all([
    readM2TrainOnlyRun(),readM2PublicSourcesRun()
  ]);
  return <>
    <PageHeading eyebrow="OWNER · M2" title="Контроль исследования"
      subtitle="Защищённый, только для чтения: наблюдения, недостающие доказательства и запреты до допуска к holdout."/>
    <div className="stat-grid">
      <div className="stat"><span>Общий этап M2</span><strong>4/8</strong>
        <small>4 критерия не приняты. M3 запрещён.</small></div>
      <div className="stat"><span>Временные train-only запуски</span>
        <strong>{evidence.state==='recorded'?'2/2':'—'}</strong>
        <small>Записанное наблюдение, не утверждённая модель</small></div>
      <div className="stat"><span>Сверка точного CSV</span><strong>0/1</strong>
        <small>Источник недоступен; 240/240 повторно не сверены</small></div>
      <div className="stat"><span>Оценка holdout</span><strong>0</strong>
        <small>Контрольный сезон 2025/26 закрыт</small></div>
    </div>
    <section className="panel informative">
      <h2>Условия допуска — все обязательны</h2>
      <div className="source-lab-table-wrapper"><table className="source-lab-table">
        <caption className="source-lab-note">Статусы относятся к текущему сохранённому наблюдению; ни один не предоставляет разрешений</caption>
        <thead><tr><th scope="col">Этап</th><th scope="col">Состояние</th><th scope="col">Следующее доказательство</th></tr></thead>
        <tbody>
          <tr><th scope="row">Воспроизводимость train-only</th>
            <td>{evidence.state==='recorded'?'Два запуска записаны':'Не удалось проверить evidence'}</td>
            <td>Сопоставление исходных job logs и SHA; без статуса утверждённой модели</td></tr>
          <tr><th scope="row">Независимая сверка источника</th><td>Блокировано</td>
            <td>Точный Footbolno CSV SHA и независимые 240/240 матчей</td></tr>
          <tr><th scope="row">Неизменяемый pre-holdout lock</th><td>Не создан</td>
            <td>Подписанный процессом защищённый Git-якорь с SHA кода, источника, обучающей выборки и модели</td></tr>
          <tr><th scope="row">Однократная ретроспективная оценка</th><td>Запрещена до lock</td>
            <td>Только заранее зафиксированный Poisson v1; без настройки параметров и подбора на holdout</td></tr>
        </tbody>
      </table></div>
      <p className="source-lab-warning">Нельзя трактовать успешный GitHub Actions как approval модели. Историческая as-of доступность не подтверждена;
        будущая оценка, если разрешена, будет только non-strict retrospective.</p>
    </section>
    <div className="panel-grid secondary-panels">
      <section className="panel informative">
        <h2>Закреплённые идентификаторы</h2>
        {evidence.receipt?<div>
          <p>Источник CSV: <code>{evidence.receipt.sourceSha256}</code></p>
          <p>Временная модель: <code>{evidence.receipt.fittedModelSha256}</code></p>
          <p>Обучающие строки: <code>{evidence.receipt.trainRowsSha256}</code></p>
          <p>Git SHA задания: <code>{evidence.receipt.codeSha}</code></p>
          <p>SHA-256 JSON: <code>{evidence.receipt.receiptSha256}</code></p>
          <p>Исходные задания: {evidence.runs.map(id=><span key={id}>
            <a className="sources-method" href={`https://github.com/StanleyLl0yd/FootballForecast/actions/runs/${id}`}
              target="_blank" rel="noopener noreferrer">#{id} ↗</a>{' '}</span>)}</p>
        </div>:<p role="alert" className="source-lab-error">
          Evidence не прошло закрытую проверку. Не используйте его для допуска.</p>}
      </section>
      <section className="panel informative">
        <h2>Последний ручной GitHub workflow</h2>
        {latest.state==='run'?<p>Статус: <strong>{latest.status}</strong>
          {latest.conclusion?` · ${latest.conclusion}`:''}.
          {' '}<a href={latest.url} target="_blank" rel="noopener noreferrer">
            Запуск #{latest.id} ↗</a>. Git SHA: <code>{latest.sha}</code>.
          Это только публичные метаданные запуска, а не attest/approval.</p>:
          <p>{latest.state==='no_runs'?'Публичных запусков нет.':
            'Публичный GitHub API недоступен либо не подтвердил последний запуск.'}</p>}
        <p><a className="sources-method"
          href="https://github.com/StanleyLl0yd/FootballForecast/actions/workflows/m2-manual-research-lock.yml"
          target="_blank" rel="noopener noreferrer">Проверить защищённый workflow ↗</a></p>
        <p><a className="sources-method"
          href="https://github.com/StanleyLl0yd/FootballForecast/issues/182"
          target="_blank" rel="noopener noreferrer">Условия приёмки #182 ↗</a></p>
        <h3>Независимые публичные источники</h3>
        {publicSources.state==='run'?<p>Последний диагностический запуск:
          {' '}<strong>{publicSources.status}</strong>
          {publicSources.conclusion?` · ${publicSources.conclusion}`:''}.
          {' '}<a href={publicSources.url} target="_blank" rel="noopener noreferrer">
            #{publicSources.id} ↗</a>. Git SHA: <code>{publicSources.sha}</code>.</p>:
          <p>{publicSources.state==='no_runs'?'Диагностических запусков нет.':
            'Метаданные диагностического workflow недоступны.'}</p>}
        <p><a className="sources-method"
          href="https://github.com/StanleyLl0yd/FootballForecast/actions/workflows/m2-public-sources-observe.yml"
          target="_blank" rel="noopener noreferrer">Проверить OpenFootball / SportScore ↗</a></p>
        <p className="source-lab-note">Успех workflow подтверждает выполнение заданий, но не доступность,
          полноту или достоверность данных обоих источников. Реальные ответы проверяются отдельно в summary.
          Ни одна диагностика не утверждает model lock и не открывает holdout.</p>
        <p className="source-lab-note">Здесь нет управляющих кнопок, API записи, экспорта приватных строк
          или операций с Supabase.</p>
      </section>
    </div>
    <M2CandidateReplay/>
    <ResearchLockViewer/>
    <M2AnchorRequestViewer/>
  </>;
}
