import express from 'express';
import { db, now, getSetting } from '../db.js';
import { httpError } from '../util.js';

export const revenueRouter = express.Router();

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function last12Months() {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < 12; i++) {
    out.unshift(monthKey(d));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

/** Delta view 30 ngày gần nhất của một tài khoản (từ snapshot). */
function viewsDelta30(accountId) {
  const latest = db
    .prepare('SELECT views FROM stat_snapshots WHERE account_id = ? AND views IS NOT NULL ORDER BY taken_at DESC LIMIT 1')
    .get(accountId);
  if (!latest) return null;
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  const base =
    db.prepare(
      'SELECT views FROM stat_snapshots WHERE account_id = ? AND views IS NOT NULL AND taken_at <= ? ORDER BY taken_at DESC LIMIT 1'
    ).get(accountId, cutoff) ||
    db.prepare('SELECT views FROM stat_snapshots WHERE account_id = ? AND views IS NOT NULL ORDER BY taken_at ASC LIMIT 1').get(accountId);
  if (!base || base.views == null) return null;
  return Math.max(0, latest.views - base.views);
}

/** Tổng hợp doanh thu toàn hệ thống + từng kênh. */
revenueRouter.get('/summary', (req, res) => {
  const currency = getSetting('currency', 'USD');
  const months = last12Months();
  const thisMonth = months[months.length - 1];
  const accounts = db.prepare("SELECT * FROM accounts WHERE status != 'connecting' ORDER BY created_at DESC").all();

  const sumFor = db.prepare('SELECT COALESCE(SUM(amount),0) s FROM revenue_entries WHERE account_id = ? AND month = ?');
  const sum12 = db.prepare('SELECT COALESCE(SUM(amount),0) s FROM revenue_entries WHERE account_id = ? AND month >= ?');

  const perAccount = accounts.map((acc) => {
    const v30 = viewsDelta30(acc.id);
    const est30 = acc.rpm != null && v30 != null ? (v30 / 1000) * acc.rpm : null;
    return {
      id: acc.id,
      name: acc.name,
      platform: acc.platform,
      avatarUrl: acc.avatar_url,
      monetized: acc.monetized,
      rpm: acc.rpm,
      views30d: v30,
      est30,
      recordedThisMonth: sumFor.get(acc.id, thisMonth).s,
      recorded12m: sum12.get(acc.id, months[0]).s,
    };
  });

  // Chuỗi 12 tháng (tổng ghi nhận toàn hệ thống)
  const monthly = months.map((m) => ({
    month: m,
    total: db.prepare('SELECT COALESCE(SUM(amount),0) s FROM revenue_entries WHERE month = ?').get(m).s,
  }));

  res.json({
    currency,
    thisMonth,
    totals: {
      recordedThisMonth: perAccount.reduce((s, a) => s + a.recordedThisMonth, 0),
      est30: perAccount.reduce((s, a) => s + (a.est30 || 0), 0),
      recorded12m: perAccount.reduce((s, a) => s + a.recorded12m, 0),
      monetizedCount: perAccount.filter((a) => a.monetized === 'yes').length,
      accountCount: perAccount.length,
    },
    monthly,
    accounts: perAccount,
  });
});

revenueRouter.get('/entries', (req, res) => {
  const { accountId } = req.query;
  const rows = accountId
    ? db.prepare(
        `SELECT r.*, a.name account_name, a.platform FROM revenue_entries r JOIN accounts a ON a.id = r.account_id
         WHERE r.account_id = ? ORDER BY r.month DESC, r.id DESC`
      ).all(accountId)
    : db.prepare(
        `SELECT r.*, a.name account_name, a.platform FROM revenue_entries r JOIN accounts a ON a.id = r.account_id
         ORDER BY r.month DESC, r.id DESC LIMIT 500`
      ).all();
  res.json(rows);
});

revenueRouter.post('/entries', (req, res, next) => {
  const { accountId, month, amount, note } = req.body || {};
  if (!/^\d{4}-\d{2}$/.test(month || '')) return next(httpError(400, 'Tháng không hợp lệ (YYYY-MM)'));
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) return next(httpError(400, 'Số tiền không hợp lệ'));
  const acc = db.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId);
  if (!acc) return next(httpError(404, 'Không tìm thấy kênh'));
  const info = db
    .prepare('INSERT INTO revenue_entries (account_id, month, amount, note, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(accountId, month, amt, note || null, now());
  res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

revenueRouter.delete('/entries/:id', (req, res, next) => {
  const info = db.prepare('DELETE FROM revenue_entries WHERE id = ?').run(req.params.id);
  if (!info.changes) return next(httpError(404, 'Không tìm thấy bản ghi'));
  res.json({ ok: true });
});

/** Xuất CSV toàn bộ doanh thu ghi nhận. */
revenueRouter.get('/export.csv', (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.month, a.name, a.platform, r.amount, r.note FROM revenue_entries r
       JOIN accounts a ON a.id = r.account_id ORDER BY r.month DESC`
    )
    .all();
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['month,channel,platform,amount,note']
    .concat(rows.map((r) => [r.month, esc(r.name), r.platform, r.amount, esc(r.note)].join(',')))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="mshub-revenue.csv"');
  res.send('﻿' + csv);
});
