import { useDatabase } from 'nitro/database'

let readyPromise

export function database() {
  return useDatabase()
}

export function ensureDatabase() {
  readyPromise ??= migrate()
  return readyPromise
}

async function migrate() {
  const db = database()
  await db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS match_results (
      match_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mode TEXT NOT NULL,
      scope TEXT NOT NULL,
      won INTEGER NOT NULL,
      abandoned INTEGER NOT NULL DEFAULT 0,
      kills INTEGER NOT NULL,
      deaths INTEGER NOT NULL,
      headshots INTEGER NOT NULL,
      melee_kills INTEGER NOT NULL,
      grenade_kills INTEGER NOT NULL,
      best_kill_streak INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL,
      highest_wave INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (match_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS mode_stats (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mode TEXT NOT NULL,
      scope TEXT NOT NULL,
      matches INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      kills INTEGER NOT NULL DEFAULT 0,
      deaths INTEGER NOT NULL DEFAULT 0,
      headshots INTEGER NOT NULL DEFAULT 0,
      melee_kills INTEGER NOT NULL DEFAULT 0,
      grenade_kills INTEGER NOT NULL DEFAULT 0,
      best_kill_streak INTEGER NOT NULL DEFAULT 0,
      total_seconds INTEGER NOT NULL DEFAULT 0,
      highest_wave INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, mode, scope)
    );
    INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (1, ${Date.now()});
  `)
  return db
}
