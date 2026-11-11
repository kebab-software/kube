CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password TEXT NOT NULL,
 created_at INTEGER NOT NULL, sync_version INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
 digest TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS sync_items (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, item_id TEXT NOT NULL, value TEXT,
 revision INTEGER NOT NULL, PRIMARY KEY(user_id,kind,item_id)
);
CREATE INDEX IF NOT EXISTS sync_changes ON sync_items(user_id,revision);
CREATE TABLE IF NOT EXISTS auth_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS limits_expiry ON auth_limits(expires_at);
