// Browser-only, user-initiated M0 network probes. No telemetry or writes.
export type ConnectivityResult={
  id:'health'|'dashboard'|'supabase';
  label:string;
  state:'passed'|'failed'|'not_configured';
  httpStatus:number|null;
  elapsedMs:number|null;
};

// Current publicly provisioned M0 Supabase Free project, not a caller-controlled URL.
const projectOrigin='https://upulkesaiwnwfagjgteh.supabase.co';
const matchesEndpoint='https://upulkesaiwnwfagjgteh.supabase.co/rest/v1/ff_matches?select=id&limit=1';

export function validPublishableEndpoint(url:string|undefined,key:string|undefined):boolean {
  return url===projectOrigin&&typeof key==='string'&&key.startsWith('sb_publishable_');
}
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
    // Errors can contain private network details; never include them in reports.
    return {id,label,state:'failed',httpStatus:null,elapsedMs:Date.now()-started};
  }
}

export async function runConnectivityChecks(
  supabaseUrl:string|undefined,
  publishableKey:string|undefined,
  fetchImpl:typeof fetch=fetch
):Promise<ConnectivityResult[]> {
  const options={method:'GET' as const,cache:'no-store' as const,
    redirect:'error' as const};
  const health=check('health','Vercel: проверка API',
    ()=>fetchImpl('/api/health',{...options,signal:AbortSignal.timeout(10000)}),
    async response=>{
      const value=await response.json();
      return value?.service==='footballforecast'&&value?.status==='public_configured';
    });
  const dashboard=check('dashboard','Vercel: публичная страница',
    ()=>fetchImpl('/dashboard',{...options,signal:AbortSignal.timeout(10000)}),
    async response=>{
      const text=await response.text();
      return text.includes('Футбольная аналитика')&&text.includes('Публичная база подключена');
    });
  const supabase=validPublishableEndpoint(supabaseUrl,publishableKey)
    ?check('supabase','Supabase: прямое чтение',
      ()=>fetchImpl(matchesEndpoint,{...options,signal:AbortSignal.timeout(10000),
        headers:{apikey:publishableKey!,Accept:'application/json'}}),
      async response=>{
        if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))return false;
        return Array.isArray(await response.json());
      })
    :Promise.resolve({id:'supabase',label:'Supabase: прямое чтение',
      state:'not_configured',httpStatus:null,elapsedMs:null} as ConnectivityResult);
  return Promise.all([health,dashboard,supabase]);
}

export function formatConnectivityReport(items:ConnectivityResult[],time:string):string{
  const labels={passed:'PASS',failed:'FAIL',not_configured:'NOT_CONFIGURED'};
  return ['FootballForecast M0 connectivity self-check',time,
    'These observations apply only to the browser/network used for the test.',
    ...items.map(x=>x.label+': '+labels[x.state]+
      (x.httpStatus===null?'':' HTTP '+x.httpStatus)+
      (x.elapsedMs===null?'':' '+x.elapsedMs+'ms'))].join('\n');
}
