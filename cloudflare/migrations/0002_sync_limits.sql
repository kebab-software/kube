ALTER TABLE users ADD COLUMN sync_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN sync_count INTEGER NOT NULL DEFAULT 0;
UPDATE users SET sync_bytes=(SELECT COALESCE(SUM(length(CAST(value AS BLOB))),0) FROM sync_items WHERE user_id=users.id),
sync_count=(SELECT COUNT(*) FROM sync_items WHERE user_id=users.id);
CREATE TRIGGER sync_insert_quota BEFORE INSERT ON sync_items BEGIN
 SELECT CASE WHEN
 (SELECT sync_bytes FROM users WHERE id=NEW.user_id)+COALESCE(length(CAST(NEW.value AS BLOB)),0)-COALESCE((SELECT length(CAST(value AS BLOB)) FROM sync_items WHERE user_id=NEW.user_id AND kind=NEW.kind AND item_id=NEW.item_id),0)>20000000
 OR ((SELECT sync_count FROM users WHERE id=NEW.user_id)>=60000 AND NOT EXISTS(SELECT 1 FROM sync_items WHERE user_id=NEW.user_id AND kind=NEW.kind AND item_id=NEW.item_id))
 THEN RAISE(ABORT,'sync_quota') END;
END;
CREATE TRIGGER sync_insert_size AFTER INSERT ON sync_items BEGIN
 UPDATE users SET sync_bytes=sync_bytes+COALESCE(length(CAST(NEW.value AS BLOB)),0),sync_count=sync_count+1 WHERE id=NEW.user_id;
END;
CREATE TRIGGER sync_update_quota BEFORE UPDATE ON sync_items BEGIN
 SELECT CASE WHEN (SELECT sync_bytes FROM users WHERE id=NEW.user_id)+COALESCE(length(CAST(NEW.value AS BLOB)),0)-COALESCE(length(CAST(OLD.value AS BLOB)),0)>20000000 THEN RAISE(ABORT,'sync_quota') END;
END;
CREATE TRIGGER sync_update_size AFTER UPDATE ON sync_items BEGIN
 UPDATE users SET sync_bytes=sync_bytes+COALESCE(length(CAST(NEW.value AS BLOB)),0)-COALESCE(length(CAST(OLD.value AS BLOB)),0) WHERE id=NEW.user_id;
END;
