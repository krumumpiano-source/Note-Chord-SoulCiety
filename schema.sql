-- Note Chord SoulCiety - D1 Schema

CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  package TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  package TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_data TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  song_name TEXT NOT NULL,
  song_url TEXT NOT NULL,
  added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS setlists (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  name TEXT NOT NULL,
  songs TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recent (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  song_name TEXT NOT NULL,
  song_url TEXT NOT NULL,
  viewed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_uid ON sessions(uid);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_favorites_uid ON favorites(uid);
CREATE INDEX IF NOT EXISTS idx_setlists_uid ON setlists(uid);
CREATE INDEX IF NOT EXISTS idx_recent_uid ON recent(uid);
CREATE INDEX IF NOT EXISTS idx_recent_viewed ON recent(uid, viewed_at);
