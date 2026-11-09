import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {PRODUCTION_ORIGINS,verifyProductionRelease} from '../scripts/check-production-release.mjs';

const NEW='f5cfb13c9c37eb27dcb448c9752cfbec0a665134';
const OLD='e9f48e9742be4f4c1c35caf61240b0cb2443d454';
const mockFetch=({aliases=Object.fromEntries(PRODUCTION_ORIGINS.map(s=>[s,NEW])),
    main=[NEW,NEW],omitSha=false,incorrectService=false}={})=>{
  let read=0;
  return async url=>{
    if(url==='https://api.github.com/repos/StanleyLl0yd/FootballForecast/commits/main')
      return Response.json({sha:main[Math.min(read++,main.length-1)]});
    const origin=new URL(url).origin;
    if(!(origin in aliases))return Response.json({message:'not found'},{status:404});
    const health={service:incorrectService?'unknown':'footballforecast'};
    if(!omitSha)health.releaseCommitSha=aliases[origin];
    return Response.json(health,{headers:{'cache-control':'no-store'}});
  };
};

test('all three aliases match the exact protected main',async()=>{
  const result=await verifyProductionRelease({fetchImpl:mockFetch(),githubToken:''});
  assert.equal(result.main,NEW);
  assert.equal(result.observations.length,3);
});

test('regression: a stale old-SHA READY deployment arriving after a newer build is rejected',async()=>{
  const aliases=Object.fromEntries(PRODUCTION_ORIGINS.map(s=>[s,OLD]));
  await assert.rejects(verifyProductionRelease({fetchImpl:mockFetch({aliases}),githubToken:''}),
    /PRODUCTION DRIFT/);
});

test('one secondary alias drifting is not masked by healthy primary',async()=>{
  const aliases=Object.fromEntries(PRODUCTION_ORIGINS.map(s=>[s,NEW]));
  aliases[PRODUCTION_ORIGINS[1]]=OLD;
  await assert.rejects(verifyProductionRelease({fetchImpl:mockFetch({aliases}),githubToken:''}),
    /PRODUCTION DRIFT.*footballforecast-stanleylloyd/);
});

test('pre-feature deployment or missing system env fails closed',async()=>{
  await assert.rejects(verifyProductionRelease({fetchImpl:mockFetch({omitSha:true}),githubToken:''}),
    /Missing or invalid releaseCommitSha/);
});

test('race with a new protected main is inconclusive, never a PASS',async()=>{
  await assert.rejects(verifyProductionRelease({fetchImpl:mockFetch({main:[OLD,NEW]}),githubToken:''}),
    /Protected main moved/);
});

test('unexpected service, bad HTTP and invalid alias input are rejected',async()=>{
  await assert.rejects(verifyProductionRelease({fetchImpl:mockFetch({incorrectService:true}),githubToken:''}),
    /Wrong production service/);
  await assert.rejects(verifyProductionRelease({fetchImpl:mockFetch({aliases:{}}),githubToken:''}),
    /HTTP 404/);
  await assert.rejects(verifyProductionRelease({fetchImpl:mockFetch(),origins:['https:\/\/example.com']}),
    /Invalid production alias list/);
});

test('partial or repeated alias sets must never yield an apparent three-domain PASS',async()=>{
  await assert.rejects(
    verifyProductionRelease({fetchImpl:mockFetch(),origins:[PRODUCTION_ORIGINS[0]]}),
    /Invalid production alias list/
  );
  await assert.rejects(
    verifyProductionRelease({fetchImpl:mockFetch(),origins:[
      PRODUCTION_ORIGINS[0],PRODUCTION_ORIGINS[0],PRODUCTION_ORIGINS[1]]}),
    /Invalid production alias list/
  );
  const reversed=[...PRODUCTION_ORIGINS].reverse();
  const result=await verifyProductionRelease({fetchImpl:mockFetch(),origins:reversed});
  assert.equal(result.observations.length,3);
});

test('read-only hourly workflow and server health release identity are source-controlled',()=>{
  const workflow=readFileSync('.github/workflows/production-release-integrity.yml','utf8');
  assert.match(workflow,/cron: '17 \* \* \* \*'/);
  assert.match(workflow,/contents: read/);
  assert.match(workflow,/node scripts\/check-production-release\.mjs/);
  assert.match(workflow,/issue_comment:\s*\n\s*types: \[created\]/);
  assert.match(workflow,/github\.repository == 'StanleyLl0yd\/FootballForecast'/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/github\.actor == 'StanleyLl0yd'/);
  assert.match(workflow,/github\.event\.issue\.number == 266/);
  assert.match(workflow,/!github\.event\.issue\.pull_request/);
  assert.match(workflow,/github\.event\.comment\.user\.id == 131160519/);
  assert.match(workflow,/github\.event\.comment\.author_association == 'OWNER'/);
  assert.match(workflow,/github\.event\.comment\.body == '\/release-integrity-check'/);
  assert.doesNotMatch(workflow,/VERCEL_TOKEN|issues: write|request_promote/);
  const route=readFileSync('apps/web/app/api/health/route.ts','utf8');
  assert.match(route,/VERCEL_GIT_COMMIT_SHA/);
  assert.match(route,/releaseCommitSha/);
  assert.match(route,/Cache-Control':'no-store'/);
});
