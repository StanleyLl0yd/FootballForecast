import {EmptyState,PageHeading} from '@/components/empty-state';
import {ResearchLockViewer} from '@/components/research-lock-viewer';
import {readM2TrainOnlyRun} from '@/lib/m2-run-status';

export default async function Page(){
  const researchRun=await readM2TrainOnlyRun();
  return <>
    <PageHeading eyebrow="M2 · ИССЛЕДОВАНИЕ" title="Лаборатория моделей"
      subtitle="Протокол, подготовка обучения и контроль исследовательских доказательств. Отчёты не равны опубликованным прогнозам."/>
    <div className="stat-grid">
      <div className="stat"><span>План M2</span><strong>3/8</strong><small>5 блоков ещё не приняты; статус на 02.11.2026</small></div>
      <div className="stat"><span>Обучающая выборка</span><strong>240</strong><small>2024/25 · 16 клубов · read-only</small></div>
      <div className="stat"><span>Обученных моделей</span><strong>0</strong><small>Реальный запуск ещё не подтверждён</small></div>
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
        <p>Подготовлен ручной запуск только с подтверждением владельца и точным SHA исходного CSV. Выполняется вне сайта, через GitHub Actions с защищённой средой, без записи в Supabase и без чтения результатов контрольного сезона.</p>
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
    <ResearchLockViewer/>
    <section className="panel informative">
      <h2>Ограничения M2</h2>
      <p>Пока не зафиксирован доверенный эксперимент и не подтверждено происхождение контрольных данных,
        нет реальных Log Loss, Brier, RPS, калибровки или разрешённой публичной модели.
        Elo и Dixon–Coles отложены до независимой валидационной выборки.
        Даже будущая ретроспективная оценка не будет подтверждённым историческим предматчевым прогнозом.</p>
      <a className="sources-method" href="https://github.com/StanleyLl0yd/FootballForecast/issues/182"
        target="_blank" rel="noopener noreferrer">Отслеживать M2 ↗</a>
      <EmptyState title="Проверенная модель пока отсутствует"
        description="Исследовательский JSON можно проверить локально, но доказательства и статус нужно подтверждать в защищённом GitHub."/>
    </section>
  </>;
}
