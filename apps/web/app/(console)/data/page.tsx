import {PageHeading} from '@/components/empty-state';
import {SourceEvidenceLab} from '@/components/source-evidence-lab';
import {OpenProviderPreview} from '@/components/open-provider-preview';
import sourceRegistry from '../../../../../docs/M0_FREE_SOURCE_REGISTRY.json';
import historicalEvidence from '../../../../../docs/M0_OPENFOOTBALL_RPL_STRUCTURAL_EVIDENCE.json';
import footbolnoEvidence from '../../../../../docs/M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json';
import currentRplCrosscheck from '../../../../../docs/M0_RPL_2026_27_EDITORIAL_AGGREGATE_CROSSCHECK.json';

const categories=[
  {priority:1,title:'Официальные первоисточники',
    description:'Приоритет для подтверждения итогов, дат, переноса поля и статуса матча.'},
  {priority:2,title:'Открытые исторические данные',
    description:'Бесплатные структурированные наборы; точность, лицензии и полные сезоны ещё проверяются.'},
  {priority:3,title:'Дополнительная проверка и бесплатные API',
    description:'Контроль результатов и расписания при соблюдении лимитов, атрибуции и прав.'},
  {priority:4,title:'Ограниченные исследовательские источники',
    description:'Только справочная информация там, где автоматический сбор и использование не разрешены.'}
];
const accessLabels:Record<string,string>={
  'manual-reference':'Ручная сверка',
  'offline-candidate':'Офлайн-кандидат',
  'free-api-candidate':'Кандидат на бесплатный API',
  'restricted-reference':'Только справочно'
};

export default function DataCenter(){
  const sources=sourceRegistry.sources;
  const active=sources.filter(source=>source.active).length;
  const measured=sources.filter(source=>source.empiricalResultErrorRate!==null).length;
  return <>
    <PageHeading eyebrow="M0 / РЕЕСТР ИСТОЧНИКОВ" title="Центр данных"
      subtitle="Бесплатные источники, доказательства надёжности и ограничения использования. Это исследование, а не подключённые прогнозные данные."/>
    <div className="stat-grid">
      <div className="stat"><span>Источников в реестре</span><strong>{sources.length}</strong>
        <small>Бесплатные и общедоступные справочные</small></div>
      <div className="stat"><span>Активных импортов</span><strong>{active}</strong>
        <small>Импорт данных не разрешён на M0</small></div>
      <div className="stat"><span>Измеренная точность</span><strong>{measured}</strong>
        <small>Нужна независимая сверка матчей</small></div>
      <div className="stat"><span>Этап проекта</span><strong>M0</strong>
        <small>Обучение моделей ещё не начиналось</small></div>
    </div>
    <section className="panel sources-intro">
      <h2>Как определяется надёжность</h2>
      <p>Приоритеты от 1 до 4 означают полезность и авторитетность источника для конкретных сведений, а не измеренный процент точности. Для настоящего рейтинга нужны сверенные матчи, учёт ошибок счёта и хозяев поля, пропусков, даты публикации и зависимости сайтов от общего поставщика.</p>
      <p>Ни один источник пока не одобрен для автоматического импорта или обучения. Все функции сайта остаются бесплатными; платные источники исключены. Публичность сайта с результатами не означает разрешение на скачивание его базы.</p>
      <a className="sources-method" href="https://github.com/StanleyLl0yd/FootballForecast/blob/main/docs/M0_SOURCE_ACCURACY_PROTOCOL.md"
        target="_blank" rel="noopener noreferrer">Методика проверки точности <span aria-hidden="true">↗</span></a>
    </section>
    <section className="panel historical-source-evidence">
      <h2>Footbolno: 11 сезонов РПЛ по зафиксированному CSV</h2>
      <p>Одноразовое исследование {footbolnoEvidence.reviewedAtUTC.slice(0,10)}:
        {footbolnoEvidence.sourceRowCount.toLocaleString('ru-RU')} записей,
        {footbolnoEvidence.seasons.length} сезонов.
        Это структура опубликованного источника, не разрешение скачивать его данные,
        не проверка официальных протоколов и не история изменений до матчей.</p>
      <div className="source-lab-table-wrapper">
        <table className="source-lab-table">
          <thead><tr>
            <th scope="col">Сезон</th><th scope="col">Записей</th>
            <th scope="col">Завершено по источнику</th>
            <th scope="col">Запланировано</th><th scope="col">Клубов</th>
            <th scope="col">Различных пар</th><th scope="col">Структурная оценка</th>
          </tr></thead>
          <tbody>{footbolnoEvidence.seasons.map(season=><tr key={season.season}>
            <th scope="row">{season.season}</th>
            <td>{season.sourceRows}</td>
            <td>{season.statuses.finished}</td>
            <td>{season.statuses.scheduled}</td>
            <td>{season.distinctClubCount}</td>
            <td>{season.distinctDirectedPairs}
              {season.duplicateDirectedPairs>0?
                <small>{season.duplicateDirectedPairs} повторных пар</small>:null}
            </td>
            <td>{season.structuralResearchClassification==='QUARANTINE_ANOMALOUS_SEASON'?
              'Карантин: аномалии':'Только структура, не одобрено'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="source-lab-warning">
        Сезоны 2016/17–2020/21: карантин из-за пропусков, лишних команд или повторных игр.
        В 2026/27 CSV отмечает 88 завершённых и 152 запланированные игры.
        Суммарные 246 голов совпадают с вручную проверенной редакционной таблицей после 11 туров,
        но это не доказывает правильность каждого счёта либо независимость первоисточников.
      </p>
      <p className="source-lab-note">
        Зафиксированное сравнение: {currentRplCrosscheck.reference.derivedUniqueMatches} игр,
        {currentRplCrosscheck.reference.leagueGoalsFor} голов по редакционной таблице;
        обучение и импорт данных запрещены на M0.
      </p>
      <a className="sources-method" href="https://github.com/StanleyLl0yd/FootballForecast/blob/main/docs/M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json"
        target="_blank" rel="noopener noreferrer">Детали исследования, хэш и ограничения ↗</a>
    </section>
    <section className="panel historical-source-evidence">
      <h2>OpenFootball: проверка структуры пяти сезонов РПЛ</h2>
      <p>Это проверка файлов бесплатного исторического архива, а не сверка всех матчей с официальными протоколами. В таблице технические результаты отделены от сыгранных встреч и физических голов.</p>
      <div className="source-lab-table-wrapper">
        <table className="source-lab-table">
          <thead><tr>
            <th scope="col">Сезон</th><th scope="col">Всего записей</th>
            <th scope="col">Уникальных пар</th><th scope="col">Сыграно</th>
            <th scope="col">Присуждено</th><th scope="col">Голы в сыгранных</th>
            <th scope="col">Технические голы</th>
          </tr></thead>
          <tbody>{historicalEvidence.seasons.map(season=><tr key={season.season}>
            <th scope="row">
              <a href={`https://github.com/openfootball/europe/blob/${historicalEvidence.sourceCommit}/${season.path}`}
                target="_blank" rel="noopener noreferrer">{season.season} ↗</a>
            </th>
            <td>{season.parsedMatches}/{season.claimedMatches}</td>
            <td>{season.directedFixturePairs}/240
              {season.missingPairs>0?<small>Ошибка ориентации поля</small>:null}</td>
            <td>{season.playedMatches}</td>
            <td>{season.awardedMatches}</td>
            <td>{season.sourceReportedPlayedGoals.home} + {season.sourceReportedPlayedGoals.away}</td>
            <td>{season.sourceReportedAdministrativeGoals.home} + {season.sourceReportedAdministrativeGoals.away}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="source-lab-warning">
        В 2019/20 и 2020/21 суммарно шесть административных результатов [awarded].
        В 2023/24 присутствует известная ошибка места проведения матча «Сочи» - «Спартак».
        У этих данных пока нет разрешения на автоматический импорт и обучение модели.
      </p>
      <a className="sources-method" href="https://github.com/StanleyLl0yd/FootballForecast/blob/main/docs/M0_OPENFOOTBALL_RPL_STRUCTURAL_EVIDENCE.json"
        target="_blank" rel="noopener noreferrer">Доказательства, версии исходных файлов и ограничения ↗</a>
    </section>
    <OpenProviderPreview/>
    <SourceEvidenceLab/>
    <div className="source-groups">
      {categories.map(category=>{
        const entries=sources.filter(source=>source.priority===category.priority);
        return <details className="panel source-group" key={category.priority} open={category.priority<=2}>
          <summary>
            <span><strong>Приоритет {category.priority}. {category.title}</strong>
              <small>{category.description}</small></span>
            <span className="source-count">{entries.length} источн.</span>
          </summary>
          <ul className="source-grid">
            {entries.map(source=><li className="source-entry" key={source.id}>
              <div className="source-entry-header">
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title} <span aria-hidden="true">↗</span>
                </a>
                <span>{accessLabels[source.access]??'Исследование'}</span>
              </div>
              <p>{source.limitations}</p>
              <div className="source-entry-footer">
                <span>Точность не измерена</span>
                <span>Не подключён</span>
              </div>
            </li>)}
          </ul>
        </details>;
      })}
    </div>
    <p className="source-disclaimer">
      Список формируется из единого проверяемого реестра GitHub. Предварительные уровни не являются лицензией, результатом обучения, прогнозом или гарантиями доступности РПЛ 2026/27.
    </p>
  </>;
}
