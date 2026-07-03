import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { AppNotification } from '../types';

interface NotifState {
  unread: number;
  recent: AppNotification[];
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
}

const Ctx = createContext<NotifState | null>(null);

interface Resp { unread: number; notifications: AppNotification[] }

/** Nguồn dữ liệu thông báo dùng chung: badge trên chuông + trên sidebar + trang Thông báo. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);
  const [recent, setRecent] = useState<AppNotification[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<Resp>('/api/notifications?limit=10');
      setUnread(r.unread);
      setRecent(r.notifications);
    } catch { /* bỏ qua khi mất mạng */ }
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, 15000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setUnread(0);
    setRecent((r) => r.map((n) => ({ ...n, read: true })));
    await api.post('/api/notifications/read-all').catch(() => {});
    refresh();
  }, [refresh]);

  const markRead = useCallback(async (id: number) => {
    setRecent((r) => r.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await api.post(`/api/notifications/${id}/read`).catch(() => {});
  }, []);

  return <Ctx.Provider value={{ unread, recent, refresh, markAllRead, markRead }}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications phải nằm trong NotificationsProvider');
  return ctx;
}

const STYLE: Record<AppNotification['level'], { dot: string; label: string }> = {
  success: { dot: 'var(--pos-strong)', label: 'Thành công' },
  error: { dot: 'var(--neg)', label: 'Lỗi' },
  warning: { dot: '#eda100', label: 'Cảnh báo' },
  info: { dot: 'rgb(var(--brand-rgb))', label: 'Thông tin' },
};

export function levelStyle(level: AppNotification['level']) {
  return STYLE[level] || STYLE.info;
}
