CREATE TABLE IF NOT EXISTS site_users (
  id TEXT PRIMARY KEY NOT NULL,
  google_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS site_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS site_sessions_by_expiration ON site_sessions(expires_at);
CREATE INDEX IF NOT EXISTS site_sessions_by_user ON site_sessions(user_id);
CREATE TABLE IF NOT EXISTS account_roles (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'keeper')),
  assigned_by TEXT REFERENCES site_users(id) ON DELETE SET NULL,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '',
  room_code TEXT COLLATE NOCASE NOT NULL UNIQUE,
  keeper_id TEXT NOT NULL REFERENCES site_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS game_members (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 24),
  role TEXT NOT NULL CHECK (role IN ('keeper', 'player')),
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (game_id, user_id)
);
CREATE INDEX IF NOT EXISTS game_members_by_user ON game_members(user_id);
