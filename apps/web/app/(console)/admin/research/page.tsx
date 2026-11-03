import {requireOwner} from '@/lib/auth';
import {PageHeading} from '@/components/empty-state';
import {M2CandidateReplay} from '@/components/m2-candidate-replay';
import {ResearchLockViewer} from '@/components/research-lock-viewer';
import {M2AnchorRequestViewer} from '@/components/m2-anchor-request-viewer';
import {readM2TrainOnlyRun,readM2PublicSourcesRun,readM2OpenFootballTrainRun} from '@/lib/m2-run-status';
import {summarizeM2OwnerEvidence} from '@/lib/m2-owner-research.mjs';
import {inspectM2OpenFootballReplay} from '@/lib/m2-openfootball-evidence.mjs';
import {inspectM2PublicSourceObservations} from '@/lib/m2-public-source-evidence.mjs';
import recordedEvidence from '../../../../../../docs/M2_STORED_TRAIN_REPLAY_EVIDENCE.json';
import openFootballEvidence from '../../../../../../docs/M2_OPENFOOTBALL_TRAIN_REPLAY_EVIDENCE.json';
import publicSourceEvidence from '../../../../../../docs/M2_PUBLIC_SOURCE_OBSERVATION_EVIDENCE.json';

export const dynamic='force-dynamic';

export default async function Page(){
  // Authorize before inspecting any further state; redirect is fail-closed.
  await requireOwner();
  const evidence=summarizeM2OwnerEvidence(recordedEvidence);
  const openFootballReplay=inspectM2OpenFootballReplay(openFootballEvidence);
  const sourceObservation=inspectM2PublicSourceObservations(publicSourceEvidence);
  const [latest,publicSources,openFootball]=await Promise.all([
    readM2TrainOnlyRun(),readM2PublicSourcesRun(),readM2OpenFootballTrainRun()
  ]);
  return <>
    <PageHeading eyebrow="OWNER · M2" title="Контроль исследования"
      subtitle="Защищённый, только для чтения: наблюдения, недостающие доказательства и запреты до допуска к holdout."/>
    <div className="stat-grid">
      <div className="stat"><span>Общий этап M2</span><strong>4/8</strong>
        <small>4 критерия не приняты. M3 запрещён.</small></div>
      <div className="stat"><span>Архивные train-only запуски v1</span>
        <strong>{evidence.state==='recorded'?'2/2':'—'}</strong>
        <small>Записанное наблюдение, не утверждённая модель</small></div>
      <div className="stat"><span>Старый протокол Footbolno v1</span><strong>архив</strong>
        <small>Не блокирует новый независимый путь OpenFootball.</small></div>
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
          <tr><th scope="row">Новый источник обучения</th><td>OpenFootball CC0</td>
            <td>Закреплённый Git blob 2024/25: 240 матчей, 16 клубов. Новый протокол календарных дат; training-only не означает одобрение модели.</td></tr>
          <tr><th scope="row">Текущие матчи и holdout</th><td>Источник не утверждён</td>
            <td>Нужны отдельно лицензированный источник результатов 2025/26 и доказуемо актуальный источник 2026/27. Подмена старого holdout запрещена.</td></tr>
          <tr><th scope="row">Неизменяемый pre-holdout lock</th><td>Не создан</td>
            <td>Подписанный процессом защищённый Git-якорь с SHA кода, источника, обучающей выборки и модели</td></tr>
          <tr><th scope="row">Однократная ретроспективная оценка</th><td>Запрещена до lock</td>
            <td>Только защищённый, заранее фиксированный новый study lock и одна согласованная оценка; ни v1, ни новый train-only job не дают разрешения.</td></tr>
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
        <h3>Новый OpenFootball-only train-only</h3>
        {openFootballReplay.state==='recorded'?<p>Два защищённых независимых
          train-only запуска: <strong>2/2 воспроизводимы</strong>. Контроль:
          <strong> {openFootballReplay.receipt.trainingMatches} матчей,
          {' '}{openFootballReplay.receipt.trainingClubs} клубов</strong>;
          {' '}исходы {openFootballReplay.receipt.homeWins}/
          {openFootballReplay.receipt.draws}/{openFootballReplay.receipt.awayWins}.
          <span className="source-lab-note"> Модель:
            <code>{openFootballReplay.receipt.fittedModelSha256}</code>.
            {' '}Источник: <code>{openFootballReplay.receipt.sourceSha256}</code>.
            {' '}Только TRAIN_ONLY_UNAPPROVED, не утверждённая модель.</span>
          {openFootballReplay.runs.map((id:number)=><a className="sources-method" key={id}
            href={`https://github.com/StanleyLl0yd/FootballForecast/actions/runs/${id}`}
            target="_blank" rel="noopener noreferrer">Исходный запуск #{id} ↗ </a>)}
        </p>:<p role="alert">Закреплённые данные OpenFootball train-only не прошли проверку
          SHA: результат не одобрен.</p>}
        {openFootball.state==='run'?<p>Исследовательский запуск:
          {' '}<strong>{openFootball.status}</strong>
          {openFootball.conclusion?` · ${openFootball.conclusion}`:''}.
          {' '}<a href={openFootball.url} target="_blank" rel="noopener noreferrer">
            #{openFootball.id} ↗</a>. Git SHA: <code>{openFootball.sha}</code>.</p>:
          <p>{openFootball.state==='no_runs'?'Новый учебный запуск ещё не производился.':
            'Метаданные новой исследовательской задачи недоступны.'}</p>}
        <p><a className="sources-method"
          href="https://github.com/StanleyLl0yd/FootballForecast/actions/workflows/m2-openfootball-train-only.yml"
          target="_blank" rel="noopener noreferrer">OpenFootball train-only · CC0 ↗</a></p>
        <p className="source-lab-note">Новый протокол «m2-openfootball-calendar-v1» не зависит от Footbolno,
          не получает доступ к БД или 2025/26 и не публикует модель. Успех задания — лишь
          воспроизводимый обучающий кандидат; текущие матчи, holdout и публикация заблокированы.</p>
        <h3>Независимые публичные источники</h3>
        <h3>Закреплённые реальные наблюдения · 03.11.2026</h3>
        {sourceObservation.state==='recorded'?<div>
          <p>Первичный журнал:
            {' '}<a className="sources-method"
              href={`https://github.com/StanleyLl0yd/FootballForecast/actions/runs/${sourceObservation.runId}`}
              target="_blank" rel="noopener noreferrer">запуск #{sourceObservation.runId} ↗</a>.
            Результаты источников не означают допуск к обучению или публикации.</p>
          <div className="source-lab-table-wrapper"><table className="source-lab-table">
            <caption className="source-lab-note">Только агрегаты одного защищённого наблюдения, не данные матчей и не утверждённые источники</caption>
            <thead><tr><th scope="col">Источник</th><th scope="col">Наблюдение</th>
              <th scope="col">Ограничение</th></tr></thead>
            <tbody>
              <tr><th scope="row">OpenFootball · 2024/25</th>
                <td>{sourceObservation.openFootball.matches} матчей, {sourceObservation.openFootball.clubs} клубов</td>
                <td>Закреплённый исторический набор; время начала матчей не проверено.</td></tr>
              <tr><th scope="row">OpenFoot · 2026/27</th>
                <td>{sourceObservation.openFoot.matches} матчей, {sourceObservation.openFoot.clubs} клубов</td>
                <td>Демонстрационный ответ PARTIAL_UNAPPROVED. Полное покрытие не подтверждено.</td></tr>
              <tr><th scope="row">SportScore · 03.11.2026</th>
                <td>{sourceObservation.sportScore.matches} подтверждённых наблюдений</td>
                <td>Один UTC-день, не доказательство отсутствия матчей или полного календаря.</td></tr>
            </tbody>
          </table></div>
          <p className="source-lab-note">Контроль ответов:
            OpenFoot <code>{sourceObservation.openFoot.responseSha256}</code>;
            SportScore <code>{sourceObservation.sportScore.responseSha256}</code>.
            Исходные строки и приватные данные не сохраняются на этой странице.</p>
        </div>:<p role="alert" className="source-lab-error">
          Историческое наблюдение источников не прошло закрытую проверку;
          не используйте его для приёмки.</p>}

        {publicSources.state==='run'?<p>Последний диагностический запуск:
          {' '}<strong>{publicSources.status}</strong>
          {publicSources.conclusion?` · ${publicSources.conclusion}`:''}.
          {' '}<a href={publicSources.url} target="_blank" rel="noopener noreferrer">
            #{publicSources.id} ↗</a>. Git SHA: <code>{publicSources.sha}</code>.</p>:
          <p>{publicSources.state==='no_runs'?'Диагностических запусков нет.':
            'Метаданные диагностического workflow недоступны.'}</p>}
        <p><a className="sources-method"
          href="https://github.com/StanleyLl0yd/FootballForecast/actions/workflows/m2-public-sources-observe.yml"
          target="_blank" rel="noopener noreferrer">Проверить OpenFootball / SportScore / OpenFoot demo ↗</a></p>
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
