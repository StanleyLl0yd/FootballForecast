// Synthetic-only SQL integration fixture. It must never read production CSV or keys.
import {fixture} from './fixtures/m1-synthetic-dataset.mjs';
import {validateStageDataset,buildStageSql} from '../scripts/m1-stage-import.mjs';

const data=fixture();
process.stdout.write(buildStageSql(validateStageDataset(data.manifest,data.seasonFiles)));
