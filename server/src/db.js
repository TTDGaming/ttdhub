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

-- Một "identity" = một lần đăng nhập (Google / TikTok / Facebook).
-- Với YouTube, một tài khoản Google (kind='manager') có thể quản lý NHIỀU kênh
-- (được cấp vai trò Người quản lý). Tất cả kênh của một identity dùng chung
-- một profile trình duyệt (id_<identity.id>).
CREATE TABLE IF NOT EXISTS identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'single',   -- 'manager' (nhiều kênh) | 'single' (một kênh)
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'error'
  last_synced_at INTEGER,
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

CREATE TABLE IF NOT EXISTS revenue_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month TEXT NOT NULL,            -- 'YYYY-MM'
  amount REAL NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_revenue_account_month ON revenue_entries(account_id, month);

-- Video của một kênh (đọc từ trang công khai + thao tác qua Studio).
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,               -- id nền tảng (YouTube videoId...)
  title TEXT,
  thumbnail_url TEXT,
  url TEXT,
  published_at INTEGER,
  published_text TEXT,                  -- mốc thời gian tương đối ("3 tuần trước")
  duration TEXT,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  privacy TEXT,
  fetched_at INTEGER NOT NULL,
  UNIQUE (account_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_videos_account ON videos(account_id, published_at);

-- Bình luận cộng đồng (tab Cộng đồng).
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL,
  video_id TEXT,
  video_title TEXT,
  author TEXT,
  author_avatar TEXT,
  text TEXT,
  likes INTEGER,
  replied INTEGER NOT NULL DEFAULT 0,
  published_text TEXT,
  fetched_at INTEGER NOT NULL,
  UNIQUE (account_id, comment_id)
);
CREATE INDEX IF NOT EXISTS idx_comments_account ON comments(account_id, fetched_at);
`);

// Migration nhẹ: thêm cột mới vào bảng cũ nếu chưa có
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn('accounts', 'monetized', "monetized TEXT NOT NULL DEFAULT 'unknown'"); // 'yes' | 'no' | 'unknown'
ensureColumn('accounts', 'rpm', 'rpm REAL'); // doanh thu ước tính trên 1000 view
ensureColumn('accounts', 'identity_id', 'identity_id INTEGER REFERENCES identities(id) ON DELETE CASCADE');
ensureColumn('accounts', 'role', "role TEXT NOT NULL DEFAULT 'owner'"); // 'owner' | 'manager' | 'self'
ensureColumn('accounts', 'tags', 'tags TEXT'); // nhãn/nhóm, phân cách bằng dấu phẩy
ensureColumn('identities', 'external_id', 'external_id TEXT'); // UCID kênh gốc của tài khoản login
ensureColumn('accounts', 'page_id', 'page_id TEXT'); // pageId (obfuscated GAIA) để chuyển kênh đang hoạt động
ensureColumn('accounts', 'is_manager', 'is_manager INTEGER NOT NULL DEFAULT 0'); // 1 = kênh được quản lý (không phải kênh gốc của login)

// Khóa upsert khi phát hiện lại kênh của một tài khoản quản lý.
// (SQLite coi mỗi NULL là khác nhau nên các kênh độc lập identity_id=NULL không bị ràng buộc.)
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_identity_ext ON accounts(identity_id, external_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_identity ON accounts(identity_id)');

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
