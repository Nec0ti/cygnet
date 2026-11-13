import { openStore, HUMAN_ID, logEvent, saveSystemFile, transaction } from './store.js';
import { createInitialProfiles } from '../../seed/generate.mjs';
import { randomUUID } from 'node:crypto';

const captions = [
  'A small reset after a long week.', 'The light was too good not to stop.',
  'Found a quiet corner and stayed a while.', 'Current mood: taking the scenic route.',
  'Today needed a little color.', 'No big plan, just a good afternoon.',
  'Saving this one for later.', 'A moment I almost walked past.',
];
const now = () => new Date().toISOString();
function afterHours(hours, offsetMinutes = 0) {
  return hours == null ? null : new Date(Date.now() + hours * 3600000 + offsetMinutes * 60000).toISOString();
}
function systemMd(db, profile) {
  const friends=db.prepare(`SELECT a.id FROM edges e JOIN accounts a ON a.id=e.target_id WHERE e.source_id=? AND e.kind='friend' ORDER BY a.id`)
    .all(profile.id).map(({id})=>`- [[${id}]]`).join('\n') || '- None yet';
  const traits=Object.entries(JSON.parse(profile.traits_json || '{}')).map(([name,value])=>`- ${name}: ${value}/100`).join('\n');
  const activity=JSON.parse(profile.activity_json || '{}');
  const memories=db.prepare(`SELECT pm.content,a.username FROM persona_memories pm LEFT JOIN accounts a ON a.id=pm.related_id
    WHERE pm.account_id=? ORDER BY pm.created_at DESC LIMIT 12`).all(profile.id).reverse()
    .map((item)=>`- ${item.content}${item.username?` (@${item.username})`:''}`).join('\n') || '- No recent remembered interactions.';
  const minor=profile.age<18?'- Under 18: keep interactions age-appropriate; no sexual or erotic conversation, sexting, or sexual roleplay. Never engage in an adult-minor sexual approach.\n':'';
  const extra=profile.extra_notes || '- None';
  return `# ${profile.username}\n\n## Identity\n- Name: ${profile.name}\n- Age: ${profile.age}\n- Country: ${profile.country}\n- Pronouns: ${profile.pronouns}\n- Language: English only\n${profile.alias_of?'- Alternate account created after a block; keep the identity plausible and do not disclose the link unless directly asked.\n':''}\n## Conversation tone\n${profile.tone}\n\n## Traits (0-100)\n${traits}\n\n## Friends\n${friends}\n\n## Activity rhythm\n- Posts: ${activity.postMode}${activity.postIntervalHours ? `, every ${activity.postIntervalHours} hours` : ''}\n- Stories: every ${activity.storyIntervalHours} hours\n- DM initiation: ${activity.dmInitiation}\n\n## Extra notes\n${extra}\n\n## Recent interaction memories\n${memories}\n\n## Content boundaries\n- No sexual content in public posts, comments, or public image prompts.\n- Never create sexual imagery.\n${minor}- All platform text must be in English.\n`;
}

function scheduleTimes(profile, index = 0) {
  const activity=profile.activity;
  const dmHours=activity.dmInitiation==='frequent'?6:activity.dmInitiation==='occasional'?36:null;
  return {
    post_due_at: activity.postIntervalHours==null ? null : afterHours(activity.postIntervalHours,index%17),
    story_due_at: afterHours(activity.storyIntervalHours,index%29),
    dm_due_at: afterHours(dmHours,index%13),
    engagement_due_at: afterHours(0,12+(index*7)%37),
  };
}

function reconcileExisting(db, { dataRoot } = {}) {
  const profiles=db.prepare('SELECT * FROM accounts WHERE is_human=0 ORDER BY id').all();
  for (let i=0;i<profiles.length;i++) {
    const row=profiles[i];
    if (!row.activity_json || row.activity_json==='{}') {
      const traits=JSON.parse(row.traits_json||'{}');
      const shy=Number(traits.shyness||0), social=Number(traits.sociability||0);
      const activity=shy>=75&&social<=40
        ? {postMode:'story_only',postIntervalHours:null,storyIntervalHours:24,dmInitiation:'only_after_contact'}
        : social>=70
          ? {postMode:'frequent',postIntervalHours:4+((i*3)%5),storyIntervalHours:6,dmInitiation:'frequent'}
          : {postMode:'occasional',postIntervalHours:24+((i*11)%73),storyIntervalHours:16,dmInitiation:'occasional'};
      db.prepare(`UPDATE accounts SET activity_json=?,post_due_at=?,story_due_at=?,dm_due_at=?,engagement_due_at=? WHERE id=?`)
        .run(JSON.stringify(activity), ...Object.values(scheduleTimes({activity},i)), row.id);
    }
    const current=db.prepare('SELECT * FROM accounts WHERE id=?').get(row.id);
    db.prepare('UPDATE accounts SET system_md=? WHERE id=?').run(systemMd(db,current),row.id);
    saveSystemFile(db,row.id,dataRoot);
  }
}

export function seedStore(db, options = {}) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n;
  if (count) {
    reconcileExisting(db, options);
    return { seeded: false, accounts: count };
  }
  const profiles=createInitialProfiles(options.seed ?? 'cygnet-v1');
  const current=now();
  const insertAccount=db.prepare(`INSERT INTO accounts
    (id,name,username,bio,pronouns,age,country,is_human,tone,traits_json,extra_notes,activity_json,
      post_due_at,story_due_at,dm_due_at,engagement_due_at,system_md,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  transaction(db,()=>{
    insertAccount.run(HUMAN_ID,'You','you','','',null,'',1,'','{}','','{}',null,null,null,null,'',current);
    for(let i=0;i<profiles.length;i++) {
      const p=profiles[i], scheduled=scheduleTimes(p,i);
      insertAccount.run(p.id,p.name,p.username,p.bio,p.pronouns,p.age,p.country,0,p.tone,JSON.stringify(p.traits),
        p.notes.join('\n'),JSON.stringify(p.activity),scheduled.post_due_at,scheduled.story_due_at,scheduled.dm_due_at,
        scheduled.engagement_due_at,p.systemMd,current);
    }
    const insertEdge=db.prepare(`INSERT INTO edges(source_id,target_id,kind,created_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING`);
    for(const p of profiles) for(const friend of p.friends) insertEdge.run(p.id,friend,'friend',current);
    const post=db.prepare('INSERT INTO posts(id,account_id,caption,kind,created_at) VALUES(?,?,?,?,?)');
    for(let i=0;i<28;i++) post.run(randomUUID(),profiles[(i*37+12)%profiles.length].id,captions[i%captions.length],'post',new Date(Date.now()-i*3600000).toISOString());
    const story=db.prepare('INSERT INTO posts(id,account_id,caption,kind,created_at,expires_at) VALUES(?,?,?,?,?,?)');
    for(let i=0;i<12;i++) story.run(randomUUID(),profiles[(i*29+6)%profiles.length].id,captions[(i+3)%captions.length],'story',current,afterHours(24));
    logEvent(db,HUMAN_ID,'population.seeded',{personas:100,posts:28,stories:12,seed:options.seed??'cygnet-v1'});
  });
  for(const p of profiles) saveSystemFile(db,p.id,options.dataRoot);
  return {seeded:true,accounts:101};
}

if(import.meta.main) {
  const db=openStore();
  console.log(JSON.stringify(seedStore(db)));
  db.close();
}
