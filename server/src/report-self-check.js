import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { buildReport, reportCsv } from './report.js';

const db=new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE accounts(id TEXT,username TEXT,is_human INTEGER);
  CREATE TABLE posts(id TEXT,account_id TEXT,kind TEXT,created_at TEXT,media_filename TEXT);
  CREATE TABLE likes(post_id TEXT,account_id TEXT,created_at TEXT);
  CREATE TABLE comments(id TEXT,account_id TEXT,created_at TEXT);
  CREATE TABLE messages(id TEXT,sender_id TEXT,created_at TEXT,media_filename TEXT);
  CREATE TABLE reports(id TEXT,reporter_id TEXT,created_at TEXT);
  CREATE TABLE events(id TEXT,actor_id TEXT,type TEXT,created_at TEXT,payload TEXT);
  INSERT INTO accounts VALUES('human','human',1),('ai','=1+1',0),('space',' =2+2',0);
  INSERT INTO posts VALUES('p1','ai','post','2026-11-13T01:00:00.000Z','p.png'),('s1','ai','story','2026-11-13T02:00:00.000Z',NULL),('old','ai','post','2026-11-12T23:59:59.000Z',NULL);
  INSERT INTO likes VALUES('p1','human','2026-11-13T03:00:00.000Z');
  INSERT INTO comments VALUES('c1','ai','2026-11-13T04:00:00.000Z');
  INSERT INTO messages VALUES('m1','ai','2026-11-13T06:00:00.000Z','m.png');
  INSERT INTO reports VALUES('r1','human','2026-11-13T07:00:00.000Z');
  INSERT INTO events VALUES('e1','ai','like.created','2026-11-13T03:00:00.000Z','{}'),('e2','ai','follow.created','2026-11-13T05:00:00.000Z','{}'),('e3','ai','follow.removed','2026-11-13T05:30:00.000Z','{}'),('e4','ai','image.generation.failed','2026-11-13T08:00:00.000Z','{}');
`);
try {
  const report=buildReport(db,'2026-11-13','2026-11-13',{speedMultiplier:1});
  assert.deepEqual(report.totals,{posts:1,stories:1,likes:1,comments:1,follows:2,dms:1,reports:1,images:2,imageFailures:1,activePersonas:1});
  assert.deepEqual(report.followChanges,{created:1,removed:1,net:0});
  assert.equal(report.events.length,4);
  assert.equal(report.daily.length,1);
  assert.equal(report.personas[0].dms,1);
  assert.equal(report.settings.speedMultiplier,1);
  const empty=buildReport(db,'2026-11-14','2026-11-14',{});
  assert.equal(empty.daily.length,1);
  assert.equal(empty.totals.posts,0);
  assert.equal(empty.events.length,0);
  const csv=reportCsv(report);
  assert.ok(csv.includes("'=1+1"));
  assert.ok(csv.includes("' =2+2"));
  assert.ok(csv.includes('"event"'));
  assert.throws(()=>buildReport(db,'2026-11-14','2026-11-13',{}),/on or before/);
  assert.throws(()=>buildReport(db,'2026-01-01','2027-01-02',{}),/366 days/);
  console.log('Experiment report self-check passed.');
} finally { db.close(); }
