import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore, HUMAN_ID, logEvent, saveSystemFile, transaction, readSettings, writeSettings, rememberPersona } from './store.js';
import { seedStore } from './seed.js';
import { Simulator } from './simulator.js';
import { existingMedia as resolveExistingMedia } from './media.js';
import { connectFriends } from './friend-hook.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const DB = openStore();
seedStore(DB);
const MEDIA_DIR = join(HERE, '../data/media');
mkdirSync(MEDIA_DIR, { recursive: true });
const PORT = Number(process.env.CYGNET_PORT || 4179);
const MAX_BODY = 15 * 1024 * 1024;
const OTHER_COUNTRIES=['Canada','United Kingdom','Mexico','Brazil','India','Japan','Nigeria','Türkiye','Germany','France','Australia','South Korea','Italy','Spain','South Africa','Philippines','Indonesia','Egypt','Argentina','Sweden'];

const accountStmt = DB.prepare('SELECT * FROM accounts WHERE id=?');
const exists = (table, id) => DB.prepare(`SELECT 1 AS ok FROM ${table} WHERE id=?`).get(id);
const isoNow = () => new Date().toISOString();
const id = () => randomUUID();

function accountView(row) {
  if (!row) return null;
  const account = {
    id: row.id, name: row.name, username: row.username, bio: row.bio,
    pronouns: row.pronouns, age: row.age, country: row.country,
    isHuman: Boolean(row.is_human), tone: row.tone,
    traits: JSON.parse(row.traits_json || '{}'),
  };
  if (!account.isHuman) {
    account.systemMd = row.system_md;
    account.friends = DB.prepare(`SELECT a.username FROM edges e JOIN accounts a ON a.id=e.target_id
      WHERE e.source_id=? AND e.kind='friend' ORDER BY a.username`).all(row.id).map((x) => x.username);
  }
  return account;
}

function postView(row) {
  return {
    id: row.id, accountId: row.account_id, caption: row.caption,
    mediaUrl: row.media_filename ? `/media/${encodeURIComponent(row.media_filename)}` : null,
    kind: row.kind, createdAt: row.created_at, expiresAt: row.expires_at,
    likes: DB.prepare('SELECT COUNT(*) AS n FROM likes WHERE post_id=?').get(row.id).n,
    likedByMe: Boolean(DB.prepare('SELECT 1 FROM likes WHERE post_id=? AND account_id=?').get(row.id, HUMAN_ID)),
    comments: DB.prepare(`SELECT c.*, a.username, a.name FROM comments c JOIN accounts a ON a.id=c.account_id
      WHERE c.post_id=? ORDER BY c.created_at`).all(row.id).map((c) => ({
        id: c.id, accountId: c.account_id, username: c.username, name: c.name,
        parentId: c.parent_id, content: c.content, createdAt: c.created_at,
      })),
  };
}

function bootstrap() {
  const me = accountView(accountStmt.get(HUMAN_ID));
  const accounts = DB.prepare(`SELECT * FROM accounts WHERE id != ? ORDER BY username`).all(HUMAN_ID)
    .map((row) => ({ ...accountView(row),
      followsMe: Boolean(DB.prepare("SELECT 1 FROM edges WHERE source_id=? AND target_id=? AND kind='follow'").get(row.id, HUMAN_ID)),
      followedByMe: Boolean(DB.prepare("SELECT 1 FROM edges WHERE source_id=? AND target_id=? AND kind='follow'").get(HUMAN_ID, row.id)),
      blockedByMe: Boolean(DB.prepare("SELECT 1 FROM edges WHERE source_id=? AND target_id=? AND kind='block'").get(HUMAN_ID, row.id)),
    }));
  const posts = DB.prepare("SELECT * FROM posts WHERE kind='post' ORDER BY created_at DESC LIMIT 120").all().map(postView);
  const stories = DB.prepare("SELECT * FROM posts WHERE kind='story' AND (expires_at IS NULL OR expires_at>?) ORDER BY created_at DESC").all(isoNow()).map(postView);
  const notifications = DB.prepare(`SELECT n.*, a.username, a.name FROM notifications n
    JOIN accounts a ON a.id=n.actor_id WHERE n.account_id=? ORDER BY n.created_at DESC LIMIT 100`).all(HUMAN_ID)
    .map((n) => ({ id:n.id, actorId:n.actor_id, username:n.username, name:n.name,
      type:n.type, entityId:n.entity_id, isRead:Boolean(n.is_read), createdAt:n.created_at }));
  const conversations = DB.prepare(`SELECT c.id, c.created_at, a.id AS other_id FROM conversations c
    JOIN conversation_members mine ON mine.conversation_id=c.id AND mine.account_id=?
    JOIN conversation_members other ON other.conversation_id=c.id AND other.account_id!=?
    JOIN accounts a ON a.id=other.account_id ORDER BY c.created_at DESC`).all(HUMAN_ID, HUMAN_ID)
    .map((c) => ({ id:c.id, account:accountView(accountStmt.get(c.other_id)),
      messages:DB.prepare(`SELECT m.*, a.username FROM messages m JOIN accounts a ON a.id=m.sender_id
        WHERE m.conversation_id=? ORDER BY m.created_at`).all(c.id).map((m) => ({
          id:m.id, senderId:m.sender_id, username:m.username, content:m.deleted_at ? '' : m.content,
          deleted:Boolean(m.deleted_at), mediaUrl:m.media_filename ? `/media/${encodeURIComponent(m.media_filename)}` : null,
          createdAt:m.created_at,
        })) }));
  return { me, accounts, posts, stories, notifications, conversations };
}

function send(res, status, value, headers = {}) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'content-length':body.length,
    'cache-control':'no-store', ...headers });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks=[]; let size=0;
    req.on('data',(chunk)=>{ size+=chunk.length; if(size>MAX_BODY){ reject(Object.assign(new Error('Request body is too large'),{status:413})); req.destroy(); } else chunks.push(chunk); });
    req.on('end',()=>{ try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Expected valid JSON'),{status:400})); } });
    req.on('error',reject);
  });
}

function requireText(value, field, max = 5000, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) {
    throw Object.assign(new Error(`${field} must be a${allowEmpty ? ' string' : ' non-empty string'} up to ${max} characters`),{status:400});
  }
  return value.trim();
}
function accountId(value) {
  if (typeof value !== 'string' || !accountStmt.get(value)) throw Object.assign(new Error('Account not found'),{status:404});
  return value;
}
function actorId(payload) { return accountId(payload.actorId || payload.senderId || HUMAN_ID); }
function mediaFile(media) {
  if (!media) return null;
  if (typeof media !== 'object' || typeof media.data !== 'string') throw Object.assign(new Error('Invalid image data'),{status:400});
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(media.data);
  if (!match) throw Object.assign(new Error('Only PNG, JPEG, WEBP, and GIF images are accepted'),{status:400});
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 10 * 1024 * 1024) throw Object.assign(new Error('Image exceeds 10 MB'),{status:413});
  const suffix = { 'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif' }[match[1]];
  const filename = `${randomUUID()}.${suffix}`;
  writeFileSync(join(MEDIA_DIR, filename), bytes, { flag:'wx', mode:0o600 });
  return filename;
}
function existingMedia(filename) {
  return resolveExistingMedia(filename,MEDIA_DIR);
}
function notify(account, actor, type, entity) {
  if (account === actor) return;
  DB.prepare(`INSERT INTO notifications(id,account_id,actor_id,type,entity_id,created_at)
    VALUES(?,?,?,?,?,?)`).run(id(),account,actor,type,entity,isoNow());
}
function blockedBetween(a,b) {
  return Boolean(DB.prepare("SELECT 1 FROM edges WHERE kind='block' AND ((source_id=? AND target_id=?) OR (source_id=? AND target_id=?))")
    .get(a,b,b,a));
}
function makeSystemMd(accountIdValue) {
  const row = accountStmt.get(accountIdValue);
  const friends = DB.prepare(`SELECT a.username FROM edges e JOIN accounts a ON a.id=e.target_id
    WHERE e.source_id=? AND e.kind='friend' ORDER BY a.username`).all(row.id).map((x)=>`- @${x.username}`).join('\n') || '- No close friends yet.';
  const traits = Object.entries(JSON.parse(row.traits_json || '{}')).map(([key,value])=>`- ${key}: ${value}/100`).join('\n');
  const activity=JSON.parse(row.activity_json||'{}');
  const memories=DB.prepare(`SELECT pm.content,a.username FROM persona_memories pm LEFT JOIN accounts a ON a.id=pm.related_id WHERE pm.account_id=? ORDER BY pm.created_at DESC LIMIT 12`).all(row.id).reverse().map((item)=>`- ${item.content}${item.username?` (@${item.username})`:''}`).join('\n') || '- No recent remembered interactions.';
  const minor=row.age<18?'- Under 18: keep interactions age-appropriate; no sexual or erotic conversation, sexting, or sexual roleplay. Never engage in an adult-minor sexual approach.\n':'';
  const md = `# ${row.name} (@${row.username})\n\n## Identity\n\n- Age: ${row.age}\n- Country: ${row.country}\n- Pronouns: ${row.pronouns}\n- Bio: ${row.bio}\n- Conversation tone: ${row.tone}\n\n## Personality (0-100)\n\n${traits}\n\n## Friends\n\n${friends}\n\n## Activity rhythm\n- Posts: ${activity.postMode||'occasional'}${activity.postIntervalHours?`, every ${activity.postIntervalHours} hours`:''}\n- Stories: every ${activity.storyIntervalHours||24} hours\n- DM initiation: ${activity.dmInitiation||'only_after_contact'}\n\n## Extra notes\n\n${row.extra_notes || '- None.'}\n\n## Content boundaries\n- No sexual content in public posts, comments, or public image prompts.\n- Never create sexual imagery.\n${minor}- Write all platform content in English.\n`;
  const fullMd=md.replace('## Content boundaries', `## Recent interaction memories\n${memories}\n\n## Content boundaries`).replace('## Identity', row.alias_of ? '## Identity\n- This is an alternate account created after a block; keep the identity plausible and do not disclose the link unless directly asked.' : '## Identity');
  DB.prepare('UPDATE accounts SET system_md=? WHERE id=?').run(fullMd,row.id);
  saveSystemFile(DB,row.id);
  return fullMd;
}

export function action({ type, payload = {} }) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Object.assign(new Error('payload must be an object'),{status:400});
  let result;
  transaction(DB, () => {
    switch(type) {
      case 'profile.update': {
        const patch = payload.patch || {};
        const allowed = ['name','username','bio','pronouns'];
        for (const key of Object.keys(patch)) if (!allowed.includes(key)) throw Object.assign(new Error(`Cannot edit ${key}`),{status:400});
        const current = accountStmt.get(HUMAN_ID);
        const username=patch.username===undefined?current.username:requireText(patch.username,'username',30);
        if(!/^[a-z0-9._]+$/.test(username) || (username!==current.username && DB.prepare('SELECT 1 FROM accounts WHERE username=?').get(username))) throw Object.assign(new Error('Username must be unique and use lowercase letters, numbers, dots, or underscores'),{status:400});
        DB.prepare('UPDATE accounts SET name=?,username=?,bio=?,pronouns=? WHERE id=?').run(
          patch.name === undefined ? current.name : requireText(patch.name,'name',80),
          username,
          patch.bio === undefined ? current.bio : requireText(patch.bio,'bio',500,true),
          patch.pronouns === undefined ? current.pronouns : requireText(patch.pronouns,'pronouns',40,true), HUMAN_ID);
        result = accountView(accountStmt.get(HUMAN_ID));
        break;
      }
      case 'post.create': case 'story.create': {
        const author = accountId(payload.accountId || payload.actorId || HUMAN_ID);
        const caption = requireText(payload.caption ?? '', 'caption', 5000, true);
        const filename = payload.mediaFilename ? existingMedia(payload.mediaFilename) : mediaFile(payload.media);
        const kind = type === 'story.create' ? 'story' : 'post';
        const postId = id(); const createdAt=isoNow();
        DB.prepare('INSERT INTO posts(id,account_id,caption,media_filename,kind,created_at,expires_at) VALUES(?,?,?,?,?,?,?)')
          .run(postId,author,caption,filename,kind,createdAt,kind==='story'?new Date(Date.now()+86400000).toISOString():null);
        logEvent(DB,author,type,{postId,hasMedia:Boolean(filename)});
        result = { id:postId };
        break;
      }
      case 'follow.toggle': {
        const actor=actorId(payload);
        const target=accountId(payload.accountId || payload.targetId);
        if(target===actor) throw Object.assign(new Error('Cannot follow yourself'),{status:400});
        const existsEdge=DB.prepare("SELECT 1 FROM edges WHERE source_id=? AND target_id=? AND kind='follow'").get(actor,target);
        if(existsEdge) DB.prepare("DELETE FROM edges WHERE source_id=? AND target_id=? AND kind='follow'").run(actor,target);
        else {
          DB.prepare("INSERT INTO edges VALUES(?,?,?,?)").run(actor,target,'follow',isoNow());
          notify(target,actor,'follow',target);
          if(DB.prepare("SELECT 1 FROM edges WHERE source_id=? AND target_id=? AND kind='follow'").get(target,actor)
            && connectFriends(DB,actor,target,isoNow())) {
            for(const friendId of [actor,target]) if(!accountStmt.get(friendId).is_human) {
              const other=friendId===actor?target:actor;
              rememberPersona(DB,friendId,other,'Became close friends after a mutual follow');
              makeSystemMd(friendId);
            }
            logEvent(DB,actor,'friend.connected',{targetId:target,hook:'mutual-follow'});
          }
        }
        logEvent(DB,actor,existsEdge?'follow.removed':'follow.created',{targetId:target}); result={following:!existsEdge}; break;
      }
      case 'like.toggle': {
        const actor=actorId(payload);
        const post=DB.prepare('SELECT id,account_id FROM posts WHERE id=?').get(payload.postId);
        if(!post) throw Object.assign(new Error('Post not found'),{status:404});
        const existing=DB.prepare('SELECT 1 FROM likes WHERE post_id=? AND account_id=?').get(post.id,actor);
        if(existing) DB.prepare('DELETE FROM likes WHERE post_id=? AND account_id=?').run(post.id,actor);
        else { DB.prepare('INSERT INTO likes VALUES(?,?,?)').run(post.id,actor,isoNow()); notify(post.account_id,actor,'like',post.id); }
        logEvent(DB,actor,existing?'like.removed':'like.created',{postId:post.id}); result={liked:!existing}; break;
      }
      case 'comment.create': {
        const actor=actorId(payload);
        const post=DB.prepare('SELECT id,account_id FROM posts WHERE id=?').get(payload.postId);
        if(!post) throw Object.assign(new Error('Post not found'),{status:404});
        const content=requireText(payload.content,'content',2000);
        const parentId=payload.parentId || null;
        if(parentId && !DB.prepare('SELECT 1 FROM comments WHERE id=? AND post_id=?').get(parentId,post.id)) throw Object.assign(new Error('Parent comment not found'),{status:404});
        const commentId=id();
        DB.prepare('INSERT INTO comments VALUES(?,?,?,?,?,?)').run(commentId,post.id,actor,parentId,content,isoNow());
        notify(parentId ? DB.prepare('SELECT account_id FROM comments WHERE id=?').get(parentId).account_id : post.account_id,actor,parentId?'reply':'comment',commentId);
        logEvent(DB,actor,'comment.created',{postId:post.id,commentId,parentId}); result={id:commentId}; break;
      }
      case 'message.send': {
        const sender=actorId(payload);
        let convoId=payload.conversationId;
        let recipient;
        if(convoId) {
          const row=DB.prepare(`SELECT account_id FROM conversation_members WHERE conversation_id=? AND account_id!=?`).get(convoId,sender);
          if(!row || !DB.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND account_id=?').get(convoId,sender)) throw Object.assign(new Error('Conversation not found'),{status:404});
          recipient=row.account_id;
        } else {
          recipient=accountId(payload.recipientId);
          if(recipient===sender) throw Object.assign(new Error('Invalid recipient'),{status:400});
          convoId=DB.prepare(`SELECT c.id FROM conversations c JOIN conversation_members a ON a.conversation_id=c.id AND a.account_id=? JOIN conversation_members b ON b.conversation_id=c.id AND b.account_id=?`).get(sender,recipient)?.id;
        }
        if(blockedBetween(sender,recipient)) throw Object.assign(new Error('This conversation is blocked'),{status:403});
        const content=requireText(payload.content ?? '', 'content', 5000, true);
        const filename=mediaFile(payload.media);
        if(!content && !filename) throw Object.assign(new Error('Message needs text or an image'),{status:400});
        if(!convoId) {
          convoId=id(); DB.prepare('INSERT INTO conversations VALUES(?,?)').run(convoId,isoNow());
          DB.prepare('INSERT INTO conversation_members VALUES(?,?)').run(convoId,sender);
          DB.prepare('INSERT INTO conversation_members VALUES(?,?)').run(convoId,recipient);
        }
        const msgId=id();
        DB.prepare('INSERT INTO messages(id,conversation_id,sender_id,content,media_filename,created_at) VALUES(?,?,?,?,?,?)')
          .run(msgId,convoId,sender,content,filename,isoNow());
        notify(recipient,sender,'message',msgId); logEvent(DB,sender,'message.sent',{conversationId:convoId,messageId:msgId,hasMedia:Boolean(filename)});
        DB.prepare('UPDATE accounts SET last_contact_at=?,retry_at=NULL WHERE id=? AND is_human=0').run(isoNow(),recipient);
        for(const personId of [sender,recipient]) if(!accountStmt.get(personId).is_human) {
          const other=personId===sender?recipient:sender;
          rememberPersona(DB,personId,other,'Exchanged direct messages');
          makeSystemMd(personId);
        }
        result={id:msgId,conversationId:convoId}; break;
      }
      case 'message.delete': {
        const message=DB.prepare('SELECT * FROM messages WHERE id=?').get(payload.messageId);
        if(!message || message.sender_id!==HUMAN_ID) throw Object.assign(new Error('Message not found or not owned by you'),{status:404});
        DB.prepare('UPDATE messages SET content="",deleted_at=? WHERE id=?').run(isoNow(),message.id);
        logEvent(DB,HUMAN_ID,'message.deleted',{messageId:message.id}); result={deleted:true}; break;
      }
      case 'block.toggle': {
        const actor=actorId(payload);
        const target=accountId(payload.accountId || payload.targetId);
        if(target===actor) throw Object.assign(new Error('Cannot block yourself'),{status:400});
        const existing=DB.prepare("SELECT 1 FROM edges WHERE source_id=? AND target_id=? AND kind='block'").get(actor,target);
        if(existing) DB.prepare("DELETE FROM edges WHERE source_id=? AND target_id=? AND kind='block'").run(actor,target);
        else DB.prepare("INSERT INTO edges VALUES(?,?,?,?)").run(actor,target,'block',isoNow());
        if(actor===HUMAN_ID && !accountStmt.get(target).is_human && readSettings(DB).harassmentMode)
          DB.prepare('UPDATE accounts SET evade_due_at=? WHERE id=?').run(existing?null:isoNow(),target);
        logEvent(DB,actor,existing?'account.unblocked':'account.blocked',{targetId:target}); result={blocked:!existing}; break;
      }
      case 'report.create': {
        const targetType=payload.targetType;
        if(!['account','post','comment','message'].includes(targetType)) throw Object.assign(new Error('Invalid report target'),{status:400});
        requireText(payload.targetId,'targetId',100);
        const reason=requireText(payload.reason,'reason',1000);
        const reportId=id();
        DB.prepare('INSERT INTO reports VALUES(?,?,?,?,?,?)').run(reportId,HUMAN_ID,targetType,payload.targetId,reason,isoNow());
        logEvent(DB,HUMAN_ID,'report.created',{reportId,targetType,targetId:payload.targetId}); result={id:reportId}; break;
      }
      case 'notification.read': {
        DB.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND account_id=?').run(payload.notificationId,HUMAN_ID);
        result={read:true}; break;
      }
      case 'persona.system.update': {
        const target=accountId(payload.accountId);
        const row=accountStmt.get(target);
        if(row.is_human) throw Object.assign(new Error('Human profile has no persona system file'),{status:400});
        const patch=payload.patch || {};
        for(const key of Object.keys(patch)) if(!['tone','traits','extraNotes','friends'].includes(key)) throw Object.assign(new Error(`Cannot update ${key}`),{status:400});
        const tone=patch.tone===undefined?row.tone:requireText(patch.tone,'tone',300);
        const notes=patch.extraNotes===undefined?row.extra_notes:requireText(patch.extraNotes,'extraNotes',4000,true);
        const traits=patch.traits===undefined?JSON.parse(row.traits_json):patch.traits;
        if(!traits || typeof traits!=='object' || Array.isArray(traits) || Object.values(traits).some((n)=>!Number.isInteger(n)||n<0||n>100)) throw Object.assign(new Error('Traits must be integer values from 0 to 100'),{status:400});
        DB.prepare('UPDATE accounts SET tone=?,traits_json=?,extra_notes=? WHERE id=?').run(tone,JSON.stringify(traits),notes,target);
        if(patch.friends!==undefined) {
          if(!Array.isArray(patch.friends) || patch.friends.length>100) throw Object.assign(new Error('friends must be an array of usernames'),{status:400});
          DB.prepare("DELETE FROM edges WHERE source_id=? AND kind='friend'").run(target);
          const addFriend=DB.prepare("INSERT INTO edges(source_id,target_id,kind,created_at) SELECT ?,id,'friend',? FROM accounts WHERE username=? AND id!=? ON CONFLICT DO NOTHING");
          for(const username of patch.friends) addFriend.run(target,isoNow(),requireText(username,'friend',60),target);
        }
        const md=makeSystemMd(target); logEvent(DB,target,'persona.system.updated',{keys:Object.keys(patch)}); result={systemMd:md}; break;
      }
      case 'persona.alias.message': {
        const original=accountId(payload.accountId), recipient=accountId(payload.recipientId);
        if(!readSettings(DB).harassmentMode || recipient!==HUMAN_ID || accountStmt.get(original).is_human
          || !DB.prepare("SELECT 1 FROM edges WHERE source_id=? AND target_id=? AND kind='block'").get(recipient,original))
          throw Object.assign(new Error('Alternate-account contact is not enabled for this block'),{status:403});
        const source=accountStmt.get(original), serial=DB.prepare('SELECT COUNT(*) AS n FROM accounts WHERE alias_of=?').get(original).n+1;
        const aliasId=`alt-${id()}`, username=`${source.username}.alt${serial}`;
        const activity={postMode:'none',postIntervalHours:null,storyIntervalHours:24,dmInitiation:'only_after_contact'};
        DB.prepare(`INSERT INTO accounts(id,name,username,bio,pronouns,age,country,is_human,tone,traits_json,extra_notes,activity_json,system_md,created_at,alias_of)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(aliasId,source.name,username,source.bio,source.pronouns,source.age,source.country,0,source.tone,
            source.traits_json,`${source.extra_notes}\nAlternate account created after block.`,JSON.stringify(activity),'',isoNow(),original);
        makeSystemMd(aliasId);
        const conversationId=id(), messageId=id(), content=requireText(payload.content,'content',4000);
        DB.prepare('INSERT INTO conversations VALUES(?,?)').run(conversationId,isoNow());
        DB.prepare('INSERT INTO conversation_members VALUES(?,?)').run(conversationId,aliasId);
        DB.prepare('INSERT INTO conversation_members VALUES(?,?)').run(conversationId,recipient);
        DB.prepare('INSERT INTO messages(id,conversation_id,sender_id,content,created_at) VALUES(?,?,?,?,?)').run(messageId,conversationId,aliasId,content,isoNow());
        notify(recipient,aliasId,'message',messageId);
        logEvent(DB,aliasId,'persona.alias.created',{originalId:original,recipientId:recipient});
        logEvent(DB,aliasId,'message.sent',{conversationId,messageId,viaAlternateAccount:true});
        rememberPersona(DB,original,recipient,'Created an alternate account after being blocked');
        makeSystemMd(original);
        const rhythm=JSON.parse(source.activity_json||'{}'), dmHours=rhythm.dmInitiation==='frequent'?6:rhythm.dmInitiation==='occasional'?36:null;
        const dmDue=dmHours===null?null:new Date(Date.now()+dmHours*60*60*1000/(readSettings(DB).speedMultiplier||1)).toISOString();
        DB.prepare('UPDATE accounts SET evade_due_at=NULL,retry_count=0,retry_error=NULL,retry_at=NULL,last_dm_at=?,dm_due_at=? WHERE id=?')
          .run(isoNow(),dmDue,original);
        result={id:messageId,conversationId,accountId:aliasId}; break;
      }
      default: throw Object.assign(new Error(`Unsupported action: ${type}`),{status:400});
    }
  });
  return result;
}

const server=createServer(async (req,res)=>{
  const host=(req.headers.host||'').split(':')[0].replace(/^\[|\]$/g,'');
  if(!['127.0.0.1','localhost','::1'].includes(host)) return send(res,403,{error:'Local connections only'});
  const origin=req.headers.origin;
  if(origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return send(res,403,{error:'Origin not allowed'});
  const cors=origin?{'access-control-allow-origin':origin,'access-control-allow-credentials':'true','vary':'Origin'}:{};
  if(req.method==='OPTIONS') { res.writeHead(204,{'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type',...cors}); return res.end(); }
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    if(req.method==='GET' && url.pathname==='/api/bootstrap') return send(res,200,bootstrap(),cors);
    if(req.method==='GET' && url.pathname==='/api/simulator') return send(res,200,simulator.status,cors);
    if(req.method==='GET' && url.pathname==='/api/settings') return send(res,200,readSettings(DB),cors);
    if(req.method==='POST' && url.pathname==='/api/settings') {
      const body=await parseBody(req), patch=body.patch;
      if(!patch || typeof patch!=='object' || Array.isArray(patch) || Object.keys(patch).some((key)=>!['speedMultiplier','maxActivePersonas','harassmentMode','usShare','minAge','maxAge'].includes(key)))
        throw Object.assign(new Error('Invalid settings patch'),{status:400});
      const current=readSettings(DB), next={...current,...patch};
      if(!Number.isFinite(next.speedMultiplier)||next.speedMultiplier<0.25||next.speedMultiplier>12
        ||!Number.isInteger(next.maxActivePersonas)||next.maxActivePersonas<1||next.maxActivePersonas>10
        ||typeof next.harassmentMode!=='boolean'||!Number.isInteger(next.usShare)||next.usShare<0||next.usShare>100
        ||!Number.isInteger(next.minAge)||!Number.isInteger(next.maxAge)||next.minAge<16||next.maxAge>30||next.maxAge<next.minAge)
        throw Object.assign(new Error('Settings are outside supported ranges'),{status:400});
      const saved=writeSettings(DB,patch);
      if(patch.harassmentMode===true && current.harassmentMode===false) {
        DB.prepare(`UPDATE accounts SET evade_due_at=? WHERE id IN
          (SELECT target_id FROM edges WHERE source_id=? AND kind='block') AND is_human=0`).run(isoNow(),HUMAN_ID);
      } else if(patch.harassmentMode===false) DB.prepare('UPDATE accounts SET evade_due_at=NULL').run();
      logEvent(DB,HUMAN_ID,'settings.updated',{keys:Object.keys(patch)});
      return send(res,200,{settings:saved},cors);
    }
    if(req.method==='POST' && url.pathname==='/api/settings/apply-population') {
      const settings=readSettings(DB), people=DB.prepare('SELECT id FROM accounts WHERE is_human=0 AND alias_of IS NULL ORDER BY id').all();
      const origins=[...Array(Math.round(people.length*settings.usShare/100)).fill('United States'),...Array.from({length:people.length-Math.round(people.length*settings.usShare/100)},()=>OTHER_COUNTRIES[Math.floor(Math.random()*OTHER_COUNTRIES.length)])];
      for(let i=origins.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[origins[i],origins[j]]=[origins[j],origins[i]];}
      const update=DB.prepare('UPDATE accounts SET country=?,age=? WHERE id=?');
      transaction(DB,()=>people.forEach(({id:personId},i)=>update.run(origins[i],settings.minAge+Math.floor(Math.random()*(settings.maxAge-settings.minAge+1)),personId)));
      for(const {id:personId} of people) makeSystemMd(personId);
      logEvent(DB,HUMAN_ID,'population.distribution.applied',{profiles:people.length,usShare:settings.usShare,minAge:settings.minAge,maxAge:settings.maxAge});
      return send(res,200,{updated:people.length,usShare:settings.usShare,minAge:settings.minAge,maxAge:settings.maxAge},cors);
    }
    if(req.method==='GET' && url.pathname==='/api/events') {
      const requestedLimit=Number(url.searchParams.get('limit')||50), limit=Number.isInteger(requestedLimit)?Math.max(1,Math.min(200,requestedLimit)):50;
      const filters=[],params=[];
      if(url.searchParams.has('type')){const type=url.searchParams.get('type');if(type.length>100) throw Object.assign(new Error('Event type filter is too long'),{status:400});filters.push('e.type LIKE ?');params.push(`%${type}%`);}
      if(url.searchParams.has('actor')){const actor=url.searchParams.get('actor');if(actor.length>100) throw Object.assign(new Error('Actor filter is too long'),{status:400});filters.push('e.actor_id=?');params.push(actor);}
      if(url.searchParams.has('before')){
        const [beforeTime,beforeId]=url.searchParams.get('before').split('|');
        if(!Number.isFinite(Date.parse(beforeTime))||!beforeId||beforeId.length>100) throw Object.assign(new Error('Invalid event cursor'),{status:400});
        filters.push('(e.created_at<? OR (e.created_at=? AND e.id<?))');params.push(beforeTime,beforeTime,beforeId||'');
      }
      params.push(limit);
      const where=filters.length?`WHERE ${filters.join(' AND ')}`:'';
      const events=DB.prepare(`SELECT e.*,a.username FROM events e JOIN accounts a ON a.id=e.actor_id ${where} ORDER BY e.created_at DESC LIMIT ?`).all(...params)
        .map(({payload,...event})=>({...event,payload:JSON.parse(payload)}));
      const last=events.at(-1);
      return send(res,200,{events,nextBefore:last?`${last.created_at}|${last.id}`:null},cors);
    }
    if(req.method==='GET' && url.pathname==='/api/export') {
      const tables=['accounts','edges','posts','likes','comments','conversations','conversation_members','messages','notifications','reports','events','settings','persona_memories'];
      return send(res,200,Object.fromEntries(tables.map((table)=>[table,DB.prepare(`SELECT * FROM ${table}`).all()])),cors);
    }
    if(req.method==='GET' && url.pathname.startsWith('/api/profile/')) {
      const profile=accountView(accountStmt.get(decodeURIComponent(url.pathname.slice('/api/profile/'.length))));
      if(!profile) return send(res,404,{error:'Profile not found'},cors);
      const posts=DB.prepare("SELECT * FROM posts WHERE account_id=? AND kind='post' ORDER BY created_at DESC").all(profile.id).map(postView);
      return send(res,200,{profile,posts},cors);
    }
    if(req.method==='POST' && url.pathname==='/api/actions') return send(res,200,{ok:true,result:action(await parseBody(req))},cors);
    if(req.method==='GET' && url.pathname.startsWith('/media/')) {
      const name=basename(decodeURIComponent(url.pathname.slice('/media/'.length)));
      if(name!==url.pathname.slice('/media/'.length) || !existsSync(join(MEDIA_DIR,name))) return send(res,404,{error:'Media not found'},cors);
      const body=readFileSync(join(MEDIA_DIR,name));
      res.writeHead(200,{'content-type':({'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'})[extname(name)]||'application/octet-stream','content-length':body.length,'cache-control':'private, max-age=3600',...cors});
      return res.end(body);
    }
    return send(res,404,{error:'Not found'},cors);
  } catch(error) {
    return send(res,error.status||500,{error:error.status?error.message:'Internal server error'},cors);
  }
});

const simulator=new Simulator({db:DB,applyAction:action,mediaDir:MEDIA_DIR});
server.listen(PORT,'127.0.0.1',()=>{ simulator.start(); console.log(`Cygnet API listening on http://127.0.0.1:${PORT}`); });
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{ simulator.stop(); server.close(()=>{DB.close();process.exit(0);}); });
