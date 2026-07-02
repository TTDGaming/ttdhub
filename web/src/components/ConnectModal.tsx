import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { PLATFORM_LABEL } from '../format';
import { Spinner } from './bits';

const VIEW_W = 1280;
const VIEW_H = 800;

/**
 * Trình duyệt đăng nhập từ xa: hiển thị màn hình Chromium chạy trên server
 * (stream JPEG qua WebSocket) và chuyển tiếp chuột/bàn phím của người dùng.
 * Mỗi phiên dùng một profile cách ly riêng cho tài khoản mới.
 */
export default function ConnectModal({ platform, accountId, onClose }: {
  platform: string;
  /** Có accountId = mở lại trình duyệt của kênh đã kết nối (đăng nhập lại / kiểm tra). */
  accountId?: number;
  onClose: (connected: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [phase, setPhase] = useState<'starting' | 'live' | 'finishing'>('starting');
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [url, setUrl] = useState('');

  const send = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  // Khởi tạo phiên + WebSocket
  useEffect(() => {
    let alive = true;
    let checkTimer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const { sessionId } = await api.post<{ sessionId: string }>(
          accountId ? `/api/accounts/${accountId}/open-browser` : `/api/accounts/connect/${platform}`
        );
        if (!alive) {
          api.post(`/api/accounts/connect/session/${sessionId}/cancel`).catch(() => {});
          return;
        }
        sessionRef.current = sessionId;
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${location.host}/ws/login/${sessionId}`);
        wsRef.current = ws;

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'frame') {
              const img = new Image();
              img.onload = () => {
                const ctx = canvasRef.current?.getContext('2d');
                if (ctx) ctx.drawImage(img, 0, 0, VIEW_W, VIEW_H);
              };
              img.src = `data:image/jpeg;base64,${msg.data}`;
              setPhase((p) => (p === 'starting' ? 'live' : p));
            } else if (msg.type === 'url') {
              setUrl(msg.url);
            }
          } catch { /* bỏ frame lỗi */ }
        };
        ws.onerror = () => setError('Mất kết nối stream trình duyệt');

        checkTimer = setInterval(async () => {
          if (!sessionRef.current) return;
          try {
            const r = await api.get<{ loggedIn: boolean }>(
              `/api/accounts/connect/session/${sessionRef.current}/check`
            );
            setLoggedIn(r.loggedIn);
          } catch { /* phiên có thể đã đóng */ }
        }, 3000);
      } catch (err) {
        setError((err as Error).message);
      }
    })();

    return () => {
      alive = false;
      if (checkTimer) clearInterval(checkTimer);
      wsRef.current?.close();
    };
  }, [platform, accountId]);

  // Chuyển tọa độ chuột trên canvas về không gian 1280×800 của trình duyệt server
  const coords = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * VIEW_W),
      y: Math.round(((e.clientY - rect.top) / rect.height) * VIEW_H),
    };
  };
  const buttonName = (b: number) => (b === 2 ? 'right' : b === 1 ? 'middle' : 'left');

  const lastMove = useRef(0);
  const handlers = {
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault();
      canvasRef.current?.focus();
      send({ type: 'mouse', event: 'mousePressed', ...coords(e), button: buttonName(e.button), clickCount: e.detail || 1 });
    },
    onMouseUp: (e: React.MouseEvent) => {
      e.preventDefault();
      send({ type: 'mouse', event: 'mouseReleased', ...coords(e), button: buttonName(e.button), clickCount: e.detail || 1 });
    },
    onMouseMove: (e: React.MouseEvent) => {
      const t = Date.now();
      if (t - lastMove.current < 30) return;
      lastMove.current = t;
      send({ type: 'mouse', event: 'mouseMoved', ...coords(e), buttons: e.buttons });
    },
    onWheel: (e: React.WheelEvent) => {
      send({ type: 'mouse', event: 'mouseWheel', ...coords(e), deltaX: e.deltaX, deltaY: e.deltaY });
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onKeyDown: (e: React.KeyboardEvent) => {
      // Cho phép dán bằng Ctrl/Cmd+V (xử lý ở onPaste)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') return;
      e.preventDefault();
      send({
        type: 'key', event: 'keyDown', key: e.key, code: e.code, keyCode: e.keyCode,
        text: e.key.length === 1 ? e.key : undefined, modifiers: modifiers(e),
      });
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      e.preventDefault();
      send({ type: 'key', event: 'keyUp', key: e.key, code: e.code, keyCode: e.keyCode, modifiers: modifiers(e) });
    },
    onPaste: (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text');
      if (text) send({ type: 'paste', text });
    },
  };

  const finish = async () => {
    if (!sessionRef.current) return;
    setPhase('finishing');
    setError(null);
    try {
      await api.post(`/api/accounts/connect/session/${sessionRef.current}/finish`);
      sessionRef.current = null;
      onClose(true);
    } catch (err) {
      setError((err as Error).message);
      setPhase('live');
    }
  };

  const cancel = async () => {
    const id = sessionRef.current;
    sessionRef.current = null;
    if (id) api.post(`/api/accounts/connect/session/${id}/cancel`).catch(() => {});
    onClose(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-5xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-hairline">
          <div>
            <div className="font-semibold text-sm">
              {accountId ? 'Trình duyệt kênh' : 'Kết nối kênh'} {PLATFORM_LABEL[platform] || platform}
            </div>
            <div className="text-[11px] text-muted truncate max-w-xl" title={url}>
              {url || 'Đang mở trang đăng nhập…'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loggedIn ? (
              <span className="text-xs font-medium text-[#006300] bg-[#0ca30c]/10 border border-[#0ca30c]/30 rounded-full px-2.5 py-1">
                ✅ Đã phát hiện đăng nhập
              </span>
            ) : (
              <span className="text-xs text-muted">Đăng nhập tài khoản của bạn trong khung bên dưới</span>
            )}
            <button className="btn-ghost !py-1.5" onClick={cancel}>Hủy</button>
            <button className="btn-primary !py-1.5" onClick={finish} disabled={phase === 'finishing'}>
              {phase === 'finishing' ? <Spinner /> : null} Hoàn tất
            </button>
          </div>
        </div>

        {error && (
          <div className="px-5 py-2 text-sm text-[#d03b3b] bg-[#d03b3b]/5 border-b border-[#d03b3b]/20">{error}</div>
        )}

        <div className="relative bg-black">
          <canvas
            ref={canvasRef}
            width={VIEW_W}
            height={VIEW_H}
            tabIndex={0}
            className="w-full block outline-none cursor-default"
            {...handlers}
          />
          {phase === 'starting' && !error && (
            <div className="absolute inset-0 grid place-items-center text-white/80 text-sm gap-2">
              <div className="flex items-center gap-3">
                <Spinner /> Đang khởi động trình duyệt cách ly trên server…
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-2.5 text-[11px] text-muted border-t border-hairline flex items-center justify-between">
          <span>
            Phiên đăng nhập chạy trong profile trình duyệt riêng trên server — cookie của tài khoản này
            được cách ly hoàn toàn với các tài khoản khác.
          </span>
          <span className="shrink-0 ml-4">Với Facebook: nếu đăng cho Trang, hãy chuyển sang vai Trang trước khi bấm Hoàn tất.</span>
        </div>
      </div>
    </div>
  );
}

function modifiers(e: React.KeyboardEvent): number {
  let m = 0;
  if (e.altKey) m |= 1;
  if (e.ctrlKey) m |= 2;
  if (e.metaKey) m |= 4;
  if (e.shiftKey) m |= 8;
  return m;
}
