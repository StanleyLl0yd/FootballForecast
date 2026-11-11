import {EmptyState,PageHeading} from '@/components/empty-state';
import {ResearchLockViewer} from '@/components/research-lock-viewer';
import {M2CandidateReplay} from '@/components/m2-candidate-replay';
import {readM2TrainOnlyRun} from '@/lib/m2-run-status';
import storedReplayEvidence from '../../../../../docs/M2_STORED_TRAIN_REPLAY_EVIDENCE.json';

export default async function Page(){
  const researchRun=await readM2TrainOnlyRun();
  return <>
    <PageHeading eyebrow="M2 ПРИНЯТ · M3 ИССЛЕДОВАНИЕ" title="Лаборатория моделей"
      subtitle="Протокол, подготовка обучения и контроль исследовательских доказательств. Отчёты не равны опубликованным прогнозам."/>
    <div className="stat-grid">
      <div className="stat"><span>План M2</span><strong>8/8</strong><small>M2 принят 09.11.2026; M3: 6/8 технически приняты, A7–A8 открыты</small></div>
      <div className="stat"><span>Обучающая выборка</span><strong>240</strong><small>2024/25 · 16 клубов · read-only</small></div>
      <div className="stat"><span>Утверждённых моделей</span><strong>0</strong><small>Один private escrow Poisson, TRAIN_ONLY_UNAPPROVED; production-модель не утверждена</small></div>
      <div className="stat"><span>Публикация прогнозов</span><strong>0</strong><small>Holdout 2025/26 использован ровно один раз; повтор запрещён</small></div>
    </div>
    <div className="panel-grid">
      <section className="panel informative">
        <h2>Фиксированный базовый протокол</h2>
        <p>Independent Poisson v1 с фиксированной регуляризацией: обучение только на РПЛ 2024/25, затем неизменяемая фиксация SHA модели и источника. Один защищённый ретроспективный тест 2025/26 выполнен: 182/240 матчей, 58 отказов; повтор запрещён. Реальные исторические предматчевые срезы источников не подтверждены.</p>
        <a className="sources-method" href="https://github.com/StanleyLl0yd/FootballForecast/blob/main/docs/M2_BASELINE_PROTOCOL.md"
          target="_blank" rel="noopener noreferrer">Открыть протокол ↗</a>
      </section>
      <section className="panel informative">
        <h2>Защищённое исследовательское задание</h2>
        <p>Исторический train-only сценарий с ручным подтверждением владельца и SHA входного CSV выполнялся отдельно от сайта. Единственная защищённая итоговая оценка уже проведена в GitHub Actions #42590191735, её неизменяемые частные агрегаты находятся в Supabase. Повторять оценку нельзя.</p>
        <a className="sources-method" href="https://github.com/StanleyLl0yd/FootballForecast/actions/workflows/m2-manual-research-lock.yml"
          target="_blank" rel="noopener noreferrer">Состояние и запуск в GitHub ↗</a>
        {researchRun.state==='run'?
          <p className="source-lab-note" role="status">
            Последний публичный workflow: <strong>{researchRun.status}</strong>
            {researchRun.conclusion?` · ${researchRun.conclusion}`:''}.
            {' '}<a href={researchRun.url} target="_blank" rel="noopener noreferrer">
              Запуск #{researchRun.id} ↗</a>. Успешный workflow не доказывает достоверность
            аттестата, принятие модели или готовность оценки holdout.
          </p>:researchRun.state==='no_runs'?
          <p className="source-lab-note" role="status">
            Публичный GitHub API не обнаружил защищённых ручных запусков M2.
          </p>:
          <p className="source-lab-note" role="status">
            Состояние защищённого workflow сейчас не подтверждено GitHub API;
            это не означает отсутствия запусков.
          </p>}
        <p className="source-lab-note">Сайт не отправляет команды на обучение и не может удостоверить результаты GitHub Actions.</p>
      </section>
    </div>
    <section className="panel informative">
      <h2>Закреплённое наблюдение: два независимых train-only запуска</h2>
      <p>По журналам защищённого GitHub Actions 02.11.2026 два отдельных запуска
        на одном Git-коммите завершились успешно. В обоих совпали SHA сохранённой
        обучающей выборки (240 матчей, 16 клубов), карты клубов и временной модели.
        Это сверенное исследовательское наблюдение, <strong>не утверждённая модель</strong>.
      </p>
      <p>SHA-256 временной модели: <code>{storedReplayEvidence.receipt.fittedModelSha256}</code></p>
      <p>SHA-256 агрегированного отчёта: <code>{storedReplayEvidence.receiptSha256}</code></p>
      <ul>
        {storedReplayEvidence.runs.map(run=><li key={run.runId}>
          <a href={`https://github.com/StanleyLl0yd/FootballForecast/actions/runs/${run.runId}`}
            target="_blank" rel="noopener noreferrer">GitHub Actions #{run.runId} ↗</a>
          {' · '}один из двух независимых запусков · статус {run.conclusion}
        </li>)}
      </ul>
      <p className="source-lab-note">Footbolno при этих запусках не запрашивался.
        Эти два архивных временных запуска сами по себе не утверждали модель и не открывали holdout.
        Позднее отдельно сохранён один TRAIN_ONLY_UNAPPROVED артефакт и проведена
        единственная приватная оценка 2025/26; её численные метрики не публикуются.
        Полный машиночитаемый отчёт хранится в репозитории без матчей и коэффициентов.</p>
      <a className="sources-method" href="https://github.com/StanleyLl0yd/FootballForecast/blob/main/docs/M2_STORED_TRAIN_REPLAY_EVIDENCE.json"
        target="_blank" rel="noopener noreferrer">Проверить ограниченное evidence ↗</a>
    </section>
    <section className="panel informative">
      <h2>Рабочий экран владельца</h2>
      <p>Сводка условий допуска, закреплённых SHA и статуса защищённого исследования доступна
        только владельцу после GitHub-аутентификации. Ни обучение, ни контрольный сезон
        через сайт не запускаются.</p>
      <a className="sources-method" href="/admin/research">Открыть защищённый контроль M2 ↗</a>
    </section>
    <section className="panel informative">
      <h2>M3 · Новый этап оценки и калибровки</h2>
      <p>Пять хронологических folds проверены на реальных исторических матчах РПЛ.
        <strong> 1 680/1 680</strong> календарных сопоставлений по семи сезонам,
        семь технических/пересмотренных результатов исключены.
        В ретроспективном эксперименте Poisson и H/D/A baseline оценены на одинаковых
        1 197 матчах; Poisson показал меньшие Log Loss, Brier и RPS.
        Это результаты ограниченного исследования, не утверждённая production-модель.</p>
      <p className="source-lab-warning">M3-A3–A6 технически приняты только для
        NON_STRICT_RETROSPECTIVE, A7–A8 открыты. Оригинальные предматчевые
        временные метки не удостоверены; 2025/26 нельзя использовать повторно,
        публикация прогнозов не разрешена.</p>
      <a className="sources-method" href="/admin/research">Защищённый контроль M3 ↗</a>
    </section>
    <M2CandidateReplay/>
    <ResearchLockViewer/>
    <section className="panel informative">
      <h2>Ограничения M2</h2>
      <p>M2 принят как ограниченный исследовательский этап, но одна приватная оценка 2025/26 (182 матча, 58 отказов) имеет статус DAY_ONLY / NON_STRICT_RETROSPECTIVE. Численные Log Loss, Brier и RPS хранятся только в Supabase; оригинальный CSV не заархивирован, played-vs-awarded не полностью сверены и историческое время появления данных не доказано. Превосходство над букмекерами не подтверждено.
        Elo, Dixon–Coles и калибровка отложены до независимой валидации. Модель не допущена к production, публичных прогнозов нет; повторное использование holdout запрещено. M3 открыт отдельно для приватных исследований, но не разрешает публикацию.</p>
      <a className="sources-method" href="https://github.com/StanleyLl0yd/FootballForecast/issues/182"
        target="_blank" rel="noopener noreferrer">Отслеживать M2 ↗</a>
      <EmptyState title="Нет утверждённой production-модели"
        description="Исследовательский JSON можно проверить локально, но доказательства и статус нужно подтверждать в защищённом GitHub."/>
    </section>
  </>;
}
