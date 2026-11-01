import {createAnonymousReadClient,publicSettingsConfigured} from './public-overview.ts';

// Diagnostic only: a kickoff older than two hours is not evidence of a final score.
export const OVERDUE_KICKOFF_GRACE_MS=2*60*60*1000;
export type OverdueScheduledCount =
  | {state:'ready'; count:number}
  | {state:'not_configured'|'unavailable'; count:null};

export async function readOverdueScheduledCount(
  fetchImpl:typeof fetch=fetch,
  env:Record<string,string|undefined>=process.env,
  nowMs:number=Date.now()
):Promise<OverdueScheduledCount>{
  if(!env.NEXT_PUBLIC_SUPABASE_URL||!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return {state:'not_configured',count:null};
  if(!Number.isFinite(nowMs)||nowMs<=OVERDUE_KICKOFF_GRACE_MS)
    return {state:'unavailable',count:null};
  try{
    if(!publicSettingsConfigured(env))throw Error('Invalid public configuration');
    const cutoff=new Date(nowMs-OVERDUE_KICKOFF_GRACE_MS).toISOString();
    const client=createAnonymousReadClient(fetchImpl,env);
    const {count,error}=await client.from('ff_matches')
      .select('id',{count:'exact',head:true})
      .eq('status','scheduled')
      .lt('kickoff_at',cutoff);
    if(error||!Number.isSafeInteger(count)||count===null||count<0)
      throw Error('Invalid scheduled status count');
    return {state:'ready',count};
  }catch{
    return {state:'unavailable',count:null};
  }
}
