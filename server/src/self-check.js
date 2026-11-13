import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from './store.js';
import { seedStore } from './seed.js';

const temp=mkdtempSync(join(tmpdir(),'cygnet-check-'));
const db=openStore(':memory:');
try {
  const result=seedStore(db,{dataRoot:temp});
  assert.deepEqual(result,{seeded:true,accounts:101});
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE is_human=0 AND country='United States'").get().n,60);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE is_human=0 AND age BETWEEN 16 AND 30').get().n,100);
  const persona=db.prepare("SELECT id,system_md FROM accounts WHERE is_human=0 LIMIT 1").get();
  assert.match(persona.system_md,/## Friends\n\n- @/);
  assert.equal(readFileSync(join(temp,'personas',persona.id,'system.md'),'utf8'),persona.system_md);
  const seededAgain=seedStore(db,{dataRoot:temp});
  assert.equal(seededAgain.seeded,false);
  console.log('Cygnet seed self-check passed.');
} finally {
  db.close();
  rmSync(temp,{recursive:true,force:true});
}
