import express from 'express';
import { db } from '../db.js';

export const notificationsRouter = express.Router();

function map(n) {
  return {
    id: n.id, level: n.level, title: n.title, body: n.body, link: n.link,
    accountId: n.account_id, read: !!n.read, createdAt: n.created_at,
  };
}

notificationsRouter.get('/', (req, res) => {
  const filter = req.query.filter || 'all';
  const limit = Math.min(Number(req.query.limit || 50), 200);
  let where = '';
  if (filter === 'unread') where = 'WHERE read = 0';
  else if (filter === 'alert') where = "WHERE level IN ('error', 'warning')";
  const rows = db.prepare(`SELECT * FROM notifications ${where} ORDER BY id DESC LIMIT ?`).all(limit);
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE read = 0').get().c;
  res.json({ unread, notifications: rows.map(map) });
});

notificationsRouter.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE read = 0').run();
  res.json({ ok: true });
});

notificationsRouter.post('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

notificationsRouter.delete('/', (req, res) => {
  db.prepare('DELETE FROM notifications').run();
  res.json({ ok: true });
});

notificationsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
