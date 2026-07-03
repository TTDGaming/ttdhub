import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PORT, HOST, WEB_DIST, DATA_DIR } from './config.js';
import { authRouter, requireAuth } from './auth.js';
import { accountsRouter } from './routes/accounts.js';
import { contentRouter } from './routes/content.js';
import { identitiesRouter } from './routes/identities.js';
import { uploadsRouter } from './routes/uploads.js';
import { statsRouter } from './routes/stats.js';
import { revenueRouter } from './routes/revenue.js';
import { settingsRouter } from './routes/settings.js';
import { notificationsRouter } from './routes/notifications.js';
import { setupWebSocket } from './ws.js';
import { startQueue } from './services/queue.js';
import { startPoller } from './services/poller.js';
import { closeAll } from './services/browser.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'MS Hub' }));
app.use('/api/auth', authRouter);
app.use('/api/identities', requireAuth, identitiesRouter);
app.use('/api/accounts', requireAuth, accountsRouter);
app.use('/api/accounts', requireAuth, contentRouter); // /:id/videos, /:id/comments...
app.use('/api/uploads', requireAuth, uploadsRouter);
app.use('/api/stats', requireAuth, statsRouter);
app.use('/api/revenue', requireAuth, revenueRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/notifications', requireAuth, notificationsRouter);

// Frontend build (SPA)
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get(/^(?!\/api|\/ws).*/, (req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
} else {
  app.get('/', (req, res) =>
    res.status(503).send('Chưa build giao diện. Chạy: npm run build (trong thư mục gốc dự án).')
  );
}

// Xử lý lỗi tập trung
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Lỗi máy chủ' });
});

const server = http.createServer(app);
setupWebSocket(server);

server.listen(PORT, HOST, () => {
  console.log(`MS Hub đang chạy: http://localhost:${PORT}`);
  console.log(`Dữ liệu lưu tại: ${DATA_DIR}`);
  startQueue();
  startPoller();
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log('\nĐang tắt MS Hub...');
    server.close();
    await closeAll();
    process.exit(0);
  });
}
