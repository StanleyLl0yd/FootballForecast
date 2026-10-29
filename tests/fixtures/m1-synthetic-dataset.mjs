import {createHash} from 'node:crypto';
import {SOURCE_URL,ATTRIBUTION_URL,SEASON_ROLES} from '../../scripts/m1-footbolno-normalize.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const SOURCE_SHA=hash('synthetic-source-bytes');
const RETRIEVED='2026-10-29T15:00:00Z';
export function fixture(){
  const seasonFiles={},quality={},snapshotSHA256={};
  for(const [season,role] of Object.entries(SEASON_ROLES)){
    const rows=[];
    for(let h=0;h<16;h++)for(let a=0;a<16;a++){
      if(h===a)continue;
      const historical=role!=='current';
      rows.push({
        source:'footbolno',sourceMatchId:'match-'+season.slice(2,4)+'-'+h+'-'+a,
        competition:'RPL',season,role,
        homeTeamId:'club-'+h,awayTeamId:'club-'+a,
        homeTeam:'Club '+h,awayTeam:'Club '+a,
        calendarDateUtc:historical?season.slice(0,4)+'-08-01':'2026-11-01',
        kickoffUtc:historical?season.slice(0,4)+'-08-01T12:00:00.000Z':null,
        kickoffTimeConfirmed:historical,
        status:historical?'finished':'scheduled',
        homeGoals:historical?2:null,awayGoals:historical?1:null,
        quarantineReason:null,publishedAtUtc:null,sourceFileSha256:SOURCE_SHA
      });
    }
    seasonFiles[season]=rows.map(x=>JSON.stringify(x)).join('\n')+'\n';
    snapshotSHA256[season]=hash(Buffer.from(seasonFiles[season]));
    quality[season]={role,ready:true,rows:240,teams:16,directedPairs:240,
      quarantined:0,finished:role==='current'?0:240};
  }
  return {
    manifest:{schemaVersion:1,kind:'M1_PRIVATE_RPL_DATASET',
      source:'Footbolno',sourceUrl:SOURCE_URL,license:'CC BY 4.0',
      licenseUrl:ATTRIBUTION_URL,sourceFileSha256:SOURCE_SHA,
      retrievedAtUtc:RETRIEVED,snapshotSHA256,quality,
      historicalPrematchPublicationVerified:false,
      strictHistoricalBacktestingAllowed:false,modelTrained:false,dbImported:false},
    seasonFiles
  };
}
