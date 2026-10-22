'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {PageHeading} from '@/components/empty-state';
import {formatConnectivityReport,runConnectivityChecks} from '@/lib/connectivity';
import type {ConnectivityResult} from '@/lib/connectivity';

const titles={passed:'Доступно',failed:'Нет подтверждения связи'};

export default function ConnectivityPage(){
  const [results,setResults]=useState<ConnectivityResult[]|null>(null);
  const [report,setReport]=useState('');
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState(false);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState(false);
  // Hydration readiness must be published after a browser paint, rather than
  // synchronously setting React state inside an effect (React 19 lint rule).
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>setReady(true));
    return ()=>cancelAnimationFrame(frame);
  },[]);
  async function run(){
    if(busy)return;
    setBusy(true);
    setCopied(false);
    setError(false);
    setResults(null);
    setReport('');
    try{
      const next=await runConnectivityChecks();
      const text=formatConnectivityReport(next,new Date().toISOString());
      setResults(next);
      setReport(text);
    }catch{
      // No raw browser/network errors or user-specific addresses in UI/report.
      setError(true);
    }finally{setBusy(false);}
  }
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    void run();
  }
  async function copy(){
    try{await navigator.clipboard.writeText(report);setCopied(true);}
    catch{setCopied(false);}
  }
  return <>
    <PageHeading eyebrow="M0 / ПРОВЕРКА ДОСТУПНОСТИ"
      title="Проверка соединения"
      subtitle="Проверяет доступность FootballForecast и серверное чтение публичной базы. Запускается вручную, без регистрации."/>
    <section className="panel connectivity-panel">
      <h2>Проверка из вашей сети</h2>
      <p>Для проверки российских операторов отключите VPN и запустите тест через нужный Wi-Fi или мобильный интернет. Результаты зависят от оператора, браузера и времени проверки. Успех одного подключения не означает доступность у всех.</p>
      {/* Native GET form remains operable if Next.js client JS fails to hydrate.
          React intercepts submit only after hydration; the static fallback does
          not need Next chunks, user registration, cookies or Supabase secrets. */}
      <form method="get" action="/m0-carrier-check.html" onSubmit={submit}>
        <button type="submit" className="primary-action" disabled={busy}
          data-connectivity-ready={ready?'true':'false'}>
          {busy?'Проверка выполняется…':'Проверить соединение'}
        </button>
      </form>
      <p role="status" aria-live="polite" className="connectivity-note">
        {busy?'Выполняются три проверки, до 10 секунд каждая…':
          error?'Не удалось завершить проверку. Попробуйте автономную проверку по ссылке ниже.':
          results?'Проверка завершена, результаты показаны ниже.':
          ready?'Кнопка готова. Нажмите для проверки этой сети.':
          'Интерфейс загружается. Если он не заработает, кнопка откроет автономную проверку.'}
      </p>
      <noscript><p className="connectivity-note">
        JavaScript отключён. Кнопка откроет автономную страницу, где для теста нужен JavaScript.
      </p></noscript>
      <p className="connectivity-note">Если сайт вообще не открывается из нужной сети, заранее <a href="/m0-carrier-check.html" download="footballforecast-carrier-check.html">скачайте автономную HTML-проверку</a> на доступном подключении и откройте файл без интернета. Она проверяет только публичный health API, поэтому не заменяет тест всей страницы.</p>
      <p className="connectivity-note">Отправляются три GET-запроса только на текущий сайт. Браузер не обращается к Supabase напрямую и не передаёт ключи. Отчёт не сохраняется в приложении; обычные серверные журналы запросов могут сохраняться.</p>
    </section>
    {results&&<section className="panel connectivity-panel" aria-live="polite">
      <h2>Результаты</h2>
      <ul className="connectivity-list">{results.map(item=>
        <li key={item.id}>
          <strong>{item.label}</strong>
          <span className={item.state==='passed'?'connectivity-success':'connectivity-problem'}>
            {titles[item.state]}{item.httpStatus===null?'':' · HTTP '+item.httpStatus}
            {item.elapsedMs===null?'':' · '+item.elapsedMs+' мс'}
          </span>
        </li>
      )}</ul>
      <p className="connectivity-note">Ошибка может означать блокировку, сбой сети, тайм-аут или проблему сервиса. Этот тест не определяет конкретную причину и не измеряет доступность других операторов.</p>
      <button type="button" className="primary-action" onClick={copy}>
        {copied?'Отчёт скопирован':'Скопировать отчёт'}
      </button>
      <pre className="connectivity-report">{report}</pre>
    </section>}
  </>;
}
