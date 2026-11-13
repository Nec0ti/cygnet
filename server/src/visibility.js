export function visibleStoriesFor(db, viewerId, now = new Date().toISOString()) {
  return db.prepare(`SELECT p.id,p.account_id,p.caption,p.created_at,p.expires_at,p.media_filename
    FROM posts p WHERE p.kind='story' AND (p.expires_at IS NULL OR p.expires_at>?)
    AND (p.account_id=? OR EXISTS(SELECT 1 FROM edges f WHERE f.source_id=? AND f.target_id=p.account_id AND f.kind='follow'))
    AND NOT EXISTS(SELECT 1 FROM edges b WHERE b.kind='block' AND
      ((b.source_id=? AND b.target_id=p.account_id) OR (b.source_id=p.account_id AND b.target_id=?)))
    ORDER BY p.created_at DESC`).all(now,viewerId,viewerId,viewerId,viewerId);
}
