import express from 'express';
import { db } from '../db.js';
import { asyncHandler, httpError } from '../util.js';
import { destroyProfile } from '../services/browser.js';
import { refreshAccountStats } from '../services/poller.js';
import {
  startLoginSession, finishLoginSession, cancelLoginSession, checkLoginSession,
} from '../services/loginSession.js';

export const accountsRouter = express.Router();

function withLatestStats(account) {
  const latest = db
    .prepare('SELECT * FROM stat_snapshots WHERE account_id = ? ORDER BY taken_at DESC LIMIT 1')
    .get(account.id);
  const cutoff = Date.now() - 48 * 3600 * 1000;
  const base = db
    .prepare(
      `SELECT * FROM stat_snapshots WHERE account_id = ? AND taken_at <= ?
       ORDER BY taken_at DESC LIMIT 1`
    )
    .get(account.id, cutoff)
    || db.prepare('SELECT * FROM stat_snapshots WHERE account_id = ? ORDER BY taken_at ASC LIMIT 1').get(account.id);

  const delta = (a, b) => (a != null && b != null ? a - b : null);
  return {
    ...account,
    stats: latest
      ? {
          takenAt: latest.taken_at,
          views: latest.views,
          followers: latest.followers,
          likes: latest.likes,
          videos: latest.videos,
          views48h: latest !== base ? delta(latest.views, base?.views) : 0,
          followers48h: latest !== base ? delta(latest.followers, base?.followers) : 0,
          likes48h: latest !== base ? delta(latest.likes, base?.likes) : 0,
        }
      : null,
  };
}

accountsRouter.get('/', (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all();
  res.json(accounts.map(withLatestStats));
});

accountsRouter.get('/:id', (req, res, next) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!account) return next(httpError(404, 'Không tìm thấy tài khoản'));
  res.json(withLatestStats(account));
});

accountsRouter.patch('/:id', (req, res, next) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!account) return next(httpError(404, 'Không tìm thấy tài khoản'));
  const { name, note, pageUrl } = req.body || {};
  db.prepare('UPDATE accounts SET name = ?, note = ?, page_url = ? WHERE id = ?').run(
    name ?? account.name, note ?? account.note, pageUrl !== undefined ? pageUrl : account.page_url, account.id
  );
  res.json({ ok: true });
});

accountsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) throw httpError(404, 'Không tìm thấy tài khoản');
    db.prepare('DELETE FROM accounts WHERE id = ?').run(account.id);
    await destroyProfile(account.id); // xóa sạch profile trình duyệt + cookie
    res.json({ ok: true });
  })
);

accountsRouter.post(
  '/:id/refresh-stats',
  asyncHandler(async (req, res) => {
    const stats = await refreshAccountStats(Number(req.params.id));
    res.json({ ok: true, stats });
  })
);

// ---- Phiên đăng nhập từ xa ----

accountsRouter.post(
  '/connect/:platform',
  asyncHandler(async (req, res) => {
    const { sessionId, accountId } = await startLoginSession(req.params.platform);
    res.json({ sessionId, accountId });
  })
);

accountsRouter.get(
  '/connect/session/:sessionId/check',
  asyncHandler(async (req, res) => {
    res.json(await checkLoginSession(req.params.sessionId));
  })
);

accountsRouter.post(
  '/connect/session/:sessionId/finish',
  asyncHandler(async (req, res) => {
    res.json(await finishLoginSession(req.params.sessionId));
  })
);

accountsRouter.post(
  '/connect/session/:sessionId/cancel',
  asyncHandler(async (req, res) => {
    await cancelLoginSession(req.params.sessionId);
    res.json({ ok: true });
  })
);
