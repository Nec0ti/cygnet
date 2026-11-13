import assert from 'node:assert/strict';
import { openStore } from './store.js';
import {
  checkpointServerRuntime, endPlatformSession, ensureUsageSchema, heartbeatPlatformSession, platformUsage,
  serverRuntimeTotalMs, startPlatformSession, startServerRuntime, stopServerRuntime,
  usageSummary, validSessionId,
} from './usage.js';

const db = openStore(':memory:');
try {
  ensureUsageSchema(db);
  ensureUsageSchema(db);
  assert.equal(validSessionId('01234567-89ab-cdef'), true);
  assert.equal(validSessionId('short'), false);
  assert.equal(validSessionId('bad space in id 123'), false);

  let wall = Date.parse('2026-11-13T00:00:00.000Z'), mono = 0;
  const runtime = startServerRuntime(db, {
    pid: 71001, wallNow: () => wall, monotonicNow: () => mono, processAlive: () => false,
  });
  mono = 5_000;
  assert.equal(serverRuntimeTotalMs(db, runtime), 5_000);
  assert.throws(() => startServerRuntime(db, { pid: 71002, wallNow: () => wall, monotonicNow: () => mono, processAlive: () => true }), /already running/);
  mono = 10_000;
  stopServerRuntime(runtime);
  assert.equal(serverRuntimeTotalMs(db), 10_000);

  mono = 0; wall += 86_400_000;
  const crashed = startServerRuntime(db, { pid: 71003, wallNow: () => wall, monotonicNow: () => mono, processAlive: () => false });
  mono = 4_000;
  checkpointServerRuntime(crashed);
  // A new process marks the old run interrupted at its last checkpoint, excluding downtime.
  let newMono = 0;
  const afterCrash = startServerRuntime(db, { pid: 71004, wallNow: () => wall + 1_000_000, monotonicNow: () => newMono, processAlive: () => false });
  assert.equal(serverRuntimeTotalMs(db, afterCrash), 14_000);
  newMono = 2_000;
  stopServerRuntime(afterCrash);
  assert.equal(serverRuntimeTotalMs(db), 16_000);
  assert.equal(db.prepare("SELECT status FROM server_runtime_runs WHERE id=?").get(crashed.id).status, 'interrupted');

  const a = 'session-tab-a-1234', b = 'session-tab-b-1234';
  startPlatformSession(db, a, true, 0);
  heartbeatPlatformSession(db, a, true, 10_000);
  startPlatformSession(db, b, true, 15_000);
  heartbeatPlatformSession(db, a, false, 20_000);
  heartbeatPlatformSession(db, b, true, 20_000);
  endPlatformSession(db, a, 25_000);
  endPlatformSession(db, b, 30_000);
  assert.equal(platformUsage(db, 30_000).platformMs, 30_000);
  assert.equal(platformUsage(db, 30_000).activeSessions, 0);

  const c = 'session-tab-c-1234';
  startPlatformSession(db, c, true, 40_000);
  const expired = platformUsage(db, 100_000);
  assert.equal(expired.platformMs, 60_000);
  assert.equal(expired.platformActive, false);
  assert.throws(() => heartbeatPlatformSession(db, 'session-does-not-exist', true, 101_000), /not found/);

  const beforeRestart = platformUsage(db, 110_000).platformMs;
  // Recovery never counts the time the server was closed.
  const restarted = startServerRuntime(db, { pid: 71005, wallNow: () => wall + 2_000_000, monotonicNow: () => 0, processAlive: () => false });
  assert.equal(usageSummary(db, restarted, 110_000).platformMs, beforeRestart);
  stopServerRuntime(restarted);
  console.log('Usage checkpoint and multi-tab self-check passed.');
} finally { db.close(); }
