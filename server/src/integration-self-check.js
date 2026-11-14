import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const temp = mkdtempSync(join(tmpdir(), 'cygnet-http-check-'));
const serverDir = new URL('.', import.meta.url).pathname.replace(/src\/$/, '');
const staticDir=join(temp,'static');
mkdirSync(join(staticDir,'assets'),{recursive:true});
writeFileSync(join(staticDir,'index.html'),'<title>Cygnet desktop test</title>');
writeFileSync(join(staticDir,'assets','app.js'),'window.cygnetReady=true');
async function freePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => probe.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

let child;
try {
  const port = await freePort(), base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['src/server.js'], {
    cwd: serverDir,
    env: { ...process.env, CYGNET_DATA_DIR: temp, CYGNET_STATIC_DIR: staticDir, CYGNET_PORT: String(port), CYGNET_TICK_MS: '3600000', CYGNET_DISABLE_SIMULATOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) throw new Error(`Test server exited early: ${output}`);
    try {
      const response = await fetch(`${base}/api/usage`);
      if (response.ok) { ready = true; break; }
    } catch {}
    await sleep(100);
  }
  assert.ok(ready, `Isolated server did not become ready: ${output}`);
  assert.match(await (await fetch(base)).text(),/Cygnet desktop test/);
  const staticAsset=await fetch(`${base}/assets/app.js`);
  assert.equal(staticAsset.headers.get('content-type'),'text/javascript; charset=utf-8');
  assert.equal(await staticAsset.text(),'window.cygnetReady=true');
  assert.match(await (await fetch(`${base}/person/u0001`)).text(),/Cygnet desktop test/,'unknown browser routes should load the SPA shell');
  assert.equal((await fetch(`${base}/api/not-a-route`)).status,404,'unknown API routes should remain API 404s');
  assert.equal((await fetch(`${base}/%2e%2e%2fsecret`)).status,404,'static paths must stay inside the packaged web directory');

  const request = async (path, method = 'GET', body, headers = {}) => {
    const response = await fetch(`${base}${path}`, {
      method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value = response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text();
    return { response, value };
  };
  const action = (type, payload) => request('/api/actions', 'POST', { type, payload });
  const bootstrapResult = await request('/api/bootstrap');
  assert.equal(bootstrapResult.value.accounts.length, 100);
  assert.equal(bootstrapResult.value.posts.length, 0, 'fresh API bootstrap has no posts or stories');
  assert.equal(bootstrapResult.value.stories.length, 0);
  const human = bootstrapResult.value.me.id, [one, two, three] = bootstrapResult.value.accounts;
  const day = new Date().toISOString().slice(0, 10);

  assert.equal((await action('profile.update', { patch: { name: 'Local Test User', bio: 'isolated' } })).response.status, 200);
  assert.equal((await action('profile.update', { patch: { is_human: false } })).response.status, 400);
  assert.equal((await action('follow.toggle', { actorId: human, targetId: one.id })).response.status, 200);
  assert.equal((await action('follow.toggle', { actorId: one.id, targetId: human })).response.status, 200);
  const post = await action('post.create', { actorId: human, caption: 'Integration test post' });
  assert.equal(post.response.status, 200);
  const imagePost = await action('post.create', { actorId: human, caption: 'Local PNG', media: { data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=' } });
  assert.equal(imagePost.response.status, 200);
  const mediaUrl = (await request('/api/bootstrap')).value.posts.find((item) => item.id === imagePost.value.result.id).mediaUrl;
  assert.equal((await fetch(`${base}${mediaUrl}`)).status, 200);
  assert.equal((await action('story.create', { actorId: human, caption: 'Temporary story' })).response.status, 200);
  assert.equal((await action('like.toggle', { actorId: one.id, postId: post.value.result.id })).response.status, 200);
  const comment = await action('comment.create', { actorId: two.id, postId: post.value.result.id, content: 'A test comment' });
  assert.equal(comment.response.status, 200);
  const personaPost = await action('post.create', { actorId: one.id, caption: 'Persona post' });
  const humanComment = await action('comment.create', { actorId: human, postId: personaPost.value.result.id, content: 'A human comment' });
  assert.equal((await action('comment.create', { actorId: three.id, postId: personaPost.value.result.id, parentId: humanComment.value.result.id, content: 'A test reply' })).response.status, 200);
  const dm = await action('message.send', { actorId: human, recipientId: one.id, content: 'Test message' });
  assert.equal(dm.response.status, 200);
  const dmAccount=(await request('/api/export')).value.accounts.find((account)=>account.id===one.id);
  assert.ok(Date.parse(dmAccount.dm_due_at)>Date.now(),'an inbound human DM schedules a persona response');
  assert.ok(Date.parse(dmAccount.human_reply_due_at)>Date.now(),'an inbound human DM retains its own reply opportunity');
  assert.ok(Date.parse(dmAccount.read_due_at)>Date.now(),'an inbound human DM schedules an independent persona read decision');
  const dmReply=await action('message.send',{actorId:one.id,recipientId:human,content:'I saw your message.'});
  assert.equal(dmReply.response.status,200);
  let dmState=(await request('/api/export')).value;
  assert.equal(dmState.accounts.find((account)=>account.id===one.id).human_reply_due_at,null,'a persona reply clears its pending human reply opportunity');
  assert.ok(Date.parse(dmState.accounts.find((account)=>account.id===one.id).human_chat_until)>Date.now(),'a persona reply opens a one-minute active chat window');
  const followup=await action('message.send',{actorId:human,conversationId:dm.value.result.conversationId,content:'What do you like to read?'});
  assert.equal(followup.response.status,200);
  dmState=(await request('/api/export')).value;
  assert.ok(Date.parse(dmState.accounts.find((account)=>account.id===one.id).human_reply_due_at)<=Date.now()+1000,'a human follow-up inside the active window is scheduled immediately');
  assert.equal((await action('message.read',{actorId:human,conversationId:dm.value.result.conversationId})).value.result.count,1);
  assert.equal((await action('message.read',{actorId:two.id,conversationId:dm.value.result.conversationId})).response.status,404);
  assert.ok((await action('message.read',{actorId:one.id,conversationId:dm.value.result.conversationId})).value.result.count>=1);
  const dmExport=(await request('/api/export')).value;
  assert.ok(dmExport.messages.find((message)=>message.id===dm.value.result.id).read_at,'AI reading a human DM persists its receipt');
  assert.ok(dmExport.messages.find((message)=>message.id===followup.value.result.id).read_at,'AI reading a rapid follow-up persists its receipt');
  assert.ok(dmExport.accounts.find((account)=>account.id===one.id).seen_due_at,'human reading an AI DM schedules a personality follow-up decision');
  const generatedBytes=Buffer.from('isolated generated DM image'),generatedFilename='generated-dm.png',generatedHash=createHash('sha256').update(generatedBytes).digest('hex');
  mkdirSync(join(temp,'media'),{recursive:true});writeFileSync(join(temp,'media',generatedFilename),generatedBytes);
  const generatedDm=await action('message.send',{actorId:one.id,recipientId:two.id,content:'Photo from AI to AI',mediaFilename:generatedFilename,imagePrompt:'A candid photo',imageSha256:generatedHash});
  assert.equal(generatedDm.response.status,200,JSON.stringify(generatedDm.value));
  assert.equal((await action('message.send',{actorId:one.id,recipientId:two.id,content:'Duplicate',mediaFilename:generatedFilename,imagePrompt:'A candid photo',imageSha256:generatedHash})).response.status,409);
  assert.equal((await action('post.create',{actorId:human,caption:'Cross-type duplicate',mediaFilename:generatedFilename,imagePrompt:'A candid photo',imageSha256:generatedHash})).response.status,409);
  const generatedMessage=(await request('/api/export')).value.messages.find((message)=>message.id===generatedDm.value.result.id);
  assert.equal(generatedMessage.image_prompt,'A candid photo');
  assert.equal(generatedMessage.image_sha256,generatedHash);
  assert.equal((await fetch(`${base}/media/${generatedMessage.media_filename}`)).status,200);
  const invalidMedia = await action('message.send', { actorId: human, recipientId: two.id, content: '', media: { data: 'data:image/png;base64,not-valid!' } });
  assert.equal(invalidMedia.response.status, 400);
  const deleted = await action('message.delete', { messageId: dm.value.result.id });
  assert.equal(deleted.response.status, 200, `message delete failed: ${JSON.stringify(deleted.value)} ${output}`);
  assert.equal((await request('/api/settings','POST',{patch:{harassmentMode:true}})).response.status,200);
  assert.equal((await action('block.toggle', { actorId: human, targetId: one.id })).response.status, 200);
  assert.equal((await action('message.send', { actorId: human, recipientId: one.id, content: 'blocked' })).response.status, 403);
  const alias=await action('persona.alias.message',{accountId:one.id,recipientId:human,content:'New account hello.',profile:{name:'Alternate Local',username:'alternate.local',bio:'A separate test identity.'},avatarFilename:generatedFilename});
  assert.equal(alias.response.status,200,JSON.stringify(alias.value));
  assert.equal((await request('/api/export')).value.accounts.find((account)=>account.id===alias.value.result.accountId)?.avatar_filename,generatedFilename);
  assert.equal((await action('block.toggle', { actorId: human, targetId: one.id })).response.status, 200);
  assert.equal((await action('report.create', { targetType: 'post', targetId: post.value.result.id, reason: 'test report' })).response.status, 200);
  assert.equal((await action('report.create', { targetType: 'invalid', targetId: post.value.result.id, reason: 'bad' })).response.status, 400);
  const beforeTone = (await request(`/api/profile/${two.id}`)).value.profile.tone;
  assert.equal((await action('persona.system.update', { accountId: two.id, patch: { tone: 'temporary', friends: 'invalid' } })).response.status, 400);
  assert.equal((await request(`/api/profile/${two.id}`)).value.profile.tone, beforeTone, 'failed action must roll back earlier updates');
  assert.equal((await action('persona.system.update', { accountId: two.id, patch: { extraNotes: 'Saved by integration test' } })).response.status, 200);
  assert.match(readFileSync(join(temp, 'personas', two.id, 'system.md'), 'utf8'), /Saved by integration test/);
  assert.equal((await action('like.toggle', { actorId: one.id, postId: 'missing' })).response.status, 404);
  assert.equal((await request(`/api/profile/missing`)).response.status, 404);

  const notifications = (await request('/api/bootstrap')).value.notifications;
  for (const type of ['follow', 'like', 'comment', 'reply']) assert.ok(notifications.some((item) => item.type === type), `missing ${type} notification`);
  const events = await request('/api/events?limit=200');
  for (const type of ['post.create', 'follow.created', 'like.created', 'comment.created', 'message.sent', 'report.created'])
    assert.ok(events.value.events.some((item) => item.type === type), `missing ${type} event`);
  const report = await request(`/api/report?from=${day}&to=${day}`);
  assert.equal(report.response.status, 200);
  assert.ok(report.value.usage.serverMs >= 0 && report.value.usage.platformMs >= 0);
  assert.equal((await request(`/api/report?from=2026-02-30&to=${day}`)).response.status, 400);
  assert.equal((await request(`/api/report.csv?from=${day}&to=${day}`)).response.status, 200);
  assert.equal((await request('/api/settings', 'POST', { patch: { maxActivePersonas: 11 } })).response.status, 400);
  const experiment = await request('/api/experiments', 'POST', { label: 'Integration cohort', cohortA: [one.id], cohortB: [two.id] });
  assert.equal(experiment.response.status, 201);
  assert.equal((await request('/api/settings', 'POST', { patch: { speedMultiplier: 2 } })).response.status, 409);
  const finished = await request(`/api/experiments/${experiment.value.experiment.id}/finish`, 'POST');
  assert.equal(finished.response.status, 200);
  assert.equal(finished.value.comparison.cohorts.a.accounts, 1);
  assert.equal((await request(`/api/replay?from=${day}T00:00:00.000Z&to=${day}T23:59:59.999Z&limit=50`)).response.status, 200);
  assert.equal((await request('/api/replay?from=invalid&to=invalid')).response.status, 400);
  const exported = await request('/api/export');
  for (const table of ['server_runtime_runs', 'platform_sessions', 'usage_state']) assert.ok(table in exported.value);
  assert.equal((await request('/api/usage/sessions/heartbeat', 'POST', { sessionId: 'bad', active: true })).response.status, 400);
  assert.equal((await request('/api/usage/sessions/heartbeat', 'POST', { sessionId: '01234567-89ab-cdef', active: 'yes' })).response.status, 400);
  assert.equal((await request('/api/usage/sessions/heartbeat', 'POST', { sessionId: '01234567-89ab-cdef', active: true })).response.status, 404);
  const session = '01234567-89ab-cdef-0123-456789abcdef';
  const baseline = (await request('/api/usage')).value.platformMs;
  assert.equal((await request('/api/usage/sessions/start', 'POST', { sessionId: session, active: true })).response.status, 200);
  await sleep(80);
  assert.equal((await request('/api/usage/sessions/heartbeat', 'POST', { sessionId: session, active: false })).response.status, 200);
  const afterSession = (await request('/api/usage')).value;
  assert.ok(afterSession.platformMs > baseline);
  assert.equal(afterSession.activeSessions, 0);
  assert.equal((await request('/api/usage/sessions/end', 'POST', { sessionId: session })).response.status, 200);
  assert.equal((await request('/api/bootstrap', 'GET', undefined, { origin: 'http://malicious.test' })).response.status, 403);

  const firstTotal = (await request('/api/usage')).value.serverMs;
  assert.ok(firstTotal > 0);
  child.kill('SIGTERM');
  const firstExit = await new Promise((resolve) => child.once('exit', (code) => resolve(code)));
  assert.equal(firstExit, 0, `graceful shutdown failed: ${output}`);
  child = spawn(process.execPath, ['src/server.js'], {
    cwd: serverDir,
    env: { ...process.env, CYGNET_DATA_DIR: temp, CYGNET_STATIC_DIR: staticDir, CYGNET_PORT: String(port), CYGNET_TICK_MS: '3600000', CYGNET_DISABLE_SIMULATOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let restartedReady = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) throw new Error('Server failed to restart against its checkpoint DB');
    try {
      const response = await fetch(`${base}/api/usage`);
      if (response.ok) { const usage = await response.json(); assert.ok(usage.serverMs >= firstTotal); restartedReady = true; break; }
    } catch {}
    await sleep(100);
  }
  assert.ok(restartedReady);
  child.kill('SIGTERM');
  assert.equal(await new Promise((resolve) => child.once('exit', (code) => resolve(code))), 0);
  child = null;
  console.log('Isolated HTTP integration, packaged static UI, action matrix, usage session, and restart checks passed.');
} finally {
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await new Promise((resolve) => child.once('exit', resolve)); }
  rmSync(temp, { recursive: true, force: true });
}
