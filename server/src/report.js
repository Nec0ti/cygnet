const METRICS = ['posts', 'stories', 'likes', 'comments', 'follows', 'dms', 'reports', 'images', 'imageFailures'];

function dateRange(from, to) {
  const valid = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to)) throw Object.assign(new Error('from and to must be valid YYYY-MM-DD dates'), { status: 400 });
  if (from > to) throw Object.assign(new Error('from must be on or before to'), { status: 400 });
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`) + 86_400_000;
  if ((end - start) / 86_400_000 > 366) throw Object.assign(new Error('Report range cannot exceed 366 days'), { status: 400 });
  return { from, to, start: `${from}T00:00:00.000Z`, end: new Date(end).toISOString() };
}

export function buildReport(db, from, to, settings, usage = {}) {
  const range = dateRange(from, to);
  const daily = new Map();
  for (let time = Date.parse(range.start); time < Date.parse(range.end); time += 86_400_000) {
    const day = new Date(time).toISOString().slice(0, 10);
    daily.set(day, Object.fromEntries([...METRICS, 'activePersonas'].map((key) => [key, 0])));
  }
  const people = new Map(db.prepare('SELECT id,username FROM accounts WHERE is_human=0 ORDER BY username').all()
    .map(({ id, username }) => [id, { id, username, ...Object.fromEntries(METRICS.map((key) => [key, 0])) }]));
  const params = [range.start, range.end];
  const sources = [
    ['posts', 'posts', 'created_at', (row) => row.kind === 'post'],
    ['posts', 'stories', 'created_at', (row) => row.kind === 'story'],
    ['events', 'likes', 'created_at', (row) => row.type === 'like.created'],
    ['comments', 'comments', 'created_at'],
    ['events', 'follows', 'created_at', (row) => row.type === 'follow.created' || row.type === 'follow.removed'],
    ['events', 'imageFailures', 'created_at', (row) => row.type === 'image.generation.failed'],
    ['messages', 'dms', 'created_at'], ['reports', 'reports', 'created_at'],
  ];
  const imageRows = [];
  const activeByDay = new Map([...daily.keys()].map((day) => [day, new Set()]));
  const followChanges = { created: 0, removed: 0, net: 0 };
  for (const [table, metric, timestamp, filter = () => true] of sources) {
    const rows = db.prepare(`SELECT *, substr(${timestamp},1,10) AS day FROM ${table} WHERE ${timestamp}>=? AND ${timestamp}<?`).all(...params);
    for (const row of rows) {
      if (!filter(row)) continue;
      if (daily.has(row.day)) daily.get(row.day)[metric]++;
      const actor = row.account_id ?? row.actor_id ?? row.source_id ?? row.sender_id ?? row.reporter_id;
      if (actor && people.has(actor)) people.get(actor)[metric]++;
      if (metric === 'follows') {
        if (row.type === 'follow.created') followChanges.created++;
        else if (row.type === 'follow.removed') followChanges.removed++;
      }
      if (row.media_filename) imageRows.push({ day: row.day, account_id: actor });
      if (actor && people.has(actor)) activeByDay.get(row.day)?.add(actor);
    }
  }
  for (const row of imageRows) {
    if (daily.has(row.day)) daily.get(row.day).images++;
    if (row.account_id && people.has(row.account_id)) people.get(row.account_id).images++;
  }
  for (const day of daily.keys()) daily.get(day).activePersonas = activeByDay.get(day).size;
  const totals = Object.fromEntries(METRICS.map((key) => [key, [...daily.values()].reduce((sum, value) => sum + value[key], 0)]));
  totals.activePersonas = new Set([...activeByDay.values()].flatMap((actors) => [...actors])).size;
  followChanges.net = followChanges.created - followChanges.removed;
  const events = db.prepare(`SELECT e.id,e.actor_id AS actorId,a.username,e.type,e.created_at AS createdAt,e.payload
    FROM events e JOIN accounts a ON a.id=e.actor_id WHERE e.created_at>=? AND e.created_at<?
    ORDER BY e.created_at,e.id`).all(...params).map((event) => ({ ...event, payload: JSON.parse(event.payload) }));
  return {
    from: range.from, to: range.to, generatedAt: new Date().toISOString(), settings, usage,
    totals, followChanges, events,
    daily: [...daily.entries()].map(([date, metrics]) => ({ date, ...metrics })),
    personas: [...people.values()].sort((a, b) => b.posts + b.stories + b.likes + b.comments + b.follows + b.dms - (a.posts + a.stories + a.likes + a.comments + a.follows + a.dms) || a.username.localeCompare(b.username)),
  };
}

function csvCell(value) {
  let text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function reportCsv(report) {
  const keys = METRICS.concat('activePersonas');
  const rows = [
    ['row_type', 'date', 'persona_id', 'username', ...keys, 'from', 'to', 'settings', 'usage_snapshot', 'event_id', 'event_type', 'event_payload'],
    ['settings', '', '', '', ...keys.map(() => ''), report.from, report.to, report.settings, report.usage, '', '', ''],
    ...report.daily.map((day) => ['daily', day.date, '', '', ...keys.map((key) => day[key]), report.from, report.to, report.settings, report.usage, '', '', '']),
    ...report.personas.map((person) => ['persona', '', person.id, person.username, ...keys.map((key) => person[key] ?? 0), report.from, report.to, report.settings, report.usage, '', '', '']),
    ...report.events.map((event) => ['event', event.createdAt.slice(0, 10), event.actorId, event.username,
      ...keys.map(() => ''), report.from, report.to, report.settings, report.usage, event.id, event.type, event.payload]),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

