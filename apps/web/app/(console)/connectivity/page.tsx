'use client';
import {useState} from 'react';
import {PageHeading} from '@/components/empty-state';
import {formatConnectivityReport,runConnectivityChecks} from '@/lib/connectivity';
import type {ConnectivityResult} from '@/lib/connectivity';

const titles={passed:'Доступно',failed:'Нет подтверждения связи',not_configured:'Не настроено'};

export default function ConnectivityPage(){
  const [results,setResults]=useState<ConnectivityResult[]|null>(null);
  const [report,setReport]=useState('');
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState(false);
  async function run(){
    setBusy(true);
    setCopied(false);
    try{
      // NEXT_PUBLIC keys are intentionally browser-publishable; never use a service role.
      const next=await runConnectivityChecks(process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
      setResults(next);
      setReport(formatConnectivityReport(next,new Date().toISOString()));
    }finally{setBusy(false);}
  }
  async function copy(){
    try{await navigator.clipboard.writeText(report);setCopied(true);}
    catch{setCopied(false);}
  }
  return <>
    <PageHeading eyebrow="M0 / ПРОВЕРКА ДОСТУПНОСТИ"
      title="Проверка соединения"
      subtitle="Проверяет только доступность FootballForecast и публичной базы из этого браузера. Запускается вручную, без регистрации."/>
    <section className="panel connectivity-panel">
      <h2>Проверка из вашей сети</h2>
      <p>Для проверки российских операторов отключите VPN и запустите тест через нужный Wi-Fi или мобильный интернет. Результаты зависят от оператора, браузера и времени проверки. Успех одного подключения не означает доступность у всех.</p>
      <button type="button" className="primary-action" onClick={run} disabled={busy}>
        {busy?'Проверка выполняется…':'Проверить соединение'}
      </button>
      <p className="connectivity-note">Отправляются только три обычных GET-запроса. Приложение не сохраняет отчёт и не отправляет его разработчику. Обычные сетевые журналы Vercel и Supabase могут содержать технические сведения о запросах.</p>
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
      <p className="connectivity-note">Ошибка может означать блокировку, сбой сети, CORS, тайм-аут или проблему сервиса. Этот тест не определяет конкретную причину и не измеряет доступность других операторов.</p>
      <button type="button" className="primary-action" onClick={copy}>
        {copied?'Отчёт скопирован':'Скопировать отчёт'}
      </button>
      <pre className="connectivity-report">{report}</pre>
    </section>}
  </>;
}
