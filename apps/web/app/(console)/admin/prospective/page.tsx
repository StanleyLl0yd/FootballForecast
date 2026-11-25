import 'server-only';
import {requireOwner} from '@/lib/auth';
import {PageHeading} from '@/components/empty-state';
import {inspectRecordedM4OwnerStatus} from '@/lib/m4-owner-status.mjs';
import recorded from '../../../../../../docs/M4_OWNER_AGGREGATE_2026-11-24.json';

export const dynamic = 'force-dynamic';

export default async function Page(){
  await requireOwner();
  const summary = inspectRecordedM4OwnerStatus(recorded);
  return <>
    <PageHeading eyebrow="OWNER · M4" title="Приватный проспективный контроль"
      subtitle="Только владелец. Архивная агрегатная проверка, не мониторинг в реальном времени."/>
    {!summary ? <section className="panel informative">
      <h2>Подтверждение недействительно</h2>
      <p>Агрегатный снимок не прошёл проверку. Статус не определён; никаких действий не разрешено.</p>
    </section> : <>
      <section className="panel informative">
        <h2>Зафиксированное состояние на {summary.recordedDate}</h2>
        <p>Сведения из защищённых запусков и проверок базы на указанную дату.
          Текущая база, статусы GitHub и результаты матчей здесь не запрашиваются.</p>
        <div className="stat-grid">
          <div className="stat"><span>Критерии M4</span>
            <strong>{summary.gatesAccepted}/{summary.gatesTotal}</strong>
            <small>A1–A5 приняты; A6–A8 открыты.</small></div>
          <div className="stat"><span>Предматчевые записи</span>
            <strong>{summary.captures}</strong><small>Подписанные подтверждения: {summary.timeProofs}</small></div>
          <div className="stat"><span>Закрытые shadow-записи</span>
            <strong>{summary.shadowEntries}</strong>
            <small>FORECAST: {summary.forecast}; ABSTAIN: {summary.abstain}</small></div>
          <div className="stat"><span>Наблюдение клубных источников</span>
            <strong>{summary.clubBodies}/8</strong>
            <small>Только байты и время получения, не статус результата.</small></div>
          <div className="stat"><span>Публичные прогнозы / результаты</span>
            <strong>{summary.publicForecasts} / {summary.publicOutcomes}</strong>
            <small>Публикация и утверждение модели не разрешены.</small></div>
          <div className="stat"><span>FORCE RLS · таблицы M4</span>
            <strong>{summary.forceRlsM4Tables}</strong>
            <small>Таблицы A6: {summary.a6Tables}. Миграция не применена.</small></div>
        </div>
        <p><a href={summary.captureRun} rel="noreferrer">Предматчевый защищённый запуск ↗</a>
          {' · '}<a href={summary.clubRun} rel="noreferrer">Проверка клубных источников ↗</a></p>
        <p className="source-lab-note">Коммит проверки: <code>{summary.codeSha}</code></p>
      </section>
      <section className="panel informative">
        <h2>A6 · Допуск результатов</h2>
        <p>Официальное подтверждение фактической игры и решений КДК ещё не завершено.
          Метрики проспективного качества отсутствуют. ABSTAIN никогда не оценивается.</p>
        <p><a href={summary.blocker} rel="noreferrer">Блокер A6 ↗</a>
          {' · '}<a href={summary.milestone} rel="noreferrer">Критерии M4 ↗</a></p>
        <h3>A7 · Управление и отчёты</h3>
        <p>Первый экран только для чтения. Запуск задач из браузера,
          выдача индивидуальных прогнозов и отчёты по «Зениту» пока недоступны.</p>
        <p>Не показаны вероятности, исходные данные, приватные идентификаторы,
          токены или метрики. Данные 2025/26 не запрашиваются.</p>
      </section>
    </>}
  </>;
}
