import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, writeSettings } from './store.js';
import { seedStore } from './seed.js';
import { Simulator } from './simulator.js';

const temp=mkdtempSync(join(tmpdir(),'cygnet-image-check-'));
const db=openStore(':memory:');
const due=new Date(Date.now()-60_000).toISOString();
let target='u0002',nextKind='dm',generated=0,applied=[],typingObserved=false,plannerKind='wait';
const runner={
  runOrchestrator:async()=>({response:JSON.stringify({assignments:[{personaId:'u0001',kind:plannerKind,targetId:target}]})}),
  runPersona:async()=>{if(nextKind==='dm')typingObserved=Date.parse(db.prepare("SELECT typing_until FROM accounts WHERE id='u0001'").get().typing_until)>Date.now();return {response:JSON.stringify(nextKind==='evade_block'
    ?{profile:{name:'Alternate Test Person',username:'alternate.test.person',bio:'A new local identity.'},content:'Hi.'}
    :['post','story'].includes(nextKind)
      ?{caption:`Live ${nextKind} from the persona.`,imagePrompt:`A unique live ${nextKind} image.`}
      :{content:'Here is the photo you asked for.',imagePrompt:'A candid photo of the sender making coffee at home.'})};},
  generatePostImage:async({outputName})=>{generated++;const path=join(temp,outputName);writeFileSync(path,`unique image ${generated}`);return {path};},
};
try {
  seedStore(db,{dataRoot:temp});
  db.prepare('UPDATE accounts SET post_due_at=NULL,story_due_at=NULL,dm_due_at=NULL,engagement_due_at=NULL,retry_at=NULL WHERE is_human=0').run();
  db.prepare("UPDATE accounts SET dm_due_at=?,human_reply_due_at=?,human_chat_until=?,activity_json=? WHERE id='u0001'").run(due,due,new Date(Date.now()+60_000).toISOString(),JSON.stringify({dmInitiation:'frequent'}));
  const simulator=new Simulator({db,applyAction:(action)=>{applied.push(action);return {ok:true};},mediaDir:temp,dataDir:temp,runner,now:()=>Date.now()});
  assert.equal((await simulator.tick()).processed,1);
  assert.ok(typingObserved,'a persona displays typing while composing a human DM');
  assert.equal(db.prepare("SELECT typing_until FROM accounts WHERE id='u0001'").get().typing_until,null,'typing clears after the message is sent');
  assert.equal(db.prepare("SELECT human_reply_due_at FROM accounts WHERE id='u0001'").get().human_reply_due_at,null,'a reply clears its dedicated human-reply opportunity');
  assert.equal(applied[0].type,'message.send');
  assert.equal(applied[0].payload.recipientId,'human');
  assert.match(applied[0].payload.mediaFilename,/\.png$/);
  assert.match(applied[0].payload.imageSha256,/^[a-f0-9]{64}$/);
  assert.equal(applied[0].payload.imagePrompt,'A candid photo of the sender making coffee at home.');
  db.prepare("UPDATE accounts SET dm_due_at=?,human_reply_due_at=?,human_chat_until=? WHERE id='u0001'").run(due,due,new Date(Date.now()-1).toISOString());
  await simulator.tick();
  assert.equal(applied.length,1,'an expired chat window lets the persona choose to wait');
  assert.equal(db.prepare("SELECT human_reply_due_at FROM accounts WHERE id='u0001'").get().human_reply_due_at,null);
  plannerKind='dm';
  target='u0002';
  db.prepare("UPDATE accounts SET dm_due_at=? WHERE id='u0001'").run(new Date().toISOString());
  assert.equal((await simulator.tick()).processed,1);
  assert.equal(applied[1].payload.recipientId,'u0002');
  nextKind='evade_block';
  plannerKind=nextKind;
  target='human';
  writeSettings(db,{harassmentMode:true});
  db.prepare("INSERT INTO edges(source_id,target_id,kind,created_at) VALUES('human','u0001','block',?)").run(due);
  db.prepare("UPDATE accounts SET dm_due_at=NULL,evade_due_at=? WHERE id='u0001'").run(new Date().toISOString());
  assert.equal((await simulator.tick()).processed,1);
  assert.equal(applied[2].type,'persona.alias.message');
  assert.match(applied[2].payload.avatarFilename,/\.png$/);
  nextKind='post';
  plannerKind=nextKind;
  db.prepare("UPDATE accounts SET evade_due_at=NULL,post_due_at=?,dm_due_at=NULL WHERE id='u0001'").run(new Date().toISOString());
  assert.equal((await simulator.tick()).processed,1);
  assert.equal(applied[3].type,'post.create');
  assert.equal(applied[3].payload.caption,'Live post from the persona.');
  assert.match(applied[3].payload.mediaFilename,/\.png$/);
  nextKind='story';
  plannerKind=nextKind;
  db.prepare("UPDATE accounts SET post_due_at=NULL,story_due_at=? WHERE id='u0001'").run(new Date().toISOString());
  assert.equal((await simulator.tick()).processed,1);
  assert.equal(applied[4].type,'story.create');
  assert.equal(applied[4].payload.caption,'Live story from the persona.');
  assert.match(applied[4].payload.mediaFilename,/\.png$/);
  const conversationId='read-only-conversation';
  db.prepare('INSERT INTO conversations VALUES(?,?)').run(conversationId,due);
  db.prepare('INSERT INTO conversation_members VALUES(?,?)').run(conversationId,'human');
  db.prepare('INSERT INTO conversation_members VALUES(?,?)').run(conversationId,'u0001');
  db.prepare('INSERT INTO messages(id,conversation_id,sender_id,content,created_at) VALUES(?,?,?,?,?)').run('unread-message',conversationId,'human','A message that may be read without a reply.',due);
  nextKind='read';
  plannerKind=nextKind;
  db.prepare("UPDATE accounts SET story_due_at=NULL,read_due_at=?,post_due_at=NULL,dm_due_at=NULL WHERE id='u0001'").run(new Date().toISOString());
  assert.equal((await simulator.tick()).processed,1);
  assert.equal(applied[5].type,'message.read','a standalone read decision must not send a DM');
  assert.equal(applied[5].payload.conversationId,conversationId);
  assert.equal(db.prepare("SELECT read_due_at FROM accounts WHERE id='u0001'").get().read_due_at,null);
  assert.equal(generated,5);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM posts').get().n,0,'seed and mocked action path never store canned content');
  console.log('Realtime image generation self-check passed for live persona posts/stories and DMs; standalone persona read receipts do not require a reply.');
} finally {
  db.close();
  rmSync(temp,{recursive:true,force:true});
}
