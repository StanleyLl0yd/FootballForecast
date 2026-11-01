// Synthetic-only exact-equivalence / true historical-drift fixture for PG17 CI.
import {createHash} from 'node:crypto';
import {fixture} from './fixtures/m1-synthetic-dataset.mjs';
import {validateStageDataset,buildStageSql} from '../scripts/m1-stage-import.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex');
const variant=process.argv[2];
if(!['equivalent','changed'].includes(variant))throw Error('Unknown synthetic fixture mode');
const data=fixture();
const rawSha=sha('synthetic-source-bytes-'+(variant==='equivalent'?'v2':'v3'));
data.manifest.sourceFileSha256=rawSha;
data.manifest.retrievedAtUtc=variant==='equivalent'?'2026-10-29T15:30:00Z':'2026-10-29T16:00:00Z';
for(const season of Object.keys(data.seasonFiles)){
  const rows=data.seasonFiles[season].trimEnd().split('\n').map(line=>JSON.parse(line));
  for(const row of rows)row.sourceFileSha256=rawSha;
  if(variant==='changed'&&season==='2024/2025')rows[0].homeGoals=3;
  data.seasonFiles[season]=rows.map(row=>JSON.stringify(row)).join('\n')+'\n';
  data.manifest.snapshotSHA256[season]=sha(Buffer.from(data.seasonFiles[season]));
}
process.stdout.write(buildStageSql(validateStageDataset(data.manifest,data.seasonFiles)));
