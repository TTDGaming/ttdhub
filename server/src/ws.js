import { WebSocketServer } from 'ws';
import { getSessionUser } from './auth.js';
import { getLoginSession, attachWebSocket } from './services/loginSession.js';

/**
 * WebSocket /ws/login/:sessionId — stream màn hình trình duyệt đăng nhập
 * và nhận sự kiện chuột/bàn phím từ web app.
 */
export function setupWebSocket(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const match = (req.url || '').match(/^\/ws\/login\/([a-f0-9]+)$/);
    if (!match) {
      socket.destroy();
      return;
    }
    // Chỉ người đã đăng nhập tool mới được xem phiên
    if (!getSessionUser(req)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    const session = getLoginSession(match[1]);
    if (!session) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      attachWebSocket(session, ws).catch(() => {
        try { ws.close(); } catch { /* đã đóng */ }
      });
    });
  });
}
