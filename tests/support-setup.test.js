import {test} from 'node:test';
import {sqlite} from '../scripts/local-db.mjs';
import {supportSetupScenario} from './support-setup-scenario.js';
test('official support setup, daily refresh, manual priority and failure preservation',async()=>{
  const db=await sqlite(':memory:');
  try{await supportSetupScenario(db);}finally{db.close();}
});
