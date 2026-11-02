import {EmptyState,PageHeading} from '@/components/empty-state';
import {ResearchLockViewer} from '@/components/research-lock-viewer';
import {M2CandidateReplay} from '@/components/m2-candidate-replay';
import {readM2TrainOnlyRun} from '@/lib/m2-run-status';
import storedReplayEvidence from '../../../../../docs/M2_STORED_TRAIN_REPLAY_EVIDENCE.json';

export default async function Page(){
  const researchRun=await readM2TrainOnlyRun();
  return <>
    <PageHeading eyebrow="M2 · ИССЛЕДОВАНИЕ" title="Лаборатория моделей"
      subtitle="Протокол, подготовка обучения и контроль исследовательских доказательств. Отчёты не равны опубликованным прогнозам."/>
    <div className="stat-grid">
      <div className="stat"><span>План M2</span><strong>4/8</strong><small>4 блока ещё не приняты; перенос Elo/Dixon–Coles документирован</small></div>
      <div className="stat"><span>Обучающая выборка</span><strong>240</strong><small>2024/25 · 16 клубов · read-only</small></div>
      <div className="stat"><span>Утверждённых моделей</span><strong>0</strong><small>2 временных train-only fit подтверждены, модель не сохранена</small></div>
      <div className="stat"><span>Публикация прогнозов</span><strong>0</strong><small>Holdout 2025/26 закрыт</small></div>
    </div>
    <div className="panel-grid">
      <section className="panel informative">
        <h2>Фиксированный базовый протокол</h2>
        <p>Independent Poisson v1 с фиксированной регуляризацией: обучение только на РПЛ 2024/25, затем неизменяемая фиксация SHA модели и источника. Для 2025/26 доступ к оценке ещё не разрешён. Реальные исторические предматчевые срезы источников не подтверждены.</p>
        <a className="sources-method" href="https://github.com/StanleyLl0yd/FootballForecast/blob/main/docs/M2_BASELINE_PROTOCOL.md"
          target="_blank" rel="noopener noreferrer">Открыть протокол ↗</a>
      </section>
      <section className="panel informative">
        <h2>Защищённое исследовательское задание</h2>
        <p>Подготовлен ручной запуск только с подтверждением владельца и точным SHA исходного CSV — через GitHub Actions или точную команду владельца в issue #182. Выполняется вне сайта в защищённой среде GitHub, без записи в Supabase и без чтения результатов контрольного сезона.</p>
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
        Внешняя сверка 240/240 на закреплённом CSV ещё не выполнена; модель
        не сохранена и не допущена к holdout 2025/26, метрики точности отсутствуют.
        Полный машиночитаемый отчёт хранится в репозитории без матчей и коэффициентов.</p>
      <a className="sources-method" href="https://github.com/StanleyLl0yd/FootballForecast/blob/main/docs/M2_STORED_TRAIN_REPLAY_EVIDENCE.json"
        target="_blank" rel="noopener noreferrer">Проверить ограниченное evidence ↗</a>
    </section>
    <M2CandidateReplay/>
    <ResearchLockViewer/>
    <section className="panel informative">
      <h2>Ограничения M2</h2>
      <p>Два временных train-only fit на сохранённых данных дали одинаковые SHA; это не утверждённый model lock. Пока не зафиксирован доверенный эксперимент и не подтверждено происхождение контрольных данных,
        нет реальных Log Loss, Brier, RPS, калибровки или разрешённой публичной модели.
        Elo и Dixon–Coles отложены до независимой валидационной выборки — это решение об отсутствии достаточных данных, а не сравнение их точности.
        Даже будущая ретроспективная оценка не будет подтверждённым историческим предматчевым прогнозом.</p>
      <a className="sources-method" href="https://github.com/StanleyLl0yd/FootballForecast/issues/182"
        target="_blank" rel="noopener noreferrer">Отслеживать M2 ↗</a>
      <EmptyState title="Проверенная модель пока отсутствует"
        description="Исследовательский JSON можно проверить локально, но доказательства и статус нужно подтверждать в защищённом GitHub."/>
    </section>
  </>;
}
