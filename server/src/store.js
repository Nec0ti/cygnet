import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const HUMAN_ID = 'human';
export const DB_PATH = process.env.CYGNET_DB || join(import.meta.dirname, '../data/cygnet.sqlite');

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
      extra_notes TEXT NOT NULL DEFAULT '', system_md TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS edges (
      source_id TEXT NOT NULL REFERENCES accounts(id), target_id TEXT NOT NULL REFERENCES accounts(id),
      kind TEXT NOT NULL CHECK(kind IN ('follow','friend','block')),
      created_at TEXT NOT NULL, PRIMARY KEY(source_id,target_id,kind)
    );
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
      caption TEXT NOT NULL DEFAULT '', media_filename TEXT, kind TEXT NOT NULL DEFAULT 'post',
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
      media_filename TEXT, created_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
      actor_id TEXT NOT NULL REFERENCES accounts(id), type TEXT NOT NULL,
      entity_id TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES accounts(id),
      target_type TEXT NOT NULL, target_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES accounts(id),
      type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS posts_created_idx ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS events_created_idx ON events(created_at DESC);
  `);
  return db;
}

export function logEvent(db, actorId, type, payload = {}) {
  db.prepare('INSERT INTO events(id,actor_id,type,payload,created_at) VALUES(?,?,?,?,?)')
    .run(randomUUID(), actorId, type, JSON.stringify(payload), new Date().toISOString());
}

export function saveSystemFile(db, accountId, dataRoot = join(import.meta.dirname, '../data')) {
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
