import {PageHeading} from '@/components/empty-state';
import {SourceEvidenceLab} from '@/components/source-evidence-lab';
import sourceRegistry from '../../../../../docs/M0_FREE_SOURCE_REGISTRY.json';

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
      <div className="stat"><span>Активных подключений</span><strong>{active}</strong>
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
