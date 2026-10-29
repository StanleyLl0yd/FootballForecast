import {createAnonymousReadClient, publicSettingsConfigured, publicTeamName} from './public-overview.ts';

export type PublishedForecast = {
  id:string; revision:number; predictedAt:string; asOfAt:string;
  modelVersion:string; predictionHash:string; kickoffAt:string;
  home:string; away:string; homeWin:number; draw:number; awayWin:number;
};

export type ArchiveSnapshot =
  | {state:'not_configured'|'unavailable'; forecasts:[]}
  | {state:'ready'; forecasts:PublishedForecast[]};

// PostgreSQL timestamptz must be explicit and unambiguous. Date.parse alone
// also accepts date-only, local-time and loosely formatted strings, which can
// silently corrupt pre-kickoff time-cutoff comparisons across timezones.
function explicitTimestamp(value:unknown):value is string {
  if(typeof value!=='string')return false;
  const m=/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)$/.exec(value);
  if(!m||!Number.isFinite(Date.parse(value)))return false;
  const day=new Date(0);
  day.setUTCFullYear(Number(m[1]),Number(m[2])-1,Number(m[3]));
  return day.getUTCFullYear()===Number(m[1])&&
    day.getUTCMonth()===Number(m[2])-1&&day.getUTCDate()===Number(m[3]);
}

function normalized(row:unknown):PublishedForecast|null {
  if(!row || typeof row!=='object' || Array.isArray(row)) return null;
  const r=row as Record<string,unknown>;
  if(!r.match || typeof r.match!=='object' || Array.isArray(r.match)) return null;
  const match=r.match as Record<string,unknown>;
  const home=publicTeamName(match.home),away=publicTeamName(match.away);
  if(typeof r.id!=='string' || !home || !away ||
    typeof r.revision!=='number' || !Number.isSafeInteger(r.revision) || r.revision<1 ||
    typeof r.model_version!=='string' || !r.model_version.trim() ||
    typeof r.prediction_sha256!=='string' || !/^[a-f0-9]{64}$/.test(r.prediction_sha256) ||
    !explicitTimestamp(r.predicted_at) ||
    !explicitTimestamp(r.as_of_at) ||
    !explicitTimestamp(match.kickoff_at)) return null;
  const [p1,px,p2]=[r.home_win,r.draw,r.away_win];
  if([p1,px,p2].some(p=>typeof p!=='number'||!Number.isFinite(p)||p<0||p>1) ||
    Math.abs((p1 as number)+(px as number)+(p2 as number)-1)>1e-8 ||
    Date.parse(r.as_of_at)>Date.parse(r.predicted_at) ||
    Date.parse(r.predicted_at)>=Date.parse(match.kickoff_at)) return null;
  return {
    id:r.id, revision:r.revision, predictedAt:r.predicted_at, asOfAt:r.as_of_at,
    modelVersion:r.model_version, predictionHash:r.prediction_sha256,
    kickoffAt:match.kickoff_at,home,away,
    homeWin:p1 as number,draw:px as number,awayWin:p2 as number
  };
}

// No writes, user sessions, source-record joins or unbounded list queries.
export async function readPublicArchive(
  fetchImpl:typeof fetch=fetch,
  env:Record<string,string|undefined>=process.env
):Promise<ArchiveSnapshot> {
  if(!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return {state:'not_configured',forecasts:[]};
  if(!publicSettingsConfigured(env)) return {state:'unavailable',forecasts:[]};
  try {
    const client=createAnonymousReadClient(fetchImpl,env);
    const {data,error}=await client.from('ff_forecasts')
      .select('id,revision,predicted_at,as_of_at,model_version,prediction_sha256,home_win,draw,away_win,match:ff_matches!ff_forecasts_match_id_fkey(kickoff_at,home:ff_teams!ff_matches_home_id_fkey(name),away:ff_teams!ff_matches_away_id_fkey(name))')
      .order('predicted_at',{ascending:false})
      .limit(20);
    if(error || !Array.isArray(data)) throw new Error('Archive REST query failed');
    const entries=data.map(normalized);
    if(entries.some(x=>x===null)) throw new Error('Invalid archive data shape');
    return {state:'ready',forecasts:entries as PublishedForecast[]};
  } catch {
    return {state:'unavailable',forecasts:[]};
  }
}
