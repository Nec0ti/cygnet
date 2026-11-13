import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, writeSettings } from './store.js';
import { seedStore } from './seed.js';
import { Simulator } from './simulator.js';

const temp=mkdtempSync(join(tmpdir(),'cygnet-image-check-'));
const db=openStore(':memory:');
const due=new Date().toISOString();
let target='human',nextKind='dm',generated=0,applied=[];
const runner={
  runOrchestrator:async()=>({response:JSON.stringify({assignments:[{personaId:'u0001',kind:nextKind,targetId:target}]})}),
  runPersona:async()=>({response:JSON.stringify(nextKind==='evade_block'
    ?{profile:{name:'Alternate Test Person',username:'alternate.test.person',bio:'A new local identity.'},content:'Hi.'}
    :{content:'Here is the photo you asked for.',imagePrompt:'A candid photo of the sender making coffee at home.'})}),
  generatePostImage:async({outputName})=>{generated++;const path=join(temp,outputName);writeFileSync(path,`unique image ${generated}`);return {path};},
};
try {
  seedStore(db,{dataRoot:temp});
  db.prepare('UPDATE accounts SET post_due_at=NULL,story_due_at=NULL,dm_due_at=NULL,engagement_due_at=NULL,retry_at=NULL WHERE is_human=0').run();
  db.prepare("UPDATE accounts SET dm_due_at=?,activity_json=? WHERE id='u0001'").run(due,JSON.stringify({dmInitiation:'frequent'}));
  const simulator=new Simulator({db,applyAction:(action)=>{applied.push(action);return {ok:true};},mediaDir:temp,dataDir:temp,runner,now:()=>Date.now()});
  assert.equal((await simulator.tick()).processed,1);
  assert.equal(applied[0].type,'message.send');
  assert.equal(applied[0].payload.recipientId,'human');
  assert.match(applied[0].payload.mediaFilename,/\.png$/);
  assert.match(applied[0].payload.imageSha256,/^[a-f0-9]{64}$/);
  assert.equal(applied[0].payload.imagePrompt,'A candid photo of the sender making coffee at home.');
  target='u0002';
  db.prepare("UPDATE accounts SET dm_due_at=? WHERE id='u0001'").run(new Date().toISOString());
  assert.equal((await simulator.tick()).processed,1);
  assert.equal(applied[1].payload.recipientId,'u0002');
  nextKind='evade_block';
  target='human';
  writeSettings(db,{harassmentMode:true});
  db.prepare("INSERT INTO edges(source_id,target_id,kind,created_at) VALUES('human','u0001','block',?)").run(due);
  db.prepare("UPDATE accounts SET dm_due_at=NULL,evade_due_at=? WHERE id='u0001'").run(new Date().toISOString());
  assert.equal((await simulator.tick()).processed,1);
  assert.equal(applied[2].type,'persona.alias.message');
  assert.match(applied[2].payload.avatarFilename,/\.png$/);
  assert.equal(generated,3);
  console.log('Realtime image generation self-check passed for both DM directions and a later-created profile.');
} finally {
  db.close();
  rmSync(temp,{recursive:true,force:true});
}
