import {createAnonymousReadClient,publicSettingsConfigured,publicTeamName} from './public-overview.ts';
import {explicitTimestamp} from './temporal.ts';

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

export type OverdueScheduledFixture = {
  id:string; kickoffAt:string; home:string; away:string;
};
export type OverdueScheduledFixtures =
  | {state:'ready'; fixtures:OverdueScheduledFixture[]}
  | {state:'not_configured'|'unavailable'; fixtures:[]};

// Public diagnostic: these matches have NOT been independently verified as final.
export async function readOverdueScheduledFixtures(
  fetchImpl:typeof fetch=fetch,
  env:Record<string,string|undefined>=process.env,
  nowMs:number=Date.now()
):Promise<OverdueScheduledFixtures>{
  if(!env.NEXT_PUBLIC_SUPABASE_URL||!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return {state:'not_configured',fixtures:[]};
  if(!Number.isFinite(nowMs)||nowMs<=OVERDUE_KICKOFF_GRACE_MS)
    return {state:'unavailable',fixtures:[]};
  try{
    if(!publicSettingsConfigured(env))throw Error('Invalid public configuration');
    const cutoffMs=nowMs-OVERDUE_KICKOFF_GRACE_MS;
    const client=createAnonymousReadClient(fetchImpl,env);
    const {data,error}=await client.from('ff_matches')
      .select('id,kickoff_at,status,home:ff_teams!ff_matches_home_id_fkey(name),away:ff_teams!ff_matches_away_id_fkey(name)')
      .eq('status','scheduled')
      .lt('kickoff_at',new Date(cutoffMs).toISOString())
      .order('kickoff_at',{ascending:false}).limit(8);
    if(error||!Array.isArray(data))throw Error('Invalid overdue public response');
    const fixtures:OverdueScheduledFixture[]=[];
    const ids=new Set<string>();
    for(const row of data){
      const home=publicTeamName(row.home),away=publicTeamName(row.away);
      if(typeof row.id!=='string'||!row.id||ids.has(row.id)||
        row.status!=='scheduled'||!home||!away||
        !explicitTimestamp(row.kickoff_at)||
        Date.parse(row.kickoff_at)>=cutoffMs)
        throw Error('Inconsistent overdue fixture');
      ids.add(row.id);
      fixtures.push({id:row.id,kickoffAt:row.kickoff_at,home,away});
    }
    return {state:'ready',fixtures};
  }catch{
    return {state:'unavailable',fixtures:[]};
  }
}
