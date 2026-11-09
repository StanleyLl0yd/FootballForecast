import {requireOwner} from '@/lib/auth';
import {PageHeading} from '@/components/empty-state';
import {M2CandidateReplay} from '@/components/m2-candidate-replay';
import {ResearchLockViewer} from '@/components/research-lock-viewer';
import {M2AnchorRequestViewer} from '@/components/m2-anchor-request-viewer';
import {readM2TrainOnlyRun,readM2PublicSourcesRun,readM2OpenFootballTrainRun} from '@/lib/m2-run-status';
import {summarizeM2OwnerEvidence} from '@/lib/m2-owner-research.mjs';
import {inspectM2OpenFootballReplay} from '@/lib/m2-openfootball-evidence.mjs';
import {inspectM2ProtectedPrivateEscrow} from '@/lib/m2-private-escrow-evidence.mjs';
import {inspectM2PublicSourceObservations} from '@/lib/m2-public-source-evidence.mjs';
import {inspectM2FirstPrivateEvaluation} from '@/lib/m2-first-eval-evidence.mjs';
import recordedEvidence from '../../../../../../docs/M2_STORED_TRAIN_REPLAY_EVIDENCE.json';
import openFootballEvidence from '../../../../../../docs/M2_OPENFOOTBALL_TRAIN_REPLAY_EVIDENCE.json';
import privateEscrowEvidence from '../../../../../../docs/M2_OPENFOOTBALL_PRIVATE_ESCROW_EVIDENCE.json';
import publicSourceEvidence from '../../../../../../docs/M2_PUBLIC_SOURCE_OBSERVATION_EVIDENCE.json';
import firstScoreEvidence from '../../../../../../docs/M2_FIRST_PRIVATE_EVALUATION_EVIDENCE.json';

export const dynamic='force-dynamic';

export default async function Page(){
  // Authorize before inspecting any further state; redirect is fail-closed.
  await requireOwner();
  const evidence=summarizeM2OwnerEvidence(recordedEvidence);
  const openFootballReplay=inspectM2OpenFootballReplay(openFootballEvidence);
  const privateEscrow=inspectM2ProtectedPrivateEscrow(privateEscrowEvidence,openFootballEvidence);
  const sourceObservation=inspectM2PublicSourceObservations(publicSourceEvidence);
  const firstEvaluation=inspectM2FirstPrivateEvaluation(firstScoreEvidence);
  const [latest,publicSources,openFootball]=await Promise.all([
    readM2TrainOnlyRun(),readM2PublicSourcesRun(),readM2OpenFootballTrainRun()
  ]);
  return <>
    <PageHeading eyebrow="OWNER · M2" title="Контроль исследования"
      subtitle="Защищённый, только для чтения: первое измерение 2025/26, происхождение данных и ограничения перед завершением M2."/>
    <div className="stat-grid">
      <div className="stat"><span>Общий этап M2</span><strong>7/8</strong>
        <small>Осталась полная двухпроходная приёмка репозитория. M3 запрещён.</small></div>
      <div className="stat"><span>Вход владельца · GitHub OAuth</span><strong>Принят</strong>
        <small>Реальный вход и анонимный отказ подтверждены 05.11.2026; вход под чужим GitHub не проверялся в браузере.</small></div>
      <div className="stat"><span>Архивные train-only запуски v1</span>
        <strong>{evidence.state==='recorded'?'2/2':'—'}</strong>
        <small>Записанное наблюдение, не утверждённая модель</small></div>
      <div className="stat"><span>Коэффициенты OpenFootball · закрытый escrow</span>
        <strong>{privateEscrow.state==='recorded'?'1/1':'—'}</strong>
        <small>Реальное хранение TRAIN_ONLY_UNAPPROVED, не model lock.</small></div>
      <div className="stat"><span>Старый протокол Footbolno v1</span><strong>архив</strong>
        <small>Не блокирует новый независимый путь OpenFootball.</small></div>
      <div className="stat"><span>Оценка 2025/26</span>
        <strong>{firstEvaluation.state==='recorded'?'1/1':'—'}</strong>
        <small>{firstEvaluation.state==='recorded'?'182/240 матчей, 58 отказов; метрики приватные':
          'Подтверждение первого теста не прошло проверку SHA'}</small></div>
    </div>
    <section className="panel informative">
      <h2>Контроль M2 · принятое и оставшиеся ограничения</h2>
      <div className="source-lab-table-wrapper"><table className="source-lab-table">
        <caption className="source-lab-note">Статусы относятся к текущему сохранённому наблюдению; ни один не предоставляет разрешений</caption>
        <thead><tr><th scope="col">Этап</th><th scope="col">Состояние</th><th scope="col">Следующее доказательство</th></tr></thead>
        <tbody>
          <tr><th scope="row">Веб-интерфейс владельца</th><td>Принят 05.11.2026</td>
            <td>Вход владельца и перенаправление без сессии проверены в браузере; чужой GitHub-аккаунт проверен только модульными тестами.</td></tr>
          <tr><th scope="row">Воспроизводимость train-only</th>
            <td>{evidence.state==='recorded'?'Два запуска записаны':'Не удалось проверить evidence'}</td>
            <td>Сопоставление исходных job logs и SHA; без статуса утверждённой модели</td></tr>
          <tr><th scope="row">Новый источник обучения</th><td>OpenFootball CC0</td>
            <td>Закреплённый Git blob 2024/25: 240 матчей, 16 клубов. Новый протокол календарных дат; training-only не означает одобрение модели.</td></tr>
          <tr><th scope="row">Первое измерение 2025/26</th>
            <td>{firstEvaluation.state==='recorded'?'Приватно сохранено 09.11.2026':'Подтверждение недостоверно'}</td>
            <td>Football-Data Russia: 240 завершённых матчей, 182 оценки и 58 отказов. DAY_ONLY, не аутентифицированный pre-match/as-of.</td></tr>
          <tr><th scope="row">Неизменяемая заявка до открытия результатов</th>
            <td>{firstEvaluation.state==='recorded'?'1/1 · использована':'Нет проверенного подтверждения'}</td>
            <td>В приватном PostgreSQL зафиксированы SHA кода, модели, метода и источника; повторный запуск этого study ID запрещён.</td></tr>
          <tr><th scope="row">Аудиты репозитория и приёмка владельцем</th><td>Ожидают завершения</td>
            <td>Два полных независимых прохода, CI/Security/CodeQL/browser, сверка Vercel и Supabase; M3 отдельно не разрешён.</td></tr>
        </tbody>
      </table></div>
      <p className="source-lab-warning">Первый защищённый тест завершён, но модель не утверждена для production.
        Дата без подтверждённого UTC-часа не доказывает историческую as-of доступность. Не заявляем
        превосходство над букмекерами и не переоцениваем тот же контрольный сезон.</p>
    </section>
    <section className="panel informative">
      <h2>Закрытое хранение настоящей модели · 2024/25</h2>
      {privateEscrow.state==='recorded'?<div>
        <p>Подтверждена <strong>одна сохранённая модель Poisson</strong> на OpenFootball CC0:
          {' '}{privateEscrow.trainingMatches} матчей, {privateEscrow.trainingClubs} клубов.
          Канонические коэффициенты размером {privateEscrow.modelBytes} байт
          находятся только в закрытой append-only таблице Supabase Frankfurt с RLS.</p>
        <p>SHA-256 приватного артефакта: <code>{privateEscrow.artifactSha256}</code>.
          {' '}Отпечаток fitted-модели: <code>{privateEscrow.fittedModelSha256}</code>.</p>
        <p>Подтверждающий защищённый запуск:
          {' '}<a className="sources-method"
            href={`https://github.com/StanleyLl0yd/FootballForecast/actions/runs/${privateEscrow.runId}`}
            target="_blank" rel="noopener noreferrer">#{privateEscrow.runId} ↗</a>;
          {' '}Git SHA: <code>{privateEscrow.codeSha}</code>.</p>
        <p className="source-lab-warning">Обученная модель по-прежнему имеет статус
          TRAIN_ONLY_UNAPPROVED для production. Независимый приватный тест 2025/26
          выполнен один раз без повторного обучения; публичные прогнозы запрещены.</p>
      </div>:<p role="alert" className="source-lab-error">
        Закреплённое evidence закрытого escrow не прошло проверку.
        Нельзя утверждать наличие верифицированной модели.</p>}
    </section>
    <section className="panel informative">
      <h2>Первое фиксированное измерение · РПЛ 2025/26</h2>
      {firstEvaluation.state==='recorded'?<div>
        <p><strong>182/240</strong> матчей оценены ранее обученной моделью Poisson;
          <strong> 58</strong> матчей с «Балтикой» или «Сочи» исключены по
          заранее заданному правилу. Численные Log Loss, Brier, RPS и точность 1X2
          находятся только в закрытой таблице Supabase, без исходных матчей и коэффициентов на сайте.</p>
        <p>Однократная заявка и результат:
          <strong> 1/1</strong>. Исследование: <code>{firstEvaluation.studyId}</code>.
          Защищённый GitHub Actions:
          {' '}<a className="sources-method"
            href={`https://github.com/StanleyLl0yd/FootballForecast/actions/runs/${firstEvaluation.runId}`}
            target="_blank" rel="noopener noreferrer">запуск #42590191735 ↗</a>.</p>
        <p>SHA-256 исходного ответа: <code>{firstEvaluation.sourceSha256}</code>.
          {' '}Выбранные строки: <code>{firstEvaluation.cohortSha256}</code>.
          {' '}Контрольное подтверждение: <code>{firstEvaluation.receiptSha256}</code>.</p>
        <p className="source-lab-warning">Исходный CSV не сохранён целиком в неизменяемом архиве:
          полное побайтовое повторение расчёта сейчас не гарантировано. Это
          <strong> DAY_ONLY / NON_STRICT_RETROSPECTIVE</strong>, не прогноз с подтверждённым временем начала.
          Нельзя подбирать параметры или повторно использовать 2025/26 для выбора модели.
          M3 и публикация прогнозов остаются запрещены.</p>
      </div>:<p role="alert" className="source-lab-error">
        Публичное подтверждение первого исследования не прошло проверку.
        Сверьте приватную таблицу и исходный защищённый GitHub workflow;
        не показывайте неподтверждённые результаты.</p>}
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
        <p className="source-lab-note">Новый протокол «m2-openfootball-calendar-v1» не зависит от Footbolno:
          исходный train-only запуск без БД проверяет воспроизводимость, а отдельный owner-only
          escrow сохраняет реальные коэффициенты в защищённой таблице.
          Ни один из них не читает 2025/26 и не публикует модель или прогнозы.</p>
        <h3>Независимые публичные источники</h3>
        <p>Позднее независимое структурное наблюдение OpenFoot Starter:
          <strong> 240/240 матчей, 16 клубов</strong> (104 завершены, 136 запланированы),
          240 полей UTC. {' '}<a className="sources-method"
            href="https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41632612945"
            target="_blank" rel="noopener noreferrer">Защищённый запуск #41632612945 ↗</a>.
          Каталог поставщика <a className="sources-method"
            href="https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41635173009"
            target="_blank" rel="noopener noreferrer">#41635173009 ↗</a> назвал
          первоисточником FotMob с заявленной лицензией «Unlicensed-Beta».
          <strong> Автоматический производственный импорт не разрешён.</strong>
          Полнота структуры не удостоверяет право повторного использования или точность фактов.</p>
        <h3>Первое публичное демо · историческое наблюдение 03.11.2026</h3>
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
                <td>Первое демо: PARTIAL_UNAPPROVED (5 матчей). Более поздняя отдельная проверка дала 240/240, но права FotMob не утверждены.</td></tr>
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
