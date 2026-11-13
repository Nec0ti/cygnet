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
  const aiPost = initial.posts.find((post) => post.accountId !== 'human');
  const feedPost = page.locator('.post-card').first();
  const likesBefore = Number((await feedPost.locator('.post-body b').first().innerText()).replaceAll(',', '').split(' ')[0]);
  await feedPost.getByRole('button', { name: 'Like post' }).click();
  await waitFor(async () => (await apiJson('/api/bootstrap')).value.posts.find((post) => post.id === aiPost.id)?.likedByMe, 'like persisted in SQLite');
  assert.match(await feedPost.locator('.post-body b').first().innerText(), new RegExp(String(likesBefore + 1)));
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

  await page.locator('.story').filter({ hasText: 'Your story' }).click();
  const storyComposer = page.locator('.compose-modal');
  await storyComposer.locator('input[type=file]').setInputFiles(pngPath);
  await storyComposer.getByPlaceholder('Write a caption...').fill('Chromium image story');
  await storyComposer.getByRole('button', { name: 'Share' }).click();
  const story = await waitFor(async () => (await apiJson('/api/bootstrap')).value.stories.find((item) => item.caption === 'Chromium image story'), 'story saved');
  assert.ok(story.mediaUrl);
  const firstOtherStory = initial.stories.find((item) => item.accountId !== 'human');
  const firstOtherStoryAccount = initial.accounts.find((item) => item.id === firstOtherStory.accountId);
  await page.locator('.story').filter({ hasText: firstOtherStoryAccount.username }).click();
  await page.getByRole('button', { name: 'Close story' }).click();
  check('story image creation and another account story viewer work');

  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  const edit = page.locator('.edit-modal');
  await edit.getByLabel('Name', { exact: true }).fill('Chromium Test Human');
  await edit.getByLabel('Username', { exact: true }).fill('chromium_test');
  await edit.getByLabel('Pronouns', { exact: true }).fill('they/them');
  await edit.getByLabel('Bio', { exact: true }).fill('Edited through Chromium.');
  await edit.getByRole('button', { name: 'Done' }).click();
  await waitFor(async () => (await apiJson('/api/bootstrap')).value.me.username === 'chromium_test', 'profile update persisted');
  check('own profile edit fields save through the UI');

  const target = initial.accounts[0];
  await page.getByRole('button', { name: 'Explore people' }).click();
  await page.getByRole('searchbox', { name: 'Search profiles' }).fill(target.username);
  await page.getByRole('button', { name: `View ${target.name}, @${target.username}` }).click();
  await page.getByRole('heading', { name: target.username }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Edit profile' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /NEW POST/ }).count(), 0);
  await page.getByRole('button', { name: 'Follow' }).click();
  await waitFor(async () => (await apiJson('/api/export')).value.edges.some((edge) => edge.source_id === 'human' && edge.target_id === target.id && edge.kind === 'follow'), 'follow persisted');
  check('other profile is read-only and follow works');

  await page.getByRole('button', { name: 'Block' }).click();
  await waitFor(async () => (await apiJson('/api/export')).value.edges.some((edge) => edge.source_id === 'human' && edge.target_id === target.id && edge.kind === 'block'), 'block persisted');
  const blockedMessage = await action('message.send', { actorId: 'human', recipientId: target.id, content: 'Should be blocked' });
  assert.equal(blockedMessage.response.status, 403);
  await page.getByRole('button', { name: 'Block' }).click();
  await waitFor(async () => !(await apiJson('/api/export')).value.edges.some((edge) => edge.source_id === 'human' && edge.target_id === target.id && edge.kind === 'block'), 'unblock persisted');
  await page.getByRole('button', { name: 'Message', exact: true }).click();
  const chat = page.locator('.chat-panel');
  await chat.getByPlaceholder('Message...').fill('Chromium direct message');
  await chat.getByRole('button', { name: 'Send' }).click();
  const conversation = await waitFor(async () => {
    const data = (await apiJson('/api/bootstrap')).value;
    return data.conversations.find((item) => item.account.id === target.id && item.messages.some((message) => message.content === 'Chromium direct message'));
  }, 'human-to-persona message saved');
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

  await page.getByRole('button', { name: 'Activity archive' }).click();
  const eventFilter = page.getByPlaceholder('e.g. message.sent');
  await eventFilter.fill('message.sent');
  await page.locator('.event-row').first().waitFor();
  assert.match(await page.locator('.event-row').first().innerText(), /message\.sent/);
  check('activity archive filters persisted events');

  await page.getByRole('button', { name: 'Simulation settings' }).click();
  await page.getByLabel('Activity speed').selectOption('12');
  await page.getByLabel('Concurrent persona agents').selectOption('3');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await waitFor(async () => { const value = (await apiJson('/api/settings')).value; return value.speedMultiplier === 12 && value.maxActivePersonas === 3; }, 'simulation settings saved');
  check('browser simulation settings set 12x speed and a three-persona limit');

  await page.getByRole('button', { name: 'Research workspace' }).click();
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
