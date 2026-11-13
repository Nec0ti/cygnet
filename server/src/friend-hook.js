export function connectFriends(db, left, right, createdAt) {
  if (left === right) return false;
  const insert = db.prepare(`INSERT INTO edges(source_id,target_id,kind,created_at)
    VALUES(?,?,'friend',?) ON CONFLICT DO NOTHING`);
  const first = insert.run(left, right, createdAt).changes;
  const second = insert.run(right, left, createdAt).changes;
  return Boolean(first || second);
}
