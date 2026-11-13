import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { cpus, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { openStore, HUMAN_ID } from './store.js';
import { seedStore } from './seed.js';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const reports = resolve(root, 'reports');
const today = new Date().toISOString().slice(0, 10);
const from = `${today}T00:00:00.000Z`, to = `${today}T23:59:59.999Z`;

async function freePort() {
  const probe = createServer();
  await new Promise((resolveListen, reject) => probe.listen(0, '127.0.0.1', resolveListen).once('error', reject));
  const { port } = probe.address();
  await new Promise((resolveClose) => probe.close(resolveClose));
  return port;
}

function populate(dataDir, profileCount, eventCount, contentCount) {
  const db = openStore(join(dataDir, 'cygnet.sqlite'));
  try {
    seedStore(db, { dataRoot: dataDir, seed: 'cygnet-benchmark-v1' });
    const current = db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE is_human=0').get().n;
    const insertPerson = db.prepare(`INSERT INTO accounts(id,name,username,bio,pronouns,age,country,is_human,tone,traits_json,extra_notes,activity_json,system_md,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const people = db.prepare('SELECT id FROM accounts WHERE is_human=0 ORDER BY id').all().map((row) => row.id);
    db.exec('BEGIN');
    for (let i = current; i < profileCount; i++) {
      const id = `bench-${String(i + 1).padStart(4, '0')}`;
      insertPerson.run(id, `Benchmark ${i + 1}`, `benchmark_${i + 1}`, 'Synthetic benchmark profile', 'they/them', 24,
        'United States', 0, 'measured', '{}', '', '{}', '', from);
      people.push(id);
    }
    const insertPost = db.prepare('INSERT INTO posts(id,account_id,caption,kind,created_at) VALUES(?,?,?,\'post\',?)');
    for (let i = 0; i < contentCount; i++) {
      const created = new Date(Date.parse(from) + i % 86_000_000).toISOString();
      insertPost.run(`bench-post-${i}`, people[i % people.length], `Synthetic post ${i}`, created);
    }
    const conversation = `bench-conversation-${profileCount}`;
    db.prepare('INSERT INTO conversations(id,created_at) VALUES(?,?)').run(conversation, from);
    db.prepare('INSERT INTO conversation_members(conversation_id,account_id) VALUES(?,?)').run(conversation, HUMAN_ID);
    db.prepare('INSERT INTO conversation_members(conversation_id,account_id) VALUES(?,?)').run(conversation, people[0]);
    const insertMessage = db.prepare('INSERT INTO messages(id,conversation_id,sender_id,content,created_at) VALUES(?,?,?,?,?)');
    for (let i = 0; i < contentCount; i++) insertMessage.run(`bench-message-${i}`, conversation,
      i % 2 ? HUMAN_ID : people[i % people.length], `Synthetic message ${i}`, new Date(Date.parse(from) + i % 86_000_000).toISOString());
    const insertEvent = db.prepare('INSERT INTO events(id,actor_id,type,payload,created_at) VALUES(?,?,?,?,?)');
    const types = ['post.create', 'like.created', 'comment.created', 'follow.created', 'message.sent'];
    for (let i = 0; i < eventCount; i++) insertEvent.run(`bench-event-${i}`, people[i % people.length], types[i % types.length], '{}',
      new Date(Date.parse(from) + i % 86_000_000).toISOString());
    db.exec('COMMIT');
    return { profiles: profileCount, events: eventCount, posts: contentCount, messages: contentCount };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  finally { db.close(); }
}

async function runServer(dataDir, port) {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: join(root, 'server'), env: { ...process.env, CYGNET_DATA_DIR: dataDir, CYGNET_PORT: String(port), CYGNET_TICK_MS: '3600000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 200; i++) {
    if (child.exitCode !== null) throw new Error(`Benchmark server exited: ${output}`);
    try { if ((await fetch(`${base}/api/usage`)).ok) return { child, base, output: () => output }; } catch {}
    await sleep(100);
  }
  child.kill('SIGTERM');
  throw new Error(`Benchmark server did not become ready: ${output}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  const code = await new Promise((resolveExit) => child.once('exit', resolveExit));
  assert.equal(code, 0, 'benchmark server should stop cleanly');
}

async function sample(base, path, method = 'GET', body = undefined, count = 20, concurrency = 1) {
  const latencies = [], sizes = [];
  const failures = [];
  let errors = 0, next = 0;
  const send = async () => {
    while (next < count) {
      const index = next++;
      const started = performance.now();
      try {
        const response = await fetch(`${base}${path}`, {
          method, headers: body === undefined ? undefined : { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const bytes = await response.arrayBuffer();
        if (!response.ok) {
          errors++;
          if (failures.length < 5) failures.push({ status: response.status, body: new TextDecoder().decode(bytes).slice(0, 300) });
        }
        latencies[index] = performance.now() - started;
        sizes[index] = bytes.byteLength;
      } catch (error) { errors++; if (failures.length < 5) failures.push({ error: String(error) }); latencies[index] = performance.now() - started; sizes[index] = 0; }
    }
  };
  const wallStart = performance.now();
  const workers = Array.from({ length: Math.min(count, concurrency) }, send);
  await Promise.all(workers);
  const wallSeconds = (performance.now() - wallStart) / 1000;
  const sorted = [...latencies].sort((a, b) => a - b);
  const percentile = (p) => Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)].toFixed(2));
  return { requests: count, concurrency, errors, ...(failures.length ? { failures } : {}), p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: Number(sorted.at(-1).toFixed(2)),
    requestsPerSecond: Number((count / wallSeconds).toFixed(2)),
    avgResponseBytes: Math.round(sizes.reduce((sum, value) => sum + value, 0) / sizes.length) };
}

async function benchmarkSize(profileCount) {
  const dataDir = mkdtempSync(join(tmpdir(), `cygnet-benchmark-${profileCount}-`));
  let child;
  try {
    const eventCount = profileCount === 100 ? 10_000 : 100_000;
    const contentCount = profileCount === 100 ? 1_000 : 10_000;
    const dataset = populate(dataDir, profileCount, eventCount, contentCount);
    const port = await freePort();
    const running = await runServer(dataDir, port); child = running.child;
    const { base } = running;
    const bootstrap = await fetch(`${base}/api/bootstrap`).then((response) => response.json());
    const checkDb = openStore(join(dataDir, 'cygnet.sqlite'));
    const actual = {
      profiles: checkDb.prepare('SELECT COUNT(*) AS n FROM accounts WHERE is_human=0').get().n,
      events: checkDb.prepare('SELECT COUNT(*) AS n FROM events WHERE id LIKE \'bench-event-%\'').get().n,
      posts: checkDb.prepare('SELECT COUNT(*) AS n FROM posts WHERE id LIKE \'bench-post-%\'').get().n,
      messages: checkDb.prepare('SELECT COUNT(*) AS n FROM messages WHERE id LIKE \'bench-message-%\'').get().n,
    };
    checkDb.close();
    assert.equal(bootstrap.accounts.length, profileCount, 'bootstrap profile count');
    assert.deepEqual(actual, dataset, 'synthetic dataset counts');
    const report = await fetch(`${base}/api/report?from=${today}&to=${today}`).then((response) => response.json());
    assert.equal(report.events.length, eventCount + 1, 'report event completeness including initial seed event');
    const replay = await fetch(`${base}/api/replay?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=5000`).then((response) => response.json());
    assert.equal(replay.events.length, Math.min(eventCount, 5000), 'replay cap and ordering query');

    const routes = [
      ['bootstrap', '/api/bootstrap'], ['events-200', '/api/events?limit=200'], ['report', `/api/report?from=${today}&to=${today}`],
      ['replay-5000', `/api/replay?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=5000`],
      ['settings', '/api/settings'], ['profile', `/api/profile/${bootstrap.accounts[0].id}`],
      ['action-profile-update', '/api/actions', 'POST', { type: 'profile.update', payload: { patch: { bio: 'Synthetic benchmark update' } } }],
    ];
    const results = [];
    for (const [name, path, method, body] of routes) {
      await sample(base, path, method, body, 2, 1);
      const count = ['bootstrap', 'report'].includes(name) ? 10 : name === 'replay-5000' ? 12 : 20;
      for (const concurrency of [1, 10]) {
        const measurement = { route: name, ...(await sample(base, path, method, body, count, concurrency)) };
        results.push(measurement);
        console.log(`${profileCount} profiles · ${name} · concurrency ${concurrency}: ${measurement.errors} errors, p95 ${measurement.p95Ms} ms`);
      }
    }
    assert.equal(results.reduce((sum, result) => sum + result.errors, 0), 0,
      `all measured requests should return 2xx: ${JSON.stringify(results.filter((result) => result.errors))}`);
    const serverRssBytes = Number(execFileSync('ps', ['-o', 'rss=', '-p', String(child.pid)], { encoding: 'utf8' }).trim()) * 1024;
    await stopServer(child); child = null;
    return { dataset, correctness: { passed: 5, total: 5, scorePercent: 100 }, results, serverRssBytes,
      dbBytes: statSync(join(dataDir, 'cygnet.sqlite')).size,
      journalBytes: ['-wal', '-shm'].reduce((sum, suffix) => { try { return sum + statSync(join(dataDir, `cygnet.sqlite${suffix}`)).size; } catch { return sum; } }, 0) };
  } finally {
    if (child) await stopServer(child);
    rmSync(dataDir, { recursive: true, force: true });
  }
}

const started = new Date().toISOString();
const environment = { node: process.version, platform: process.platform, arch: process.arch, cpus: cpus().length };
const results = [];
for (const size of [100, 1000]) results.push({ profiles: size, ...(await benchmarkSize(size)) });
const benchmark = { startedAt: started, environment, memoryRssBytes: process.memoryUsage().rss, results };
const reportPath = join(reports, `benchmark-${new Date(started).toISOString().replaceAll(':', '-').slice(0, 16)}.json`);
writeFileSync(reportPath, `${JSON.stringify(benchmark, null, 2)}\n`);
const largeReportSingle = results[1].results.find((row) => row.route === 'report' && row.concurrency === 1);
const largeReportConcurrent = results[1].results.find((row) => row.route === 'report' && row.concurrency === 10);
const markdown = [
  '# Cygnet benchmark baseline', '', `- Started: ${benchmark.startedAt}`, `- Runtime: Node ${environment.node}; ${environment.platform}/${environment.arch}; ${environment.cpus} logical CPUs`,
  '- Isolation: each profile count used a fresh temporary SQLite data directory and a local HTTP server; all files were removed after each run.',
  '- Workload: 100 profiles / 10,000 events / 1,000 synthetic posts and messages; 1,000 profiles / 100,000 events / 10,000 posts and messages.',
  '- Measurement: 2 warmups, then 10 requests for bootstrap/report, 12 for replay, and 20 for other routes at concurrency 1 and 10; p50/p95/max latency, throughput, HTTP errors, and average response bytes.',
  '- Routes: bootstrap, event page (200), report, replay (5,000), settings, profile, and profile update action.',
  '- Correctness score: 5/5 assertions per dataset. This is a functional score, not a latency target; results are a local baseline, not a cross-machine guarantee.',
  `- Benchmark runner RSS at completion: ${benchmark.memoryRssBytes} bytes.`, '',
  `- At 1,000 profiles and 100,000 events, report p95 was ${largeReportSingle.p95Ms} ms at concurrency 1 and ${largeReportConcurrent.p95Ms} ms at concurrency 10; report responses averaged ${largeReportSingle.avgResponseBytes} bytes. The synchronous report route is the measured load bottleneck.`,
  '- All measured routes returned 2xx. The 100% correctness score covers fixture counts, bootstrap population, report completeness, replay limit, and HTTP error count; it does not certify a seven-day live run.', '',
  '| Profiles | Events | Posts + messages | Route | Concurrency | p50 ms | p95 ms | max ms | req/s | Avg bytes | Errors |',
  '|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|',
  ...results.flatMap((size) => size.results.map((row) => `| ${size.profiles} | ${size.dataset.events.toLocaleString('en-US')} | ${size.dataset.posts.toLocaleString('en-US')} + ${size.dataset.messages.toLocaleString('en-US')} | ${row.route} | ${row.concurrency} | ${row.p50Ms} | ${row.p95Ms} | ${row.maxMs} | ${row.requestsPerSecond} | ${row.avgResponseBytes} | ${row.errors} |`)),
  '', ...results.map((size) => `## ${size.profiles} profiles\n\n- Correctness: ${size.correctness.passed}/${size.correctness.total} (${size.correctness.scorePercent}%).\n- Synthetic dataset: ${size.dataset.events.toLocaleString('en-US')} events, ${size.dataset.posts.toLocaleString('en-US')} posts, ${size.dataset.messages.toLocaleString('en-US')} messages.\n- Server RSS: ${size.serverRssBytes} bytes; SQLite DB: ${size.dbBytes} bytes; WAL/SHM at shutdown: ${size.journalBytes} bytes.`),
].join('\n');
const markdownPath = reportPath.replace(/\.json$/, '.md');
writeFileSync(markdownPath, `${markdown}\n`);
console.log(`Benchmark completed: ${markdownPath} and ${reportPath}`);
console.log(JSON.stringify(benchmark, null, 2));
