import {createAnonymousReadClient,publicTeamName} from './public-overview.ts';

// Bounded, anonymous and strictly read-only. No guessed scores or kickoff times.
export type RecentResult = {
  id:string; kickoffAt:string; home:string; away:string;
  homeGoals:number; awayGoals:number;
};
export type RecentResults =
  | {state:'not_configured'|'unavailable'; results:RecentResult[]}
  | {state:'ready'; results:RecentResult[]};

export async function readRecentResults(
  fetchImpl:typeof fetch = fetch,
  env:Record<string,string|undefined> = process.env,
  nowMs:number = Date.now()
):Promise<RecentResults> {
  if(!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return {state:'not_configured',results:[]};
  if(!Number.isFinite(nowMs) || nowMs<=0)
    return {state:'unavailable',results:[]};
  try {
    const client=createAnonymousReadClient(fetchImpl,env);
    const {data,error}=await client.from('ff_matches')
      .select('id,kickoff_at,status,home_goals,away_goals,home:ff_teams!ff_matches_home_id_fkey(name),away:ff_teams!ff_matches_away_id_fkey(name)')
      .eq('status','finished')
      .lte('kickoff_at',new Date(nowMs).toISOString())
      .order('kickoff_at',{ascending:false}).limit(12);
    if(error || !Array.isArray(data))throw Error('Invalid public result response');
    const results:RecentResult[]=[];
    for(const row of data){
      const home=publicTeamName(row.home),away=publicTeamName(row.away);
      const kickoff=typeof row.kickoff_at==='string'?Date.parse(row.kickoff_at):NaN;
      if(typeof row.id!=='string' || !row.id ||
        row.status!=='finished' || !home || !away ||
        !Number.isFinite(kickoff) || kickoff>nowMs ||
        !Number.isInteger(row.home_goals) || !Number.isInteger(row.away_goals) ||
        row.home_goals===null || row.away_goals===null ||
        row.home_goals<0 || row.away_goals<0 ||
        row.home_goals>20 || row.away_goals>20)continue;
      results.push({id:row.id,kickoffAt:row.kickoff_at,home,away,
        homeGoals:row.home_goals,awayGoals:row.away_goals});
    }
    return {state:'ready',results};
  } catch {
    return {state:'unavailable',results:[]};
  }
}
