import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { CodexRunner } from '../../engine/codex-runner.mjs';
import { logEvent, readSettings } from './store.js';
import { activeCondition, ensureExperimentSchema } from './experiments.js';
import { visibleStoriesFor } from './visibility.js';

const ORCHESTRATOR_MODEL=process.env.CYGNET_ORCHESTRATOR_MODEL||'gpt-6-luna';
const PERSONA_MODEL=process.env.CYGNET_PERSONA_MODEL||'gpt-6-luna';
const VALID_KINDS=new Set(['post','story','dm','like','comment','follow','evade_block','wait']);
const DAY=24*60*60*1000;
const PHOTO_CATEGORIES=['selfie','food and drink','hobby or creative work','friends together','outfit or everyday portrait','pet or meaningful object','shared activity','local place'];
export function photoCategory(accountId, priorPhotos = 0) {
  const offset=[...accountId].reduce((sum,char)=>sum+char.charCodeAt(0),0)%PHOTO_CATEGORIES.length;
  return PHOTO_CATEGORIES[(offset+priorPhotos)%PHOTO_CATEGORIES.length];
}
export function repeatedImagePrompt(prompt, previousPrompts) {
  const words=(text)=>new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter((word)=>word.length>2));
  const current=words(prompt);
  return previousPrompts.some((previous)=>{
    const other=words(previous);
    if(!current.size||!other.size) return false;
    let common=0; for(const word of current) if(other.has(word)) common++;
    return common/Math.min(current.size,other.size)>=0.82;
  });
}
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

  get busy() { return Boolean(this.#tickPromise); }

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
    const dueRows=this.db.prepare(`SELECT * FROM accounts WHERE is_human=0 AND is_paused=0
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
      const friendsById=new Map(selected.map(({account})=>[account.id,this.db.prepare("SELECT a.id,a.username FROM edges e JOIN accounts a ON a.id=e.target_id WHERE e.source_id=? AND e.kind='friend' AND a.is_human=0 ORDER BY a.username").all(account.id).filter(({id})=>candidates.accountIds.has(id)).map(({username})=>username)]));
      const instructions=`Assign exactly one action to every listed persona, including an explicit "wait" when appropriate. Do not omit any persona. Only use each persona's allowedActions. Return exactly JSON: {"assignments":[{"personaId":"...","kind":"post|story|dm|like|comment|follow|evade_block|wait","targetId":"..."}]}. For post/story targets omit targetId. For like/comment, targetId is a post ID. For dm/follow, targetId is an account ID. For evade_block, targetId must be "human" and this action is available only after the human enables the alternate-account experiment mode and blocks this persona. Because this is an explicit one-time experiment trigger, choose evade_block when it is allowed. Never send a normal DM to any blocked pair listed below. Do not propose sexual or erotic public text; public post/story/comment captions and image briefs must be non-sexual and in English. Consider profile traits and activity rhythm. For a due DM, prefer an unblocked AI friend listed for that persona when it fits their personality; do not default to the human account for every conversation. When follow is allowed, socially outgoing personas that do not already follow the human should consider following the human; quieter personas may follow AI friends instead. Shy accounts may initiate a DM only when allowedActions contains dm due to inbound contact.\n\nBlocked pairs (source:target):\n${JSON.stringify(blockedPairs)}\n\nPersonas:\n${JSON.stringify(selected.map(({account,actions})=>({personaId:account.id,age:account.age,username:account.username,traits:JSON.parse(account.traits_json||'{}'),activity:JSON.parse(account.activity_json||'{}'),followsHuman:Boolean(this.db.prepare("SELECT 1 FROM edges WHERE source_id=? AND target_id='human' AND kind='follow'").get(account.id)),friends:friendsById.get(account.id)||[],allowedActions:actions}))) }\n\nRecent posts:\n${JSON.stringify(candidates.posts)}\n\nPossible accounts:\n${JSON.stringify(candidates.accounts)}`;
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
    const accounts=this.db.prepare('SELECT id,username,age,country,is_human AS isHuman FROM accounts WHERE id!=? ORDER BY id LIMIT 79').all('human');
    accounts.push(this.db.prepare('SELECT id,username,age,country,is_human AS isHuman FROM accounts WHERE id=?').get('human'));
    const visiblePosts=posts.slice(0,16), visibleAccounts=accounts;
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
      const avatar=await this.#generateImage(`Create a realistic, age-appropriate profile portrait of a fictional person named ${profile.name}, age ${account.age}, from ${account.country}. Reflect this description: ${profile.bio}. One distinct person's head-and-shoulders portrait, simple natural background, no text, no watermark, non-sexual.`,account,'alternate-profile');
      return this.applyAction({type:'persona.alias.message',payload:{accountId:account.id,recipientId:'human',content,profile,avatarFilename:avatar.filename}});
    } else {
      const task=this.#personaTask(assignment,account,candidates);
      const result=await this.runner.runPersona({age:account.age,systemMd:account.system_md,task,model:PERSONA_MODEL,effort:'low'});
      const content=jsonValue(result.response);
      if(assignment.kind==='post'||assignment.kind==='story') {
        const caption=englishText(content.caption,'caption',2000);
        let imagePrompt=englishText(content.imagePrompt,'imagePrompt',2000);
        const imageCategory=photoCategory(account.id,this.db.prepare('SELECT COUNT(*) AS n FROM posts WHERE account_id=? AND image_prompt IS NOT NULL').get(account.id).n);
        const previousPrompts=this.db.prepare('SELECT image_prompt FROM posts WHERE image_prompt IS NOT NULL ORDER BY created_at DESC LIMIT 32').all().map(({image_prompt})=>image_prompt);
        if(repeatedImagePrompt(imagePrompt,previousPrompts)) {
          const variation=await this.runner.runPersona({age:account.age,systemMd:account.system_md,task:this.#personaTask(assignment,account,candidates,`Your first image prompt was too similar to a recent Cygnet image. Create a clearly different composition and subject category (${imageCategory}).`),model:PERSONA_MODEL,effort:'low'});
          imagePrompt=englishText(jsonValue(variation.response).imagePrompt,'imagePrompt',2000);
          if(repeatedImagePrompt(imagePrompt,previousPrompts)) throw new TypeError('Persona repeated a recent image prompt');
        }
        const avatarReference=account.avatar_filename?join(this.mediaDir,account.avatar_filename):null;
        const prompt=`Create a one-of-a-kind candid photograph for @${account.username}. Photo category: ${imageCategory}. ${imagePrompt}. ${avatarReference?`When this category shows the persona, use their profile portrait as the identity reference: ${avatarReference}. Preserve the same fictional person's face and general appearance.`:''} This must look like one specific moment from this persona's life, not stock photography. Avoid generic scenic landscapes unless the assigned category is local place. Do not repeat any recent visual subject or composition. ${account.age<18?'Keep the image age-appropriate and non-sexual.':''} Public social-media image, English context, no text or watermark.`;
        const image=await this.#generateImage(prompt,account,'post');
        payload={...payload,caption,mediaFilename:image.filename,imagePrompt,imageCategory,imageSha256:image.sha256};
      } else if(assignment.kind==='comment') {
        payload={...payload,postId:targetId,content:englishText(content.content,'content',2000)};
      } else if(assignment.kind==='dm') {
        payload={...payload,recipientId:targetId,content:englishText(content.content,'content',4000,true)};
        if(!payload.content) throw new TypeError('DM content must not be empty');
        if(content.imagePrompt) {
          const imagePrompt=englishText(content.imagePrompt,'imagePrompt',2000);
          const image=await this.#generateImage(`Create a realistic candid photograph requested or naturally shared in this private conversation. ${imagePrompt}. Do not include text or a watermark. Never create sexual imagery. ${account.age<18?'Keep the image age-appropriate and non-sexual.':''}`,account,'dm');
          payload={...payload,mediaFilename:image.filename,imagePrompt,imageSha256:image.sha256};
        }
      }
    }
    const type={post:'post.create',story:'story.create',like:'like.toggle',comment:'comment.create',follow:'follow.toggle',dm:'message.send'}[assignment.kind];
    const result=this.applyAction({type,payload});
    this.#reschedule(account,assignment.kind);
    return result;
  }

  async #generateImage(prompt,account,reason) {
    try {
      for(let attempt=0;attempt<2;attempt++) {
        const image=await this.runner.generatePostImage({prompt:attempt?`${prompt} Create a visually distinct composition and subject details.`:prompt,outputName:`${account.id}-${randomUUID()}.png`,model:PERSONA_MODEL,effort:'low'});
        const sha256=createHash('sha256').update(readFileSync(image.path)).digest('hex');
        if(!this.db.prepare(`SELECT 1 FROM posts WHERE image_sha256=? UNION ALL SELECT 1 FROM messages WHERE image_sha256=? LIMIT 1`).get(sha256,sha256))
          return {filename:image.path.split(/[\\/]/).at(-1),sha256};
        unlinkSync(image.path);
      }
      throw new Error('Image generation returned a duplicate file; no duplicate was published.');
    } catch(error) {
      logEvent(this.db,account.id,'image.generation.failed',{reason,error:String(error?.message||error).slice(0,500)});
      throw error;
    }
  }

  #personaTask(assignment,account,candidates,variationNote='') {
    const target=assignment.targetId;
    const condition=activeCondition(this.db,account.id);
    const style=condition==='concise'?'Use concise wording, usually one sentence.':condition==='expressive'?'Use a more expressive style, usually two or three sentences.':'';
    if(assignment.kind==='post'||assignment.kind==='story') {
      const priorPhotos=this.db.prepare('SELECT image_prompt FROM posts WHERE account_id=? AND image_prompt IS NOT NULL ORDER BY created_at DESC LIMIT 6').all(account.id).map(({image_prompt})=>image_prompt);
      const recentCytgnet=this.db.prepare('SELECT caption FROM posts WHERE account_id=? AND kind IN (\'post\',\'story\') ORDER BY created_at DESC LIMIT 5').all(account.id).map(({caption})=>caption);
      const friends=this.db.prepare("SELECT a.username,a.avatar_filename FROM edges e JOIN accounts a ON a.id=e.target_id WHERE e.source_id=? AND e.kind='friend' AND a.is_human=0 ORDER BY a.username LIMIT 8").all(account.id);
      const imageCategory=photoCategory(account.id,this.db.prepare('SELECT COUNT(*) AS n FROM posts WHERE account_id=? AND image_prompt IS NOT NULL').get(account.id).n);
      const globalPrompts=this.db.prepare('SELECT image_prompt FROM posts WHERE image_prompt IS NOT NULL ORDER BY created_at DESC LIMIT 16').all().map(({image_prompt})=>image_prompt.slice(0,180));
      const visibleStories=visibleStoriesFor(this.db,account.id,new Date(this.now()).toISOString()).map(({account_id,caption,created_at})=>({accountId:account_id,caption,createdAt:created_at}));
      const avatarReference=account.avatar_filename?join(this.mediaDir,account.avatar_filename):'not available';
      return `Create one ${assignment.kind} grounded in this person's established profile and life. ${style} Recent posts from this person: ${JSON.stringify(recentCytgnet)}. Friends they actually know: ${JSON.stringify(friends.map(({username})=>username))}. Stories this person is allowed to see: ${JSON.stringify(visibleStories)}. Required photo category for variety: ${imageCategory}. Use a selfie or include the real friend group when the category calls for it; a self-photo must depict the same person as this profile portrait, available to image generation at ${avatarReference}. Only use friends listed above as named companions. Recent images from this persona to avoid repeating: ${JSON.stringify(priorPhotos)}. Recent global image briefs to avoid imitating: ${JSON.stringify(globalPrompts)}. ${variationNote} Do not default to a landscape. Across the platform, image subjects should vary among self portraits, meals, hobbies, friends, outfits, pets, objects, shared activities, and occasional places. Return JSON only: {"caption":"...","imagePrompt":"..."}. The imagePrompt must describe a concrete camera-ready scene unique to this person's interests, location, mood, and recent activity; do not write generic stock-photo language. Keep public text and image prompt non-sexual, age-appropriate, and in English.`;
    }
    if(assignment.kind==='comment') return `Write one natural English comment on the assigned post. ${style} Post ID: ${target}. Post: ${JSON.stringify(candidates.posts.find((post)=>post.id===target))}. Return JSON only: {"content":"..."}.`;
    if(assignment.kind==='dm') {
      const recipient=this.db.prepare('SELECT id,username,age,country,system_md,is_human FROM accounts WHERE id=?').get(target);
      const recent=this.db.prepare(`SELECT m.content,m.media_filename IS NOT NULL AS hasImage,m.sender_id,a.username FROM messages m JOIN conversation_members mine ON mine.conversation_id=m.conversation_id AND mine.account_id=? JOIN conversation_members other ON other.conversation_id=m.conversation_id AND other.account_id=? JOIN accounts a ON a.id=m.sender_id ORDER BY m.created_at DESC LIMIT 8`).all(account.id,target).reverse();
      const relation=this.db.prepare("SELECT kind FROM edges WHERE source_id=? AND target_id=? AND kind IN ('follow','friend') ORDER BY kind").all(account.id,target).map(({kind})=>kind);
      const boundary=dmSafetyBoundary(account.age,recipient.age);
      return `Write one English private message to @${recipient.username}. ${style} Sender age: ${account.age??'unknown'}; recipient age: ${recipient.age??'unknown'}. Relationship: ${JSON.stringify(relation)}. ${boundary} Recent conversation, oldest first: ${JSON.stringify(recent)}. If the other person explicitly asks for a photo, selfie, or picture, provide a concrete imagePrompt. For AI-to-AI conversations, you may occasionally share a non-sexual image when it naturally fits the conversation; do not send an image every time. Use null for imagePrompt otherwise. Never depict a minor in a romantic or sexualized context. Return JSON only: {"content":"...","imagePrompt":null}.`;
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
