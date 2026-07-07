import bcrypt from 'bcryptjs';
import express from 'express';
import { db, now } from './db.js';
import { randomToken } from './crypto.js';
import { asyncHandler, httpError } from './util.js';

const SESSION_TTL = 30 * 24 * 3600 * 1000; // 30 ngày
const COOKIE = 'mshub_session';

export function hasAdmin() {
  return !!db.prepare('SELECT id FROM users LIMIT 1').get();
}

export function getSessionUser(req) {
  const token = parseCookies(req.headers.cookie || '')[COOKIE];
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, now());
  return row || null;
}

export function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (!user) return next(httpError(401, 'Chưa đăng nhập'));
  req.user = user;
  next();
}

function parseCookies(header) {
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL / 1000}; SameSite=Lax`
  );
}

export const authRouter = express.Router();

// Trạng thái: đã có admin chưa + đã đăng nhập chưa
authRouter.get('/state', (req, res) => {
  const user = getSessionUser(req);
  res.json({ needsSetup: !hasAdmin(), user: user ? { username: user.username } : null });
});

// Lần chạy đầu: tạo tài khoản quản trị
authRouter.post(
  '/setup',
  asyncHandler(async (req, res) => {
    if (hasAdmin()) throw httpError(400, 'Đã khởi tạo trước đó');
    const { username, password } = req.body || {};
    if (!username || !password || password.length < 6) {
      throw httpError(400, 'Cần tên đăng nhập và mật khẩu tối thiểu 6 ký tự');
    }
    const hash = await bcrypt.hash(password, 10);
    const info = db
      .prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
      .run(username.trim(), hash, now());
    const token = randomToken();
    db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
      token, info.lastInsertRowid, now(), now() + SESSION_TTL
    );
    setSessionCookie(res, token);
    res.json({ ok: true });
  })
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get((username || '').trim());
    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
      throw httpError(401, 'Sai tên đăng nhập hoặc mật khẩu');
    }
    const token = randomToken();
    db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
      token, user.id, now(), now() + SESSION_TTL
    );
    setSessionCookie(res, token);
    res.json({ ok: true });
  })
);

authRouter.post('/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie || '')[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
  res.json({ ok: true });
});

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!(await bcrypt.compare(currentPassword || '', user.password_hash))) {
      throw httpError(400, 'Mật khẩu hiện tại không đúng');
    }
    if (!newPassword || newPassword.length < 6) throw httpError(400, 'Mật khẩu mới tối thiểu 6 ký tự');
    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    res.json({ ok: true });
  })
);
