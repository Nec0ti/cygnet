import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from './store.js';
import { seedStore } from './seed.js';
import { existingMedia } from './media.js';
import { connectFriends } from './friend-hook.js';

const temp=mkdtempSync(join(tmpdir(),'cygnet-check-'));
const db=openStore(':memory:');
try {
  const result=seedStore(db,{dataRoot:temp});
  assert.deepEqual(result,{seeded:true,accounts:101});
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE is_human=0 AND country='United States'").get().n,60);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE is_human=0 AND age BETWEEN 16 AND 30').get().n,100);
  const personas=db.prepare('SELECT id,name,age,country,pronouns,tone,traits_json,system_md FROM accounts WHERE is_human=0').all();
  assert.ok(personas.some((profile)=>profile.age<18));
  for(const profile of personas) {
    assert.ok(profile.system_md.includes(`- Name: ${profile.name}`));
    assert.ok(profile.system_md.includes(`- Age: ${profile.age}`));
    assert.ok(profile.system_md.includes(`- Country: ${profile.country}`));
    assert.ok(profile.system_md.includes(`- Pronouns: ${profile.pronouns}`));
    assert.ok(profile.system_md.includes(profile.tone));
    for(const trait of Object.keys(JSON.parse(profile.traits_json))) assert.ok(profile.system_md.includes(`- ${trait}:`));
    if(profile.age<18) assert.match(profile.system_md,/under 18[\s\S]*do not engage in sexual or erotic conversation/i);
  }
  const persona=db.prepare("SELECT id,system_md FROM accounts WHERE is_human=0 LIMIT 1").get();
  assert.match(persona.system_md,/## Friends\n- \[\[/);
  assert.equal(readFileSync(join(temp,'personas',persona.id,'system.md'),'utf8'),persona.system_md);
  const friend=db.prepare("SELECT id FROM accounts WHERE is_human=0 AND id!=? LIMIT 1").get(persona.id).id;
  assert.equal(connectFriends(db,persona.id,friend,new Date().toISOString()),true);
  assert.equal(connectFriends(db,persona.id,friend,new Date().toISOString()),false);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM edges WHERE kind='friend' AND ((source_id=? AND target_id=?) OR (source_id=? AND target_id=?))").get(persona.id,friend,friend,persona.id).n,2);
  writeFileSync(join(temp,'generated.png'),'not-an-image-but-a-file');
  assert.equal(existingMedia('generated.png',temp),'generated.png');
  assert.throws(()=>existingMedia('../generated.png',temp),/Generated media file not found/);
  const seededAgain=seedStore(db,{dataRoot:temp});
  assert.equal(seededAgain.seeded,false);
  console.log('Cygnet seed self-check passed.');
} finally {
  db.close();
  rmSync(temp,{recursive:true,force:true});
}
