import express from 'express';
import { getSetting, setSetting } from '../db.js';
import { httpError } from '../util.js';

export const settingsRouter = express.Router();

const CURRENCIES = ['USD', 'VND', 'EUR'];

settingsRouter.get('/', (req, res) => {
  res.json({ currency: getSetting('currency', 'USD') });
});

settingsRouter.put('/', (req, res, next) => {
  const { currency } = req.body || {};
  if (currency !== undefined) {
    if (!CURRENCIES.includes(currency)) return next(httpError(400, 'Đơn vị tiền tệ không hỗ trợ'));
    setSetting('currency', currency);
  }
  res.json({ ok: true });
});
