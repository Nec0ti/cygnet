import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from './store.js';
import { seedStore } from './seed.js';
import { visibleStoriesFor } from './visibility.js';

const temp=mkdtempSync(join(tmpdir(),'cygnet-visibility-check-'));
const db=openStore(':memory:');
try {
  seedStore(db,{dataRoot:temp});
  const now=new Date().toISOString(),expired='2000-01-01T00:00:00.000Z';
  const insert=db.prepare('INSERT INTO posts(id,account_id,caption,kind,created_at,expires_at) VALUES(?,?,?,\'story\',?,?)');
  insert.run('own-story','human','own',now,new Date(Date.now()+60_000).toISOString());
  insert.run('followed-story','u0001','followed',now,new Date(Date.now()+60_000).toISOString());
  insert.run('unfollowed-story','u0002','unfollowed',now,new Date(Date.now()+60_000).toISOString());
  insert.run('expired-story','u0001','expired',now,expired);
  const edge=db.prepare('INSERT INTO edges(source_id,target_id,kind,created_at) VALUES(?,?,?,?)');
  edge.run('human','u0001','follow',now);
  let visible=visibleStoriesFor(db,'human',now).map((story)=>story.id);
  assert.ok(visible.includes('own-story'));
  assert.ok(visible.includes('followed-story'));
  assert.ok(!visible.includes('unfollowed-story'));
  assert.ok(!visible.includes('expired-story'));
  edge.run('u0001','human','block',now);
  visible=visibleStoriesFor(db,'human',now).map((story)=>story.id);
  assert.ok(!visible.includes('followed-story'));
  console.log('Story visibility self-check passed for follow, block, ownership, and expiry.');
} finally {
  db.close();
  rmSync(temp,{recursive:true,force:true});
}
