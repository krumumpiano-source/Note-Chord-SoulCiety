/**
 * Note Chord SoulCiety — Database Setup Script
 * Run once to create tables in Turso
 *
 * Usage (PowerShell):
 *   $env:TURSO_DATABASE_URL="libsql://your-db.turso.io"
 *   $env:TURSO_AUTH_TOKEN="your-token"
 *   node scripts/setup-db.js
 */

const { createClient } = require('@libsql/client');

async function setup() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error('ERROR: Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables');
    process.exit(1);
  }

  const db = createClient({ url, authToken });
  console.log('Connected to Turso:', url);

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      package TEXT DEFAULT 'free',
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      package TEXT DEFAULT 'free',
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_data TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      song_name TEXT NOT NULL,
      song_url TEXT DEFAULT '',
      added_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS setlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      setlist_id TEXT NOT NULL,
      name TEXT NOT NULL,
      songs_json TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS recent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      song_name TEXT NOT NULL,
      song_url TEXT DEFAULT '',
      opened_at TEXT NOT NULL
    )`
  ];

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_sessions_uid ON sessions(uid)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_favorites_uid ON favorites(uid)',
    'CREATE INDEX IF NOT EXISTS idx_setlists_uid ON setlists(uid)',
    'CREATE INDEX IF NOT EXISTS idx_recent_uid ON recent(uid)',
    'CREATE INDEX IF NOT EXISTS idx_songs_name ON songs(name)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)'
  ];

  for (const sql of tables) {
    await db.execute(sql);
    const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
    if (match) console.log('  Table:', match[1], '- OK');
  }

  for (const sql of indexes) {
    await db.execute(sql);
  }
  console.log('  Indexes created');

  console.log('\n=== Setup complete! ===');
  console.log('Next: Deploy to Vercel and set environment variables');
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
