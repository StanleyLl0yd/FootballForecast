// Browser-only, user-initiated M0 network probes. No telemetry or writes.
export type ConnectivityResult={
  id:'health'|'dashboard'|'supabase';
  label:string;
  state:'passed'|'failed'|'not_configured';
  httpStatus:number|null;
  elapsedMs:number|null;
};

// M0 checks one explicitly provisioned, public Free project, never a caller-supplied URL.
// Public Supabase project references and publishable keys are not secrets.
const projectOrigin='https://upulkesaiwnwfagjgteh.supabase.co';
const readOnlyMatchesUrl='https://upulkesaiwnwfagjgteh.supabase.co/rest/v1/ff_matches?select=id&limit=1';
export function validPublishableEndpoint(url:string|undefined,key:string|undefined):boolean {
  return url===projectOrigin&&typeof key==='string'&&key.startsWith('sb_publishable_');
}

export async function runConnectivityChecks(
  supabaseUrl:string|undefined,
  publishableKey:string|undefined,
  fetchImpl:typeof fetch=fetch
):Promise<ConnectivityResult[]> {

  async function probe(id:ConnectivityResult['id'],label:string,url:string,
    headers:Record<string,string>={},validate?:(response:Response)=>Promise<boolean>):Promise<ConnectivityResult>{
    const started=Date.now();
    try{
      const response=await fetchImpl(url,{method:'GET',cache:'no-store',redirect:'error',
        signal:AbortSignal.timeout(10000),headers});
      const valid=response.ok&&(!validate||await validate(response));
      return {id,label,state:valid?'passed':'failed',httpStatus:response.status,
        elapsedMs:Date.now()-started};
    }catch{
      // Never serialize provider errors, paths, user agent, network details or API keys.
      return {id,label,state:'failed',httpStatus:null,elapsedMs:Date.now()-started};
    }
  }
  const checks=[
    probe('health','Vercel: проверка API','/api/health',{},async response=>{
      const json=await response.json();
      return json?.service==='footballforecast'&&json?.status==='public_configured';
    }),
    probe('dashboard','Vercel: публичная страница','/dashboard',{},async response=>{
      const html=await response.text();
      return html.includes('Футбольная аналитика')&&html.includes('Публичная база подключена');
    })
  ];
  if(validPublishableEndpoint(supabaseUrl,publishableKey)){
    const endpoint=readOnlyMatchesUrl;
    checks.push(probe('supabase','Supabase: прямое чтение',endpoint,
      {apikey:publishableKey!,Accept:'application/json'},async response=>{
        if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))return false;
        return Array.isArray(await response.json());
      }));
  }else{
    checks.push(Promise.resolve({id:'supabase',label:'Supabase: прямое чтение',
      state:'not_configured',httpStatus:null,elapsedMs:null} as ConnectivityResult));
  }
  return Promise.all(checks);
}

export function formatConnectivityReport(items:ConnectivityResult[],time:string):string{
  const labels={passed:'PASS',failed:'FAIL',not_configured:'NOT_CONFIGURED'};
  return ['FootballForecast M0 connectivity self-check',time,
    'These observations apply only to the browser/network used for the test.',
    ...items.map(x=>x.label+': '+labels[x.state]+
      (x.httpStatus===null?'':' HTTP '+x.httpStatus)+
      (x.elapsedMs===null?'':' '+x.elapsedMs+'ms'))].join('\n');
}
