// Read-only production-alias integrity check. It never deploys, promotes,
// reads private data, or changes a Vercel/GitHub resource.
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const PRODUCTION_ORIGINS=Object.freeze([
  'https://footballforecast.vercel.app',
  'https://footballforecast-stanleylloyd-4725.vercel.app',
  'https://footballforecast-git-main-stanleylloyd-4725.vercel.app'
]);
const GITHUB_MAIN='https://api.github.com/repos/StanleyLl0yd/FootballForecast/commits/main';
const SHA40=/^[0-9a-f]{40}$/;

export async function verifyProductionRelease({fetchImpl=fetch,githubToken=process.env.GITHUB_TOKEN,
  origins=PRODUCTION_ORIGINS}={}) {
  if (!Array.isArray(origins)||origins.length!==PRODUCTION_ORIGINS.length ||
      origins.some(x=>!PRODUCTION_ORIGINS.includes(x)) ||
      new Set(origins).size!==PRODUCTION_ORIGINS.length)throw new Error('Invalid production alias list');
  const githubHeaders={accept:'application/vnd.github+json',
    'x-github-api-version':'2022-11-28',
    'user-agent':'FootballForecast-Release-Integrity/1'};
  if (githubToken)githubHeaders.authorization=`Bearer ${githubToken}`;
  const readMain=async()=>{
    const response=await fetchImpl(GITHUB_MAIN,{headers:githubHeaders,redirect:'error',
      signal:AbortSignal.timeout(12000)});
    if (!response.ok)throw new Error(`GitHub main lookup HTTP ${response.status}`);
    const data=await response.json();
    if(!SHA40.test(data?.sha??''))throw new Error('GitHub main SHA missing or malformed');
    return data.sha;
  };
  const mainBefore=await readMain();
  const observations=[];
  for(const origin of origins){
    const response=await fetchImpl(`${origin}/api/health`,{redirect:'error',cache:'no-store',
      signal:AbortSignal.timeout(12000),headers:{'cache-control':'no-store',
        'user-agent':'FootballForecast-Release-Integrity/1'}});
    if(response.status!==200)throw new Error(`Production health HTTP ${response.status} at ${origin}`);
    if(!/application\/json/i.test(response.headers.get('content-type')??''))
      throw new Error(`Production health is not JSON at ${origin}`);
    const health=await response.json();
    if(health?.service!=='footballforecast')throw new Error(`Wrong production service at ${origin}`);
    if(!SHA40.test(health?.releaseCommitSha??''))
      throw new Error(`Missing or invalid releaseCommitSha at ${origin}; fail-closed (older build or missing Vercel system env)`);
    observations.push({origin,sha:health.releaseCommitSha});
  }
  const mainAfter=await readMain();
  if(mainAfter!==mainBefore)throw new Error('Protected main moved during production observation; rerun check');
  for(const {origin,sha} of observations){
    if(sha!==mainAfter)throw new Error(`PRODUCTION DRIFT at ${origin}: main=${mainAfter}, deployed=${sha}`);
  }
  return {main:mainAfter,observations};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  verifyProductionRelease().then(({main,observations})=>{
    console.log(`PASS: production is exact protected main ${main} at ${observations.length} aliases`);
  }).catch(error=>{
    console.error('FAIL: production release integrity:',error.message);
    process.exitCode=1;
  });
}
