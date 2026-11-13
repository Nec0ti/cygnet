import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from '../web/node_modules/playwright/index.mjs';
import { openStore } from '../server/src/store.js';
import { seedStore } from '../server/src/seed.js';

const root = resolve(new URL('..', import.meta.url).pathname);
const temp = mkdtempSync(join(tmpdir(), 'cygnet-browser-e2e-'));
const serverDir = join(root, 'server'), webDir = join(root, 'web');
const pngPath = join(temp, 'browser-upload.png');
writeFileSync(pngPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=', 'base64'));

async function freePort() {
  const probe = createServer();
  await new Promise((resolveListen, reject) => probe.listen(0, '127.0.0.1', resolveListen).once('error', reject));
  const { port } = probe.address();
  await new Promise((resolveClose) => probe.close(resolveClose));
  return port;
}

function launch(command, args, options) {
  const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  child.output = '';
  child.stdout.on('data', (chunk) => { child.output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { child.output += chunk.toString(); });
  return child;
}

async function waitFor(predicate, label, timeoutMs = 20_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = await predicate().catch(() => null);
    if (value) return value;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolveExit) => child.once('exit', resolveExit)), sleep(8_000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

let api, web, browser;
const checks = [];
const check = (name) => { checks.push(name); console.log(`PASS ${name}`); };
try {
  const dataDir = join(temp, 'data');
  const db = openStore(join(dataDir, 'cygnet.sqlite'));
  seedStore(db, { dataRoot: dataDir });
  db.prepare(`UPDATE accounts SET post_due_at=NULL,story_due_at=NULL,dm_due_at=NULL,engagement_due_at=NULL,
    evade_due_at=NULL,retry_at=NULL WHERE is_human=0`).run();
  db.close();

  const apiPort = await freePort();
  let webPort = await freePort();
  if (webPort === apiPort) webPort = await freePort();
  const env = { ...process.env, CYGNET_DATA_DIR: dataDir, CYGNET_PORT: String(apiPort), CYGNET_TICK_MS: '1000', CYGNET_DISABLE_SIMULATOR: '1' };
  api = launch(process.execPath, ['src/server.js'], { cwd: serverDir, env });
  web = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], {
    cwd: webDir, env: { ...env, CYGNET_WEB_PORT: String(webPort) },
  });
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const webUrl = `http://127.0.0.1:${webPort}`;
  await waitFor(async () => { if (api.exitCode !== null) throw new Error(api.output); const response = await fetch(`${apiUrl}/api/bootstrap`); return response.ok; }, 'API readiness');
  await waitFor(async () => { if (web.exitCode !== null) throw new Error(web.output); const response = await fetch(webUrl); return response.ok; }, 'Vite readiness');

  const apiJson = async (path, method = 'GET', body) => {
    const response = await fetch(`${apiUrl}${path}`, {
      method, headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value = response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text();
    return { response, value };
  };
  const action = (type, payload) => apiJson('/api/actions', 'POST', { type, payload });
  const browserOptions = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  if (process.env.CYGNET_CHROMIUM) browserOptions.executablePath = process.env.CYGNET_CHROMIUM;
  browser = await chromium.launch(browserOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(webUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Home' }).waitFor();
  assert.equal(await page.getByText('Demo data').count(), 0, 'browser must be connected to the local API');
  check('real Chromium loads the API-backed home feed');

  const initial = (await apiJson('/api/bootstrap')).value;
  assert.equal(initial.me.followers, 0);
  assert.equal(initial.me.following, 0);
  assert.ok(initial.accounts.every((account) => account.avatarUrl && account.followers === 0 && account.following === 0));
  assert.equal(initial.posts.length, 0, 'a newly launched platform must not contain prewritten posts');
  assert.equal(initial.stories.length, 0, 'a newly launched platform must not contain prewritten stories');
  assert.equal(await page.locator('.post-card').count(), 0, 'the initial home feed must be empty');
  assert.equal(initial.stories.every((story) => story.accountId === 'human'), true, 'unfollowed AI stories must be private to their followers');
  assert.equal(new Set(initial.accounts.map((account) => account.avatarUrl)).size, 100, 'the first 100 personas need distinct portraits');
  for (const account of initial.accounts) assert.equal((await fetch(`${apiUrl}${account.avatarUrl}`)).status, 200);
  check('fresh profiles have real zero follow counts and working raster avatars');
  assert.match(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), /\d+/);
  const darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.ok(darkBackground.split(',').slice(0,3).map((part)=>Number(part.replace(/\D/g,''))).every((channel)=>channel<80), `default theme should be dark: ${darkBackground}`);
  check('default theme uses a dark, readable canvas');
  const aiPostResult = await action('post.create', { actorId: initial.accounts[0].id, caption: 'AI launch post' });
  assert.equal(aiPostResult.response.status, 200);
  const aiPost = (await apiJson('/api/bootstrap')).value.posts.find((post) => post.id === aiPostResult.value.result.id);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.post-card').first().waitFor();
  check('fresh launch is empty, then a post appears only after an explicit persona publish action');
  const feedPost = page.locator('.post-card').first();
  await feedPost.getByRole('button', { name: 'Like post' }).click();
  await waitFor(async () => (await apiJson('/api/bootstrap')).value.posts.find((post) => post.id === aiPost.id)?.likedByMe, 'like persisted in SQLite');
  assert.equal(await feedPost.locator('.post-body b').first().innerText(), '1 likes');
  check('feed like toggles and persists');

  const commentText = 'Chromium comment flow';
  await feedPost.getByPlaceholder('Add a comment...').fill(commentText);
  await feedPost.getByRole('button', { name: 'Post', exact: true }).click();
  await waitFor(async () => (await apiJson('/api/bootstrap')).value.posts.find((post) => post.id === aiPost.id)?.comments.some((comment) => comment.content === commentText), 'comment persisted in SQLite');
  check('feed comment submits and persists');

  await page.getByRole('button', { name: 'Create' }).first().click();
  const compose = page.locator('.compose-modal');
  await compose.locator('input[type=file]').setInputFiles(pngPath);
  await compose.getByPlaceholder('Write a caption...').fill('Chromium image post');
  await compose.getByRole('button', { name: 'Share' }).click();
  const imagePost = await waitFor(async () => (await apiJson('/api/bootstrap')).value.posts.find((post) => post.caption === 'Chromium image post'), 'image post saved');
  assert.ok(imagePost.mediaUrl);
  assert.equal((await fetch(`${apiUrl}${imagePost.mediaUrl}`)).status, 200);
  check('browser image upload creates a post and serves its media');

  await page.locator('.story').first().click();
  const storyComposer = page.locator('.compose-modal');
  await storyComposer.locator('input[type=file]').setInputFiles(pngPath);
  await storyComposer.getByPlaceholder('Write a caption...').fill('Chromium image story');
  await storyComposer.getByRole('button', { name: 'Share' }).click();
  const story = await waitFor(async () => (await apiJson('/api/bootstrap')).value.stories.find((item) => item.caption === 'Chromium image story'), 'story saved');
  assert.ok(story.mediaUrl);
  const firstOtherStoryAccount = initial.accounts[1];
  const aiStoryResult = await action('story.create', { actorId: firstOtherStoryAccount.id, caption: 'AI launch story' });
  assert.equal(aiStoryResult.response.status, 200);
  const firstOtherStory = (await apiJson('/api/export')).value.posts.find((item) => item.id === aiStoryResult.value.result.id);
  assert.equal((await apiJson('/api/bootstrap')).value.stories.some((item) => item.id === firstOtherStory.id), false, 'unfollowed AI story stays hidden');
  assert.equal((await action('follow.toggle', { actorId: 'human', targetId: firstOtherStory.account_id })).response.status, 200);
  await waitFor(async () => (await apiJson('/api/bootstrap')).value.stories.some((item) => item.id === firstOtherStory.id), 'followed story visibility');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.story').filter({ hasText: firstOtherStoryAccount.username }).click();
  await page.getByRole('button', { name: 'Close story' }).click();
  assert.equal((await action('follow.toggle', { actorId: 'human', targetId: firstOtherStory.account_id })).response.status, 200);
  await waitFor(async () => !(await apiJson('/api/bootstrap')).value.stories.some((item) => item.id === firstOtherStory.id), 'unfollow hides story');
  check('stories are visible only while following and can be opened in the viewer');

  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  const edit = page.locator('.edit-modal');
  await edit.locator('input[type=file]').setInputFiles(pngPath);
  await edit.locator('.avatar-upload img').waitFor();
  await edit.getByLabel('Name', { exact: true }).fill('Chromium Test Human');
  await edit.getByLabel('Username', { exact: true }).fill('chromium_test');
  await edit.getByLabel('Pronouns', { exact: true }).fill('they/them');
  await edit.getByLabel('Bio', { exact: true }).fill('Edited through Chromium.');
  await edit.getByRole('button', { name: 'Done' }).click();
  const updatedHuman = await waitFor(async () => { const me = (await apiJson('/api/bootstrap')).value.me; return me.username === 'chromium_test' && me.avatarUrl ? me : null; }, 'profile and avatar update persisted');
  assert.equal((await fetch(`${apiUrl}${updatedHuman.avatarUrl}`)).status, 200);
  check('own profile fields and uploaded avatar save through the UI');

  const target = initial.accounts[0];
  await page.getByRole('button', { name: 'Explore people' }).click();
  await page.getByRole('searchbox', { name: 'Search profiles' }).fill(target.username);
  await page.getByRole('button', { name: `View ${target.name}, @${target.username}` }).click();
  await page.getByRole('heading', { name: target.username }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Edit profile' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /NEW POST/ }).count(), 0);
  await page.getByRole('button', { name: 'Follow' }).click();
  await waitFor(async () => (await apiJson('/api/export')).value.edges.some((edge) => edge.source_id === 'human' && edge.target_id === target.id && edge.kind === 'follow'), 'follow persisted');
  await waitFor(async () => { const profile = (await apiJson('/api/bootstrap')).value; return profile.me.following === 1 && profile.accounts.find((account) => account.id === target.id)?.followers === 1; }, 'follow counts reflect relationship');
  check('other profile is read-only and follow works');

  await page.getByRole('button', { name: 'Block' }).click();
  await waitFor(async () => (await apiJson('/api/export')).value.edges.some((edge) => edge.source_id === 'human' && edge.target_id === target.id && edge.kind === 'block'), 'block persisted');
  const blockedMessage = await action('message.send', { actorId: 'human', recipientId: target.id, content: 'Should be blocked' });
  assert.equal(blockedMessage.response.status, 403);
  await page.getByRole('button', { name: 'Unblock' }).click();
  await waitFor(async () => !(await apiJson('/api/export')).value.edges.some((edge) => edge.source_id === 'human' && edge.target_id === target.id && edge.kind === 'block'), 'unblock persisted');
  await page.getByRole('button', { name: 'Message', exact: true }).click();
  const chat = page.locator('.chat-panel');
  await chat.getByPlaceholder('Message...').fill('Chromium direct message');
  await chat.getByRole('button', { name: 'Send' }).click();
  const conversation = await waitFor(async () => {
    const data = (await apiJson('/api/bootstrap')).value;
    return data.conversations.find((item) => item.account.id === target.id && item.messages.some((message) => message.content === 'Chromium direct message'));
  }, 'human-to-persona message saved');
  const aiReply=await action('message.send',{actorId:target.id,recipientId:'human',content:'I saw your message.'});
  assert.equal(aiReply.response.status,200);
  await chat.getByText('I saw your message.',{exact:true}).waitFor({timeout:7_000});
  await waitFor(async()=>{
    const latest=(await apiJson('/api/bootstrap')).value.conversations.find((item)=>item.id===conversation.id);
    return latest?.messages.find((message)=>message.id===aiReply.value.result.id)?.readAt;
  },'opening a DM persists the human read receipt');
  assert.equal((await action('message.read',{actorId:target.id,conversationId:conversation.id})).response.status,200);
  await waitFor(async()=>{
    const latest=(await apiJson('/api/bootstrap')).value.conversations.find((item)=>item.id===conversation.id);
    return latest?.messages.find((message)=>message.content==='Chromium direct message')?.readAt;
  },'persona reads the incoming human message');
  await chat.locator('.message-bubble.me').filter({hasText:'Chromium direct message'}).getByText('Seen',{exact:true}).waitFor();
  check('DM screen refreshes replies and displays the persona read receipt');
  check('blocked DM is rejected; unblocked human-to-persona text DM works');
  await chat.locator('.chat-header').getByRole('button', { name: 'View profile' }).click();
  await page.getByRole('heading', { name: target.username }).waitFor();
  await page.getByRole('button', { name: 'Messages' }).click();
  await chat.getByPlaceholder('Message...').waitFor();
  check('DM header opens the other profile and returns to the conversation');

  await chat.locator('.message-form input[type=file]').setInputFiles(pngPath);
  const imageMessage = await waitFor(async () => {
    const data = (await apiJson('/api/bootstrap')).value;
    return data.conversations.find((item) => item.id === conversation.id)?.messages.find((message) => message.mediaUrl);
  }, 'DM image upload saved');
  assert.equal((await fetch(`${apiUrl}${imageMessage.mediaUrl}`)).status, 200);
  const bubble = chat.locator('.message-bubble.me').filter({ hasText: 'Chromium direct message' });
  await bubble.getByRole('button', { name: 'Delete' }).click();
  await page.getByText('Message deleted').waitFor();
  await waitFor(async () => (await apiJson('/api/export')).value.messages.find((message) => message.id === conversation.messages.find((item) => item.content === 'Chromium direct message').id)?.deleted_at, 'message deletion persisted');
  check('DM image attachment, media serving, and message deletion work');

  const humanComment = await action('comment.create', { actorId: 'human', postId: aiPost.id, content: 'Notification parent comment' });
  assert.equal(humanComment.response.status, 200);
  assert.equal((await action('comment.create', { actorId: initial.accounts[1].id, postId: aiPost.id, parentId: humanComment.value.result.id, content: 'Notification reply' })).response.status, 200);
  assert.equal((await action('follow.toggle', { actorId: initial.accounts[2].id, targetId: 'human' })).response.status, 200);
  assert.equal((await action('like.toggle', { actorId: initial.accounts[2].id, postId: imagePost.id })).response.status, 200);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Home' }).waitFor();
  await page.getByRole('button', { name: 'Notifications' }).click();
  await page.getByRole('heading', { name: 'Notifications' }).waitFor();
  await page.getByText('started following you.').waitFor();
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await waitFor(async () => (await apiJson('/api/bootstrap')).value.notifications.every((item) => item.isRead), 'notifications marked read');
  check('follow, like, comment/reply notifications render and mark read');

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Activity archive' }).click();
  const eventFilter = page.getByPlaceholder('e.g. message.sent');
  await eventFilter.fill('message.sent');
  await page.locator('.event-row').first().waitFor();
  assert.match(await page.locator('.event-row').first().innerText(), /message\.sent/);
  check('activity archive filters persisted events');

  assert.equal((await action('report.create', { targetType: 'post', targetId: imagePost.id, reason: 'Admin review test' })).response.status, 200);
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Admin workspace' }).click();
  await page.getByRole('heading', { name: 'Admin workspace' }).waitFor();
  await page.getByText('Personas').waitFor();
  const adminPerson = page.locator('.admin-person').filter({ hasText: target.username });
  await adminPerson.getByRole('button', { name: 'Pause' }).click();
  await waitFor(async () => (await apiJson('/api/admin')).value.personas.find((person) => person.id === target.id)?.isPaused, 'admin persona pause');
  await adminPerson.getByRole('button', { name: target.name }).click();
  await page.getByLabel('Extra persona notes').fill('Saved from the admin workspace.');
  await page.getByRole('button', { name: 'Save persona and system.md' }).click();
  await waitFor(async () => (await apiJson('/api/admin')).value.personas.find((person) => person.id === target.id)?.extraNotes.includes('Saved from the admin workspace.'), 'admin system.md edit');
  const reportSelect = page.locator('.admin-report').filter({ hasText: 'Admin review test' }).getByRole('combobox');
  await reportSelect.selectOption('reviewed');
  await waitFor(async () => (await apiJson('/api/admin')).value.reports.some((report) => report.reason === 'Admin review test' && report.status === 'reviewed'), 'admin report review');
  page.once('dialog', (dialog) => dialog.accept());
  const adminPost = page.locator('.admin-content').filter({ hasText: 'Chromium image post' });
  await adminPost.getByRole('button', { name: 'Delete' }).click();
  await waitFor(async () => !(await apiJson('/api/admin')).value.posts.some((post) => post.caption === 'Chromium image post'), 'admin post deletion');
  check('admin workspace inspects metrics, edits personas, reviews reports, and deletes content');

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Simulation settings' }).click();
  await page.getByLabel('Activity speed').selectOption('12');
  await page.getByLabel('Concurrent persona agents').selectOption('3');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await waitFor(async () => { const value = (await apiJson('/api/settings')).value; return value.speedMultiplier === 12 && value.maxActivePersonas === 3; }, 'simulation settings saved');
  check('browser simulation settings set 12x speed and a three-persona limit');

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Research workspace' }).click();
  await page.getByRole('button', { name: 'Build report' }).click();
  await page.getByRole('heading', { name: 'Daily activity' }).waitFor();
  const csvHref = await page.getByRole('link', { name: 'Download CSV' }).getAttribute('href');
  const csv = await fetch(`${apiUrl}${csvHref}`).then((response) => response.text());
  assert.match(csv, /usage_snapshot/);
  await page.getByRole('button', { name: 'Cohort experiments' }).click();
  await page.getByLabel('Experiment name').fill('Chromium cohort flow');
  const pickers = page.locator('.cohort-picker');
  await pickers.nth(0).locator('input[type=checkbox]').nth(0).check();
  await pickers.nth(1).locator('input[type=checkbox]').nth(1).check();
  await page.getByRole('button', { name: 'Start experiment' }).click();
  const experimentRow = page.locator('.experiment-row').filter({ hasText: 'Chromium cohort flow' });
  await experimentRow.waitFor();
  await experimentRow.getByRole('button', { name: 'End' }).click();
  await experimentRow.getByRole('button', { name: 'Compare' }).click();
  await page.getByRole('region', { name: 'Comparison for Chromium cohort flow' }).waitFor();
  await page.getByRole('button', { name: 'Event replay' }).click();
  const eventCountBeforeReplay = (await apiJson('/api/export')).value.events.length;
  await page.getByRole('button', { name: 'Load events' }).click();
  await page.locator('.replay-current').waitFor();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await sleep(1_000);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  assert.equal((await apiJson('/api/export')).value.events.length, eventCountBeforeReplay, 'replay must not repeat actions');
  check('research report/CSV, cohort start/end/compare, and read-only event replay work');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Activity archive' }).click();
  await page.getByRole('heading', { name: 'Activity archive' }).waitFor();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Research workspace' }).click();
  await page.getByRole('heading', { name: 'Research workspace' }).waitFor();
  check('mobile More menu reaches archive and research pages');

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Reset simulation' }).click();
  const reset = page.getByRole('dialog', { name: 'Reset simulation?' });
  await reset.getByRole('button', { name: 'Cancel' }).click();
  assert.equal(await page.locator('.reset-modal').count(), 0, 'first confirmation can cancel without changes');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Reset simulation' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  const secondReset = page.getByRole('dialog', { name: 'Are you absolutely sure?' });
  const minutesText = await secondReset.locator('.reset-minute-count strong').innerText();
  assert.match(minutesText, /^\d+ minutes$/);
  const resetMinutes = minutesText.match(/\d+/)[0];
  const confirmReset = secondReset.getByRole('button', { name: 'Reset simulation' });
  assert.equal(await confirmReset.isDisabled(), true);
  await secondReset.getByLabel('Confirmation minutes').fill(`${resetMinutes}1`);
  assert.equal(await confirmReset.isDisabled(), true);
  await secondReset.getByLabel('Confirmation minutes').fill(resetMinutes);
  await confirmReset.click();
  await page.getByRole('heading', { name: 'Home' }).waitFor();
  const afterReset = (await apiJson('/api/bootstrap')).value;
  assert.equal(afterReset.me.username, 'chromium_test');
  assert.equal(afterReset.me.followers, 0);
  assert.equal(afterReset.me.following, 0);
  assert.ok(afterReset.me.avatarUrl);
  assert.equal(afterReset.accounts.length, 100);
  assert.equal(afterReset.posts.length, 0);
  assert.equal(afterReset.stories.length, 0);
  assert.equal(afterReset.conversations.length, 0);
  assert.equal((await apiJson('/api/settings')).value.speedMultiplier, 1);
  assert.ok((await apiJson('/api/usage')).value.platformMs < 1_000, 'the reset platform clock starts near zero and resumes immediately');
  check('two-step reset preserves human profile and restores profiles with an empty feed and zeroed counters');

  assert.deepEqual(pageErrors, [], `uncaught browser errors: ${pageErrors.join('; ')}`);
  await page.screenshot({ path: join(temp, 'browser-e2e-final.png'), fullPage: true });
  console.log(`Browser E2E passed: ${checks.length}/${checks.length} checks using Chromium ${await browser.version()}.`);
} catch (error) {
  console.error(error);
  if (api?.output) console.error('API log:', api.output.slice(-4000));
  if (web?.output) console.error('Web log:', web.output.slice(-2000));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  await stop(web);
  await stop(api);
  rmSync(temp, { recursive: true, force: true });
}
