import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from './store.js';
import { seedStore } from './seed.js';
import { Simulator } from './simulator.js';

const temp=mkdtempSync(join(tmpdir(),'cygnet-retry-check-'));
const db=openStore(':memory:');
const now=Date.now(), due=new Date(now).toISOString();
let attempts=0, orchestratorPrompt='';
const runner={runOrchestrator:async({instructions})=>{
  orchestratorPrompt=instructions;
  if(attempts++===0) throw new Error('synthetic orchestration failure');
  return {response:JSON.stringify({assignments:[{personaId:'u0001',kind:'wait'}]})};
}};
try {
  seedStore(db,{dataRoot:temp});
  db.prepare('UPDATE accounts SET post_due_at=NULL,story_due_at=NULL,dm_due_at=NULL,engagement_due_at=NULL,retry_at=NULL WHERE is_human=0').run();
  db.prepare('UPDATE accounts SET engagement_due_at=? WHERE id=?').run(due,'u0001');
  const simulator=new Simulator({db,applyAction:()=>({}),mediaDir:temp,dataDir:temp,runner,now:()=>now});
  const failed=await simulator.tick();
  const row=db.prepare('SELECT retry_count,retry_at,retry_error FROM accounts WHERE id=?').get('u0001');
  assert.equal(failed.error,'synthetic orchestration failure');
  assert.equal(row.retry_count,1);
  assert.equal(row.retry_error,'synthetic orchestration failure');
  assert.ok(Date.parse(row.retry_at)-Date.now()>899_000);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events WHERE type='simulator.tick.failed'").get().n,1);
  db.prepare('UPDATE accounts SET retry_at=? WHERE id=?').run(due,'u0001');
  const recovered=await simulator.tick();
  const recoveredRow=db.prepare('SELECT retry_count,retry_at,retry_error FROM accounts WHERE id=?').get('u0001');
  assert.equal(recovered.error,undefined);
  assert.equal(simulator.status.lastError,null);
  assert.equal(recoveredRow.retry_count,0);
  assert.equal(recoveredRow.retry_at,null);
  assert.equal(recoveredRow.retry_error,null);
  assert.match(orchestratorPrompt,/Recent posts:\n\[\]/);
  const personas=JSON.parse(orchestratorPrompt.split('Personas:\n')[1].split('\n\nRecent posts:')[0]);
  assert.ok(personas.every(({allowedActions})=>!allowedActions.some((kind)=>['like','comment'].includes(kind))));
  console.log('Simulator retry recovery self-check passed.');
} finally {
  db.close();
  rmSync(temp,{recursive:true,force:true});
}
