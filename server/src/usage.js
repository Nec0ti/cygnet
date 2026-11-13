import { randomUUID } from 'node:crypto';

export const USAGE_HEARTBEAT_MS = 15_000;
export const USAGE_STALE_MS = 30_000;
// shortcut: an abrupt browser close can overcount at most 30 seconds; shorten the checkpoint interval for stricter accounting.
export const USAGE_MAX_GAP_MS = 30_000;

function iso(value) { return new Date(value).toISOString(); }
function begin(db) { db.exec('BEGIN IMMEDIATE'); }
function commit(db) { db.exec('COMMIT'); }
function rollback(db) { db.exec('ROLLBACK'); }

export function ensureUsageSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS server_runtime_runs(
      id TEXT PRIMARY KEY,pid INTEGER NOT NULL,started_at TEXT NOT NULL,checkpoint_at TEXT NOT NULL,
      ended_at TEXT,elapsed_ms INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL CHECK(status IN ('running','stopped','interrupted'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS server_runtime_one_running ON server_runtime_runs(status) WHERE status='running';
    CREATE TABLE IF NOT EXISTS platform_sessions(
      id TEXT PRIMARY KEY,started_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,is_active INTEGER NOT NULL DEFAULT 0,
      ended_at TEXT
    );
    CREATE INDEX IF NOT EXISTS platform_sessions_active_idx ON platform_sessions(is_active,last_seen_at);
    CREATE TABLE IF NOT EXISTS usage_state(
      id INTEGER PRIMARY KEY CHECK(id=1),platform_total_ms INTEGER NOT NULL DEFAULT 0,
      platform_active INTEGER NOT NULL DEFAULT 0,platform_checkpoint_at TEXT NOT NULL
    );`);
  db.prepare('INSERT OR IGNORE INTO usage_state(id,platform_checkpoint_at) VALUES(1,?)').run(new Date().toISOString());
}

function processIsAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
}

export function startServerRuntime(db, {
  pid = process.pid, wallNow = () => Date.now(), monotonicNow = () => Number(process.hrtime.bigint() / 1_000_000n),
  processAlive = processIsAlive,
} = {}) {
  ensureUsageSchema(db);
  const now = iso(wallNow());
  begin(db);
  try {
    const previous = db.prepare("SELECT * FROM server_runtime_runs WHERE status='running'").get();
    if (previous && processAlive(previous.pid)) throw Object.assign(new Error(`Cygnet server is already running as process ${previous.pid}`), { code: 'CYGNET_ALREADY_RUNNING' });
    if (previous) db.prepare("UPDATE server_runtime_runs SET status='interrupted',ended_at=checkpoint_at WHERE id=?").run(previous.id);
    const id = randomUUID();
    db.prepare(`INSERT INTO server_runtime_runs(id,pid,started_at,checkpoint_at,elapsed_ms,status)
      VALUES(?,?,?,?,0,'running')`).run(id, pid, now, now);
    db.prepare('UPDATE platform_sessions SET is_active=0,ended_at=coalesce(ended_at,last_seen_at) WHERE is_active=1').run();
    db.prepare('UPDATE usage_state SET platform_active=0,platform_checkpoint_at=? WHERE id=1').run(now);
    commit(db);
    return { db, id, pid, lastMonoMs: monotonicNow(), wallNow, monotonicNow };
  } catch (error) { rollback(db); throw error; }
}

export function checkpointServerRuntime(runtime) {
  const mono = runtime.monotonicNow(), now = iso(runtime.wallNow());
  const delta = Math.max(0, mono - runtime.lastMonoMs);
  runtime.db.prepare(`UPDATE server_runtime_runs SET elapsed_ms=elapsed_ms+?,checkpoint_at=?
    WHERE id=? AND status='running'`).run(Math.trunc(delta), now, runtime.id);
  runtime.lastMonoMs = mono;
  return Math.trunc(delta);
}

export function stopServerRuntime(runtime) {
  checkpointServerRuntime(runtime);
  runtime.db.prepare("UPDATE server_runtime_runs SET status='stopped',ended_at=checkpoint_at WHERE id=? AND status='running'").run(runtime.id);
}

export function serverRuntimeTotalMs(db, runtime = null) {
  const total = db.prepare('SELECT coalesce(sum(elapsed_ms),0) AS total FROM server_runtime_runs').get().total;
  if (!runtime) return total;
  const current = db.prepare("SELECT status FROM server_runtime_runs WHERE id=?").get(runtime.id);
  return total + (current?.status === 'running' ? Math.max(0, runtime.monotonicNow() - runtime.lastMonoMs) : 0);
}

function checkpointPlatformClock(db, nowMs) {
  const now = iso(nowMs), state = db.prepare('SELECT * FROM usage_state WHERE id=1').get();
  const elapsed = state.platform_active ? Math.max(0, Date.parse(now) - Date.parse(state.platform_checkpoint_at)) : 0;
  const delta = Math.min(elapsed, USAGE_MAX_GAP_MS);
  const freshAfter = iso(nowMs - USAGE_STALE_MS);
  const active = Boolean(db.prepare('SELECT 1 FROM platform_sessions WHERE is_active=1 AND last_seen_at>? LIMIT 1').get(freshAfter));
  db.prepare(`UPDATE usage_state SET platform_total_ms=platform_total_ms+?,platform_active=?,platform_checkpoint_at=? WHERE id=1`)
    .run(delta, Number(active), now);
  return { delta, active };
}

function updatePlatformSession(db, sessionId, active, nowMs, mode) {
  const now = iso(nowMs);
  begin(db);
  try {
    if (mode === 'start') {
      db.prepare(`INSERT INTO platform_sessions(id,started_at,last_seen_at,is_active) VALUES(?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET last_seen_at=excluded.last_seen_at,is_active=excluded.is_active,ended_at=NULL`)
        .run(sessionId, now, now, Number(active));
    } else {
      const exists = db.prepare('SELECT 1 FROM platform_sessions WHERE id=?').get(sessionId);
      if (!exists) throw Object.assign(new Error('Platform session not found'), { status: 404 });
      db.prepare('UPDATE platform_sessions SET last_seen_at=?,is_active=?,ended_at=? WHERE id=?')
        .run(now, Number(active), mode === 'end' ? now : null, sessionId);
    }
    checkpointPlatformClock(db, nowMs);
    commit(db);
    return platformUsage(db, nowMs);
  } catch (error) { rollback(db); throw error; }
}

export function startPlatformSession(db, sessionId, active, nowMs = Date.now()) {
  return updatePlatformSession(db, sessionId, active, nowMs, 'start');
}
export function heartbeatPlatformSession(db, sessionId, active, nowMs = Date.now()) {
  return updatePlatformSession(db, sessionId, active, nowMs, 'heartbeat');
}
export function endPlatformSession(db, sessionId, nowMs = Date.now()) {
  return updatePlatformSession(db, sessionId, false, nowMs, 'end');
}

export function checkpointPlatformUsage(db, nowMs = Date.now()) {
  return checkpointPlatformClock(db, nowMs);
}

export function stopPlatformUsage(db, nowMs = Date.now()) {
  const now = iso(nowMs);
  begin(db);
  try {
    checkpointPlatformClock(db, nowMs);
    db.prepare('UPDATE platform_sessions SET is_active=0,ended_at=? WHERE is_active=1').run(now);
    db.prepare('UPDATE usage_state SET platform_active=0,platform_checkpoint_at=? WHERE id=1').run(now);
    commit(db);
  } catch (error) { rollback(db); throw error; }
}

export function platformUsage(db, nowMs = Date.now()) {
  checkpointPlatformClock(db, nowMs);
  const row = db.prepare(`SELECT platform_total_ms,platform_active,platform_checkpoint_at FROM usage_state WHERE id=1`).get();
  const activeSessions = db.prepare('SELECT count(*) AS n FROM platform_sessions WHERE is_active=1 AND last_seen_at>?').get(iso(nowMs - USAGE_STALE_MS)).n;
  return {
    platformMs: row.platform_total_ms,
    platformActive: Boolean(row.platform_active),
    activeSessions,
    checkpointAt: row.platform_checkpoint_at,
  };
}

export function usageSummary(db, runtime = null, nowMs = Date.now()) {
  const platform = platformUsage(db, nowMs);
  return { serverMs: serverRuntimeTotalMs(db, runtime), ...platform };
}

export function validSessionId(value) {
  return typeof value === 'string' && value.length <= 100 && /^[A-Za-z0-9-]{16,100}$/.test(value);
}
