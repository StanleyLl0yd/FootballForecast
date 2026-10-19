// M0 read-only, user-initiated browser probes against the current site only.
// Next.js server components handle Frankfurt-to-Supabase connectivity.
export type ConnectivityResult={
  id:'health'|'dashboard'|'archive';
  label:string;
  state:'passed'|'failed';
  httpStatus:number|null;
  elapsedMs:number|null;
};
async function check(
  id:ConnectivityResult['id'],
  label:string,
  request:()=>Promise<Response>,
  validate:(response:Response)=>Promise<boolean>
):Promise<ConnectivityResult>{
  const started=Date.now();
  try{
    const response=await request();
    const valid=response.ok&&await validate(response);
    return {id,label,state:valid?'passed':'failed',
      httpStatus:response.status,elapsedMs:Date.now()-started};
  }catch{
    // A failed connection may contain private network detail: never serialize errors.
    return {id,label,state:'failed',httpStatus:null,elapsedMs:Date.now()-started};
  }
}
export async function runConnectivityChecks(fetchImpl:typeof fetch=fetch):Promise<ConnectivityResult[]>{
  const requestOptions={method:'GET' as const,cache:'no-store' as const,redirect:'error' as const};
  return Promise.all([
    check('health','Публичный API сайта',
      ()=>fetchImpl('/api/health',{...requestOptions,signal:AbortSignal.timeout(10000)}),
      async response=>{
        if(!response.headers.get('content-type')?.includes('application/json'))return false;
        const value=await response.json();
        return value?.service==='footballforecast'&&value?.status==='public_configured';
      }),
    check('dashboard','Страница аналитики',
      ()=>fetchImpl('/dashboard',{...requestOptions,signal:AbortSignal.timeout(10000)}),
      async response=>{
        const body=await response.text();
        return body.includes('Футбольная аналитика')&&
          body.includes('Публичная база подключена')&&!body.includes('Данные временно недоступны');
      }),
    check('archive','Архив прогнозов',
      ()=>fetchImpl('/archive',{...requestOptions,signal:AbortSignal.timeout(10000)}),
      async response=>{
        const body=await response.text();
        return body.includes('История публикаций')&&!body.includes('Архив временно недоступен')&&
          !body.includes('База пока не настроена');
      })
  ]);
}
export function formatConnectivityReport(items:ConnectivityResult[],time:string):string{
  return ['FootballForecast M0 connectivity self-check',time,
    'Only this browser and current network were tested. No IP/device details are captured.',
    ...items.map(x=>x.label+': '+(x.state==='passed'?'PASS':'FAIL')+
      (x.httpStatus===null?'':' HTTP '+x.httpStatus)+
      (x.elapsedMs===null?'':' '+x.elapsedMs+'ms'))].join('\n');
}
