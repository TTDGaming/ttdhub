import Database from 'better-sqlite3';
import { DB_PATH } from './config.js';

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK (platform IN ('youtube','tiktok','facebook')),
  name TEXT,
  handle TEXT,
  avatar_url TEXT,
  external_id TEXT,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'connecting',
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stat_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  taken_at INTEGER NOT NULL,
  views INTEGER,
  followers INTEGER,
  likes INTEGER,
  videos INTEGER
);
CREATE INDEX IF NOT EXISTS idx_snapshots_account_time ON stat_snapshots(account_id, taken_at);

CREATE TABLE IF NOT EXISTS upload_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS upload_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER REFERENCES upload_batches(id) ON DELETE SET NULL,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  original_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('public','unlisted','private')),
  schedule_at INTEGER,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','uploading','done','error','canceled')),
  progress INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  remote_url TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON upload_jobs(status);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

export const now = () => Date.now();

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}
