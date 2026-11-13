import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const HUMAN_ID = 'human';
export const DATA_ROOT = process.env.CYGNET_DATA_DIR || join(import.meta.dirname, '../data');
export const DB_PATH = process.env.CYGNET_DB || join(DATA_ROOT, 'cygnet.sqlite');

export function openStore(path = DB_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
      bio TEXT NOT NULL DEFAULT '', pronouns TEXT NOT NULL DEFAULT '', age INTEGER,
      country TEXT NOT NULL DEFAULT '', is_human INTEGER NOT NULL DEFAULT 0,
      tone TEXT NOT NULL DEFAULT '', traits_json TEXT NOT NULL DEFAULT '{}',
      extra_notes TEXT NOT NULL DEFAULT '', activity_json TEXT NOT NULL DEFAULT '{}',
      post_due_at TEXT, story_due_at TEXT, dm_due_at TEXT, engagement_due_at TEXT,
      last_post_at TEXT, last_story_at TEXT, last_dm_at TEXT, last_contact_at TEXT, read_due_at TEXT, seen_due_at TEXT, typing_until TEXT,
      retry_at TEXT, system_md TEXT NOT NULL DEFAULT '', avatar_filename TEXT, is_paused INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      alias_of TEXT REFERENCES accounts(id), evade_due_at TEXT, retry_count INTEGER NOT NULL DEFAULT 0, retry_error TEXT
    );
    CREATE TABLE IF NOT EXISTS edges (
      source_id TEXT NOT NULL REFERENCES accounts(id), target_id TEXT NOT NULL REFERENCES accounts(id),
      kind TEXT NOT NULL CHECK(kind IN ('follow','friend','block')),
      created_at TEXT NOT NULL, PRIMARY KEY(source_id,target_id,kind)
    );
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
      caption TEXT NOT NULL DEFAULT '', media_filename TEXT, image_prompt TEXT, image_category TEXT, image_sha256 TEXT,
      kind TEXT NOT NULL DEFAULT 'post',
      created_at TEXT NOT NULL, expires_at TEXT
    );
    CREATE TABLE IF NOT EXISTS likes (
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id), created_at TEXT NOT NULL,
      PRIMARY KEY(post_id,account_id)
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id), parent_id TEXT,
      content TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id), PRIMARY KEY(conversation_id,account_id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES accounts(id), content TEXT NOT NULL DEFAULT '',
      media_filename TEXT, image_prompt TEXT, image_sha256 TEXT, created_at TEXT NOT NULL, deleted_at TEXT, read_at TEXT
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
      actor_id TEXT NOT NULL REFERENCES accounts(id), type TEXT NOT NULL,
      entity_id TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES accounts(id),
      target_type TEXT NOT NULL, target_id TEXT NOT NULL, reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES accounts(id),
      type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS persona_memories (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), related_id TEXT REFERENCES accounts(id),
      content TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS posts_created_idx ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS events_created_idx ON events(created_at DESC);
  `);
  const columns = new Set(db.prepare('PRAGMA table_info(accounts)').all().map((column) => column.name));
  for (const [name, definition] of Object.entries({
    activity_json: "TEXT NOT NULL DEFAULT '{}'", post_due_at: 'TEXT', story_due_at: 'TEXT',
    dm_due_at: 'TEXT', engagement_due_at: 'TEXT', last_post_at: 'TEXT', last_story_at: 'TEXT',
    last_dm_at: 'TEXT', last_contact_at: 'TEXT', read_due_at: 'TEXT', seen_due_at: 'TEXT', typing_until: 'TEXT', retry_at: 'TEXT', alias_of: 'TEXT REFERENCES accounts(id)',
    evade_due_at: 'TEXT', retry_count: 'INTEGER NOT NULL DEFAULT 0', retry_error: 'TEXT',
    avatar_filename: 'TEXT',
    is_paused: 'INTEGER NOT NULL DEFAULT 0',
  })) if (!columns.has(name)) db.exec(`ALTER TABLE accounts ADD COLUMN ${name} ${definition}`);
  const postColumns=new Set(db.prepare('PRAGMA table_info(posts)').all().map((column)=>column.name));
  for(const [name,definition] of Object.entries({image_prompt:'TEXT',image_category:'TEXT',image_sha256:'TEXT'}))
    if(!postColumns.has(name)) db.exec(`ALTER TABLE posts ADD COLUMN ${name} ${definition}`);
  const messageColumns=new Set(db.prepare('PRAGMA table_info(messages)').all().map((column)=>column.name));
  for(const [name,definition] of Object.entries({image_prompt:'TEXT',image_sha256:'TEXT',read_at:'TEXT'}))
    if(!messageColumns.has(name)) db.exec(`ALTER TABLE messages ADD COLUMN ${name} ${definition}`);
  const reportColumns=new Set(db.prepare('PRAGMA table_info(reports)').all().map((column)=>column.name));
  if(!reportColumns.has('status')) db.exec("ALTER TABLE reports ADD COLUMN status TEXT NOT NULL DEFAULT 'open'");
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES(?,?,?)');
  const now = new Date().toISOString();
  for (const [key,value] of Object.entries({speedMultiplier:1,maxActivePersonas:10,harassmentMode:false,usShare:60,minAge:16,maxAge:30}))
    insertSetting.run(key,JSON.stringify(value),now);
  return db;
}

export function readSettings(db) {
  return Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(({key,value})=>[key,JSON.parse(value)]));
}

export function writeSettings(db, patch) {
  const current=readSettings(db), next={...current,...patch}, now=new Date().toISOString();
  const save=db.prepare('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at');
  for(const [key,value] of Object.entries(patch)) save.run(key,JSON.stringify(value),now);
  return next;
}

export function rememberPersona(db, accountId, relatedId, content) {
  db.prepare('INSERT INTO persona_memories(id,account_id,related_id,content,created_at) VALUES(?,?,?,?,?)')
    .run(randomUUID(),accountId,relatedId,content,new Date().toISOString());
  db.prepare(`DELETE FROM persona_memories WHERE account_id=? AND id NOT IN
    (SELECT id FROM persona_memories WHERE account_id=? ORDER BY created_at DESC LIMIT 20)`).run(accountId,accountId);
}

export function logEvent(db, actorId, type, payload = {}) {
  db.prepare('INSERT INTO events(id,actor_id,type,payload,created_at) VALUES(?,?,?,?,?)')
    .run(randomUUID(), actorId, type, JSON.stringify(payload), new Date().toISOString());
}

export function saveSystemFile(db, accountId, dataRoot = DATA_ROOT) {
  const row = db.prepare('SELECT system_md FROM accounts WHERE id=?').get(accountId);
  if (!row) return;
  const dir = join(dataRoot, 'personas', accountId);
  mkdirSync(dir, { recursive: true });
  const target = join(dir, 'system.md');
  const tmp = `${target}.${randomUUID()}.tmp`;
  writeFileSync(tmp, row.system_md, { mode: 0o600 });
  renameSync(tmp, target);
}

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
