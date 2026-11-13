import { randomUUID } from 'node:crypto';
import { readSettings } from './store.js';

export function ensureExperimentSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    cohort_a_name TEXT NOT NULL,
    cohort_b_name TEXT NOT NULL,
    cohort_a_ids TEXT NOT NULL,
    cohort_b_ids TEXT NOT NULL,
    settings_json TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    start_event_time TEXT,
    start_event_id TEXT,
    end_event_time TEXT,
    end_event_id TEXT
  );
  CREATE INDEX IF NOT EXISTS experiments_started_idx ON experiments(started_at DESC);
  CREATE INDEX IF NOT EXISTS events_actor_time_idx ON events(actor_id,created_at,id);`);
}

function parseExperiment(row) {
  if (!row) return null;
  return {
    id: row.id, label: row.label,
    cohorts: {
      a: { name: row.cohort_a_name, accountIds: JSON.parse(row.cohort_a_ids) },
      b: { name: row.cohort_b_name, accountIds: JSON.parse(row.cohort_b_ids) },
    },
    settings: JSON.parse(row.settings_json), startedAt: row.started_at, finishedAt: row.finished_at,
    startCursor: row.start_event_time ? { createdAt: row.start_event_time, id: row.start_event_id } : null,
    endCursor: row.end_event_time ? { createdAt: row.end_event_time, id: row.end_event_id } : null,
  };
}

function cursor(db) {
  return db.prepare('SELECT created_at,id FROM events ORDER BY created_at DESC,id DESC LIMIT 1').get() || null;
}

function eventBounds(db, experiment) {
  const clauses = [], params = [];
  if (experiment.startCursor) {
    clauses.push('(created_at>? OR (created_at=? AND id>?))');
    params.push(experiment.startCursor.createdAt, experiment.startCursor.createdAt, experiment.startCursor.id);
  } else {
    clauses.push('created_at>=?');
    params.push(experiment.startedAt);
  }
  if (experiment.endCursor) {
    clauses.push('(created_at<? OR (created_at=? AND id<=?))');
    params.push(experiment.endCursor.createdAt, experiment.endCursor.createdAt, experiment.endCursor.id);
  } else if (experiment.finishedAt) {
    clauses.push('created_at<=?');
    params.push(experiment.finishedAt);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export function createExperiment(db, { label, cohortA, cohortB, now = new Date().toISOString() }) {
  if (typeof label !== 'string' || !label.trim() || label.trim().length > 100) throw new TypeError('Experiment label must be 1–100 characters');
  const normalize = (value, name) => {
    if (!Array.isArray(value) || !value.length || value.length > 1000
      || value.some((id) => typeof id !== 'string' || !id || id === 'human')
      || new Set(value).size !== value.length) throw new TypeError(`${name} must contain 1–1000 unique AI profile IDs`);
    return [...value].sort();
  };
  const a = normalize(cohortA, 'Cohort A'), b = normalize(cohortB, 'Cohort B');
  if (a.some((id) => b.includes(id))) throw new TypeError('Cohorts must not overlap');
  const ids = [...a, ...b];
  const placeholders = ids.map(() => '?').join(',');
  const found = db.prepare(`SELECT id FROM accounts WHERE is_human=0 AND id IN (${placeholders})`).all(...ids).map((row) => row.id);
  if (found.length !== ids.length) throw new TypeError('Every cohort member must be an existing AI profile');
  if (!Number.isFinite(Date.parse(now))) throw new TypeError('Experiment start time must be a valid date');
  const eventCursor = cursor(db), id = randomUUID(), settings = readSettings(db);
  db.prepare(`INSERT INTO experiments(id,label,cohort_a_name,cohort_b_name,cohort_a_ids,cohort_b_ids,settings_json,started_at,
    start_event_time,start_event_id) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
    id, label.trim(), 'A', 'B', JSON.stringify(a), JSON.stringify(b), JSON.stringify(settings), new Date(now).toISOString(),
    eventCursor?.created_at ?? null, eventCursor?.id ?? null,
  );
  return getExperiment(db, id);
}

export function getExperiment(db, id) {
  return parseExperiment(db.prepare('SELECT * FROM experiments WHERE id=?').get(id));
}

export function listExperiments(db) {
  return db.prepare('SELECT * FROM experiments ORDER BY started_at DESC,id DESC').all().map(parseExperiment);
}

export function finishExperiment(db, id, now = new Date().toISOString()) {
  const experiment = getExperiment(db, id);
  if (!experiment) throw Object.assign(new Error('Experiment not found'), { status: 404 });
  if (experiment.finishedAt) throw new TypeError('Experiment is already finished');
  if (!Number.isFinite(Date.parse(now)) || Date.parse(now) < Date.parse(experiment.startedAt)) throw new TypeError('Experiment end time must be valid and after it started');
  const eventCursor = cursor(db);
  db.prepare(`UPDATE experiments SET finished_at=?,end_event_time=?,end_event_id=? WHERE id=?`).run(
    new Date(now).toISOString(), eventCursor?.created_at ?? null, eventCursor?.id ?? null, id,
  );
  return getExperiment(db, id);
}

export function compareExperiment(db, id) {
  const experiment = getExperiment(db, id);
  if (!experiment) throw Object.assign(new Error('Experiment not found'), { status: 404 });
  const bounds = eventBounds(db, experiment), groups = {};
  for (const [key, cohort] of Object.entries(experiment.cohorts)) {
    const ids = cohort.accountIds, placeholders = ids.map(() => '?').join(',');
    const events = db.prepare(`SELECT type,COUNT(*) AS count FROM events ${bounds.where}${bounds.where ? ' AND' : ' WHERE'} actor_id IN (${placeholders}) GROUP BY type ORDER BY type`)
      .all(...bounds.params, ...ids);
    const total = events.reduce((sum, event) => sum + event.count, 0);
    groups[key] = { name: cohort.name, accounts: ids.length, totalEvents: total, events: Object.fromEntries(events.map((row) => [row.type, row.count])), eventsPerAccount: total / ids.length };
  }
  return { experiment, cohorts: groups };
}

export function replayEvents(db, { from, to, limit = 1000 } = {}) {
  if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(from) > Date.parse(to))
    throw new TypeError('Replay requires a valid from/to range with from before to');
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) throw new TypeError('Replay limit must be 1–5000');
  return db.prepare(`SELECT e.id,e.actor_id,e.type,e.payload,e.created_at,a.username
    FROM events e JOIN accounts a ON a.id=e.actor_id WHERE e.created_at>=? AND e.created_at<=?
    ORDER BY e.created_at ASC,e.id ASC LIMIT ?`).all(new Date(from).toISOString(), new Date(to).toISOString(), limit)
    .map(({ payload, ...event }) => ({ ...event, payload: JSON.parse(payload) }));
}
