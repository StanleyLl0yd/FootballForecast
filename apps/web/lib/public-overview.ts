import {createClient} from '@supabase/supabase-js';
import type {Database} from './database.types';

// Only public SELECT operations. No cookies, user sessions or service-role keys.
export type Fixture = {id:string; kickoffAt:string; home:string; away:string; status:string};
export type PublicOverview =
  | {state:'not_configured'|'unavailable'; matches:null; forecasts:null; fixtures:Fixture[]}
  | {state:'ready'; matches:number; forecasts:number; fixtures:Fixture[]};

// A valid-looking public endpoint is not proof of network/database health.
export function publicSettingsConfigured(env:Record<string,string|undefined> = process.env):boolean {
  const url=env.NEXT_PUBLIC_SUPABASE_URL, key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;
  try {
    const endpoint=new URL(url);
    return endpoint.protocol==='https:' && !endpoint.username && !endpoint.password &&
      !endpoint.search && !endpoint.hash;
  } catch {return false;}
}

export function publicTeamName(value:unknown):string|null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const name=(value as {name?:unknown}).name;
  return typeof name === 'string' && name.trim().length>0 ? name : null;
}

// Shared read-only client for public server components only, never service_role.
export function createAnonymousReadClient(
  fetchImpl:typeof fetch = fetch,
  env:Record<string,string|undefined> = process.env
) {
  if (!publicSettingsConfigured(env)) throw new Error('Invalid Supabase project URL');
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL!,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(input,init)=>fetchImpl(input,{...init,cache:'no-store',
      signal:AbortSignal.timeout(6000)})}
  });
}

// fetchImpl injection keeps live HTTP contract testable without contacting a vendor.
// NEXT_PUBLIC values are publishable by design, not a service secret.
export async function readPublicOverview(
  fetchImpl:typeof fetch = fetch,
  env:Record<string,string|undefined> = process.env
):Promise<PublicOverview> {
  const url=env.NEXT_PUBLIC_SUPABASE_URL;
  const key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return {state:'not_configured',matches:null,forecasts:null,fixtures:[]};
  try {
    const client=createAnonymousReadClient(fetchImpl,env);
    const cutoffMs=Date.now(),cutoff=new Date(cutoffMs).toISOString();
    const [matchCount,forecastCount,upcoming]=await Promise.all([
      client.from('ff_matches').select('id',{count:'exact',head:true}),
      client.from('ff_forecasts').select('id',{count:'exact',head:true}),
      client.from('ff_matches')
        .select('id,kickoff_at,status,home:ff_teams!ff_matches_home_id_fkey(name),away:ff_teams!ff_matches_away_id_fkey(name)')
        .gte('kickoff_at',cutoff)
        .eq('status','scheduled')
        .order('kickoff_at',{ascending:true}).limit(8)
    ]);
    if (matchCount.error || forecastCount.error || upcoming.error ||
        matchCount.count === null || forecastCount.count === null ||
        !Array.isArray(upcoming.data)) throw new Error('Public REST read failed');
    const fixtures:Fixture[]=[];
    for (const row of upcoming.data) {
      const home=publicTeamName(row.home),away=publicTeamName(row.away);
      if (home && away && typeof row.id==='string' &&
          typeof row.kickoff_at==='string' && row.status==='scheduled' &&
          Date.parse(row.kickoff_at)>=cutoffMs) {
        fixtures.push({id:row.id,kickoffAt:row.kickoff_at,home,away,status:row.status});
      }
    }
    return {state:'ready',matches:matchCount.count,forecasts:forecastCount.count,fixtures};
  } catch {
    // Never show a failure as a real count of zero; never leak provider errors.
    return {state:'unavailable',matches:null,forecasts:null,fixtures:[]};
  }
}
