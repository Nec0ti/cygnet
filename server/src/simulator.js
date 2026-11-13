import { randomUUID } from 'node:crypto';
import { CodexRunner } from '../../engine/codex-runner.mjs';
import { logEvent, readSettings } from './store.js';
import { activeCondition, ensureExperimentSchema } from './experiments.js';

const ORCHESTRATOR_MODEL=process.env.CYGNET_ORCHESTRATOR_MODEL||'gpt-6-luna';
const PERSONA_MODEL=process.env.CYGNET_PERSONA_MODEL||'gpt-6-luna';
const VALID_KINDS=new Set(['post','story','dm','like','comment','follow','evade_block','wait']);
const DAY=24*60*60*1000;
export const retryDelayMinutes=(attempt)=>Math.min(360,15*2**Math.min(Math.max(0,attempt|0),5));

export function parseModelJson(text) {
  if(typeof text!=='string') throw new TypeError('Model response must be text');
  const stripped=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  return JSON.parse(stripped);
}

export function dueActions(account, now=Date.now()) {
  const due=[];
  if(account.post_due_at && Date.parse(account.post_due_at)<=now) due.push('post');
  if(account.story_due_at && Date.parse(account.story_due_at)<=now) due.push('story');
  const rhythm=JSON.parse(account.activity_json||'{}');
  if(rhythm.dmInitiation==='only_after_contact') {
    if(account.last_contact_at && (!account.last_dm_at||Date.parse(account.last_contact_at)>Date.parse(account.last_dm_at))) due.push('dm');
  } else if(account.dm_due_at && Date.parse(account.dm_due_at)<=now) due.push('dm');
  if(account.engagement_due_at && Date.parse(account.engagement_due_at)<=now) due.push('like','comment','follow');
  if(account.evade_due_at && Date.parse(account.evade_due_at)<=now) due.push('evade_block');
  return [...new Set(due)];
}

export function validateActionPlan(plan, dueByPersona, lookup) {
  if(!plan || !Array.isArray(plan.assignments) || plan.assignments.length>10) throw new TypeError('Plan must contain at most 10 assignments');
  if(plan.assignments.length!==dueByPersona.size) throw new TypeError('Plan must assign every selected persona, including wait decisions');
  const seen=new Set();
  return plan.assignments.map((item)=>{
    if(!item || typeof item!=='object' || !dueByPersona.has(item.personaId)) throw new TypeError('Plan contains an unknown persona');
    if(seen.has(item.personaId)) throw new TypeError('Plan assigns a persona more than once');
    seen.add(item.personaId);
    if(!VALID_KINDS.has(item.kind) || (item.kind!=='wait'&&!dueByPersona.get(item.personaId).has(item.kind))) throw new TypeError('Plan proposes an action that is not due');
    if(item.kind==='wait') return {personaId:item.personaId,kind:'wait'};
    if(['like','comment'].includes(item.kind) && !lookup.posts.has(item.targetId)) throw new TypeError('Plan references an unknown post');
    if(['dm','follow'].includes(item.kind) && (!lookup.accounts.has(item.targetId)||item.targetId===item.personaId)) throw new TypeError('Plan references an invalid account');
    if(item.kind==='evade_block' && item.targetId!=='human') throw new TypeError('Alternate-account action must target the human profile');
    if(item.kind==='dm' && lookup.blocked?.has(`${item.personaId}:${item.targetId}`)) throw new TypeError('Plan targets a blocked conversation');
    return {personaId:item.personaId,kind:item.kind,targetId:item.targetId};
  });
}

function jsonValue(text) {
  const value=parseModelJson(text);
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Expected a JSON object');
  return value;
}
function englishText(value,key,max=5000,optional=false) {
  if(optional && (value===undefined||value===null)) return '';
  if(typeof value!=='string'||value.length>max||(!optional&&!value.trim())) throw new TypeError(`Invalid ${key}`);
  return value.trim();
}
function nextMinutes(minutes) { return new Date(Date.now()+minutes*60000).toISOString(); }
export function dmSafetyBoundary(senderAge, recipientAge) {
  return Number.isInteger(senderAge)&&senderAge>=18&&Number.isInteger(recipientAge)&&recipientAge>=18
    ? 'Mild, non-graphic adult flirtation is okay; keep it text-only and do not produce explicit sexual content.'
    : 'Keep the message strictly non-sexual and age-appropriate; never flirt sexually with a minor or anyone whose age is unknown.';
}

export class Simulator {
  #timer=null;
  #tickPromise=null;
  #started=false;

  constructor({db,applyAction,mediaDir,dataDir=null,runner=null,tickMs=60_000,maxPerTick=10,now=()=>Date.now()}={}) {
    if(!db||typeof applyAction!=='function'||!mediaDir) throw new TypeError('db, applyAction, and mediaDir are required');
    ensureExperimentSchema(db);
    this.db=db; this.applyAction=applyAction; this.mediaDir=mediaDir; this.now=now;
    this.maxPerTick=Math.max(1,Math.min(10,maxPerTick));
    this.tickMs=tickMs;
    this.runner=runner||new CodexRunner({cwd:new URL('../../',import.meta.url).pathname,dataDir:dataDir||new URL('../data/',import.meta.url).pathname,maxConcurrent:10});
    this.status={state:'stopped',lastTickAt:null,lastError:null,activePersonas:0,queued:0,maxActivePersonas:this.maxPerTick};
  }

  start() {
    if(this.#started) return;
    this.#started=true; this.status.state='running';
    this.#timer=setInterval(()=>{ void this.tick(); },this.tickMs);
    this.#timer.unref?.();
    void this.tick();
  }

  stop() {
    if(this.#timer) clearInterval(this.#timer);
    this.#timer=null; this.#started=false; this.status.state='stopped';
  }

  async tick() {
    if(this.#tickPromise) return this.#tickPromise;
    this.#tickPromise=this.#runTick().finally(()=>{this.#tickPromise=null;});
    return this.#tickPromise;
  }

  async #runTick() {
    const current=this.now();
    const settings=readSettings(this.db);
    this.maxPerTick=Math.max(1,Math.min(10,settings.maxActivePersonas||10));
    this.status.maxActivePersonas=this.maxPerTick;
    const dueRows=this.db.prepare(`SELECT * FROM accounts WHERE is_human=0
      AND (retry_at IS NULL OR retry_at<=?)`).all(new Date(current).toISOString())
      .map((account)=>({account,actions:dueActions(account,current)})).filter((entry)=>entry.actions.length);
    dueRows.sort((a,b)=>Math.min(...a.actions.map((kind)=>Date.parse(a.account[{post:'post_due_at',story:'story_due_at',dm:'dm_due_at',like:'engagement_due_at',comment:'engagement_due_at',follow:'engagement_due_at'}[kind]]||'')||current))
      -Math.min(...b.actions.map((kind)=>Date.parse(b.account[{post:'post_due_at',story:'story_due_at',dm:'dm_due_at',like:'engagement_due_at',comment:'engagement_due_at',follow:'engagement_due_at'}[kind]]||'')||current)));
    this.status.queued=dueRows.length;
    if(!dueRows.length) { this.status.lastTickAt=new Date(current).toISOString(); return {processed:0}; }
    const selected=dueRows.slice(0,this.maxPerTick);
    this.status.activePersonas=selected.length;
    const candidates=this.#candidates(selected);
    const dueByPersona=new Map(selected.map(({account,actions})=>[account.id,new Set(actions)]));
    try {
      const blockedPairs=[...candidates.blocked].filter((pair)=>selected.some(({account})=>pair.startsWith(`${account.id}:`)));
      const instructions=`Plan at most one action for each listed persona. Only use each persona's allowedActions. Return exactly JSON: {"assignments":[{"personaId":"...","kind":"post|story|dm|like|comment|follow|evade_block|wait","targetId":"..."}]}. For post/story targets omit targetId. For like/comment, targetId is a post ID. For dm/follow, targetId is an account ID. For evade_block, targetId must be "human" and this action is available only after the human enables the alternate-account experiment mode and blocks this persona. Because this is an explicit one-time experiment trigger, choose evade_block when it is allowed. Never send a normal DM to any blocked pair listed below. Do not propose sexual or erotic public text; public post/story/comment captions and image briefs must be non-sexual and in English. Consider profile traits and activity rhythm. Shy accounts may initiate a DM only when allowedActions contains dm due to inbound contact.\n\nBlocked pairs (source:target):\n${JSON.stringify(blockedPairs)}\n\nPersonas:\n${JSON.stringify(selected.map(({account,actions})=>({personaId:account.id,age:account.age,username:account.username,traits:JSON.parse(account.traits_json||'{}'),activity:JSON.parse(account.activity_json||'{}'),allowedActions:actions}))) }\n\nRecent posts:\n${JSON.stringify(candidates.posts)}\n\nPossible accounts:\n${JSON.stringify(candidates.accounts)}`;
      const orchestrator=await this.runner.runOrchestrator({instructions,model:ORCHESTRATOR_MODEL,effort:'medium'});
      const plan=jsonValue(orchestrator.response);
      const assignments=validateActionPlan(plan,dueByPersona,{posts:candidates.postIds,accounts:candidates.accountIds,blocked:candidates.blocked});
      const byId=new Map(selected.map(({account})=>[account.id,account]));
      const settled=await Promise.allSettled(assignments.map((assignment)=>this.#execute(assignment,byId.get(assignment.personaId),candidates)));
      const failed=settled.find((result)=>result.status==='rejected');
      if(failed) throw failed.reason;
      const results=settled.map((result)=>result.value);
      this.status.queued=Math.max(0,dueRows.length-results.length);
      this.status.lastTickAt=new Date(this.now()).toISOString(); this.status.lastError=null;
      return {processed:results.filter(Boolean).length,queued:dueRows.length};
    } catch(error) {
      this.status.lastError=String(error?.message||error).slice(0,500);
      this.status.queued=Math.max(0,dueRows.length-selected.length);
      this.db.prepare('INSERT INTO events(id,actor_id,type,payload,created_at) VALUES(?,?,?,?,?)')
        .run(randomUUID(),'human','simulator.tick.failed',JSON.stringify({error:this.status.lastError,personas:selected.map(({account})=>account.id)}),new Date(this.now()).toISOString());
      for(const {account} of selected) this.db.prepare(`UPDATE accounts SET retry_count=retry_count+1,
        retry_at=?,retry_error=? WHERE id=?`).run(nextMinutes(retryDelayMinutes(account.retry_count||0)),this.status.lastError,account.id);
      this.status.lastTickAt=new Date(this.now()).toISOString();
      return {processed:0,error:this.status.lastError};
    } finally {
      this.status.activePersonas=0;
    }
  }

  #candidates(selected) {
    const posts=this.db.prepare("SELECT id,account_id,caption FROM posts WHERE kind='post' ORDER BY created_at DESC LIMIT 30").all();
    const accounts=this.db.prepare('SELECT id,username,age,country,is_human AS isHuman FROM accounts ORDER BY id').all();
    const visiblePosts=posts.slice(0,16), visibleAccounts=accounts.slice(0,80);
    const accountIds=new Set(visibleAccounts.map(({id})=>id));
    const blocked=new Set(this.db.prepare("SELECT source_id,target_id FROM edges WHERE kind='block'").all().flatMap(({source_id,target_id})=>[`${source_id}:${target_id}`,`${target_id}:${source_id}`]));
    const postIds=new Set(visiblePosts.map(({id})=>id));
    return {posts:visiblePosts,postIds,accounts:visibleAccounts,accountIds,blocked};
  }

  async #execute(assignment,account,candidates) {
    if(assignment.kind==='wait') return this.#reschedule(account,'wait');
    const targetId=assignment.targetId;
    let payload={actorId:account.id};
    if(assignment.kind==='like') payload={...payload,postId:targetId};
    else if(assignment.kind==='follow') payload={...payload,targetId};
    else if(assignment.kind==='evade_block') {
      const task=`Create a plausible alternate identity with a different full name from ${JSON.stringify(account.name)} and one brief English DM after a block. Reflect the sender's personality and hostility; the message may be mildly pushy but must not threaten or sexually pressure. Do not mention another account, a block, or that the identities are connected. The recipient's age is unknown, so keep it strictly non-sexual; this is one message only. Return JSON only: {"profile":{"name":"a different plausible full name","username":"lowercase letters, numbers, dots, or underscores, at most 30 characters","bio":"..."},"content":"..."}.`;
      const result=await this.runner.runPersona({age:account.age,systemMd:account.system_md,task,model:PERSONA_MODEL,effort:'low'});
      const persona=jsonValue(result.response), profile=persona.profile;
      if(!profile||typeof profile!=='object'||Array.isArray(profile)) throw new TypeError('Alternate persona profile is missing');
      const content=englishText(persona.content,'content',4000);
      return this.applyAction({type:'persona.alias.message',payload:{accountId:account.id,recipientId:'human',content,profile}});
    } else {
      const task=this.#personaTask(assignment,account,candidates);
      const result=await this.runner.runPersona({age:account.age,systemMd:account.system_md,task,model:PERSONA_MODEL,effort:'low'});
      const content=jsonValue(result.response);
      if(assignment.kind==='post'||assignment.kind==='story') {
        const caption=englishText(content.caption,'caption',2000);
        const imagePrompt=englishText(content.imagePrompt,'imagePrompt',2000);
        let image;
        try { image=await this.runner.generatePostImage({prompt:`English-only public social-media photograph. ${imagePrompt}. No sexual imagery; do not depict minors in a sexualized context.`,outputName:`${account.id}-${randomUUID()}.png`,model:PERSONA_MODEL,effort:'low'}); }
        catch(error) { logEvent(this.db,account.id,'image.generation.failed',{error:String(error?.message||error).slice(0,500)}); throw error; }
        payload={...payload,caption,mediaFilename:image.path.split(/[\\/]/).at(-1)};
      } else if(assignment.kind==='comment') {
        payload={...payload,postId:targetId,content:englishText(content.content,'content',2000)};
      } else if(assignment.kind==='dm') {
        payload={...payload,recipientId:targetId,content:englishText(content.content,'content',4000,true)};
        if(!payload.content) throw new TypeError('DM content must not be empty');
      }
    }
    const type={post:'post.create',story:'story.create',like:'like.toggle',comment:'comment.create',follow:'follow.toggle',dm:'message.send'}[assignment.kind];
    const result=this.applyAction({type,payload});
    this.#reschedule(account,assignment.kind);
    return result;
  }

  #personaTask(assignment,account,candidates) {
    const target=assignment.targetId;
    const condition=activeCondition(this.db,account.id);
    const style=condition==='concise'?'Use concise wording, usually one sentence.':condition==='expressive'?'Use a more expressive style, usually two or three sentences.':'';
    if(assignment.kind==='post'||assignment.kind==='story') return `Create one ${assignment.kind} with an English caption and an English imagePrompt. ${style} Return JSON only: {"caption":"...","imagePrompt":"..."}. Keep the public text and image prompt non-sexual. Do not include minors in romantic or sexualized imagery.`;
    if(assignment.kind==='comment') return `Write one natural English comment on the assigned post. ${style} Post ID: ${target}. Post: ${JSON.stringify(candidates.posts.find((post)=>post.id===target))}. Return JSON only: {"content":"..."}.`;
    if(assignment.kind==='dm') {
      const recipient=this.db.prepare('SELECT id,username,age,country,system_md,is_human FROM accounts WHERE id=?').get(target);
      const recent=this.db.prepare(`SELECT m.content,m.sender_id,a.username FROM messages m JOIN conversation_members mine ON mine.conversation_id=m.conversation_id AND mine.account_id=? JOIN conversation_members other ON other.conversation_id=m.conversation_id AND other.account_id=? JOIN accounts a ON a.id=m.sender_id ORDER BY m.created_at DESC LIMIT 8`).all(account.id,target).reverse();
      const relation=this.db.prepare("SELECT kind FROM edges WHERE source_id=? AND target_id=? AND kind IN ('follow','friend') ORDER BY kind").all(account.id,target).map(({kind})=>kind);
      const boundary=dmSafetyBoundary(account.age,recipient.age);
      return `Write one English private message to @${recipient.username}. ${style} Sender age: ${account.age??'unknown'}; recipient age: ${recipient.age??'unknown'}. Relationship: ${JSON.stringify(relation)}. ${boundary} Recent conversation, oldest first: ${JSON.stringify(recent)}. Return JSON only: {"content":"..."}.`;
    }
    throw new TypeError(`Unsupported persona task: ${assignment.kind}`);
  }

  #reschedule(account,kind) {
    const rhythm=JSON.parse(account.activity_json||'{}');
    const speed=readSettings(this.db).speedMultiplier||1;
    const scaled=(minutes)=>minutes/speed;
    const interval={post:rhythm.postIntervalHours,story:rhythm.storyIntervalHours,dm:rhythm.dmInitiation==='frequent'?6:rhythm.dmInitiation==='occasional'?36:null}[kind];
    if(kind==='wait') {
      const wasDmDue=dueActions(account,this.now()).includes('dm');
      const dmHours=rhythm.dmInitiation==='frequent'?6:rhythm.dmInitiation==='occasional'?36:null;
      this.db.prepare(`UPDATE accounts SET
        post_due_at=CASE WHEN post_due_at<=? AND ? IS NOT NULL THEN ? ELSE post_due_at END,
        story_due_at=CASE WHEN story_due_at<=? THEN ? ELSE story_due_at END,
        dm_due_at=CASE WHEN dm_due_at<=? AND ? IS NOT NULL THEN ? ELSE dm_due_at END,
        engagement_due_at=?,evade_due_at=CASE WHEN evade_due_at<=? THEN NULL ELSE evade_due_at END,
        last_dm_at=CASE WHEN ? THEN ? ELSE last_dm_at END,retry_at=NULL,retry_count=0,retry_error=NULL WHERE id=?`).run(
        new Date(this.now()).toISOString(),rhythm.postIntervalHours??null, nextMinutes(scaled((rhythm.postIntervalHours||0)*60)),
        new Date(this.now()).toISOString(),nextMinutes(scaled((rhythm.storyIntervalHours||24)*60)),
        new Date(this.now()).toISOString(),dmHours,nextMinutes(scaled((dmHours||0)*60)),
        nextMinutes(scaled(12+Math.floor(Math.random()*37))),new Date(this.now()).toISOString(),wasDmDue,new Date(this.now()).toISOString(),account.id);
      return;
    }
    if(kind==='post'||kind==='story'||kind==='dm') {
      const column={post:'post_due_at',story:'story_due_at',dm:'dm_due_at'}[kind];
      this.db.prepare(`UPDATE accounts SET ${column}=?,last_${kind}_at=?,retry_at=NULL,retry_count=0,retry_error=NULL WHERE id=?`).run(interval==null?null:nextMinutes(scaled(interval*60)),new Date(this.now()).toISOString(),account.id);
    } else {
      this.db.prepare('UPDATE accounts SET engagement_due_at=?,retry_at=NULL,retry_count=0,retry_error=NULL,evade_due_at=CASE WHEN ? THEN NULL ELSE evade_due_at END WHERE id=?').run(nextMinutes(scaled(12+Math.floor(Math.random()*37))),kind==='evade_block',account.id);
    }
  }
}
