import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Account, Identity } from '../types';
import { useNotifications, levelStyle } from './Notifications';
import { fmtRelative } from '../format';
import { IconBell, IconChevronRight, IconSearch } from './icons';

const LABELS: Record<string, string> = {
  '': 'Tổng quan',
  channels: 'Kênh',
  managers: 'Kênh',
  upload: 'Đăng video',
  jobs: 'Hàng đợi',
  revenue: 'Doanh thu',
  notifications: 'Thông báo',
  settings: 'Cài đặt',
};

/** Thanh trên cùng: breadcrumb + ô tìm kiếm (mở command palette) + chuông thông báo. */
export default function AppBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const loc = useLocation();
  const parts = loc.pathname.split('/').filter(Boolean);
  const channelId = parts[0] === 'channels' ? parts[1] : undefined;
  const managerId = parts[0] === 'managers' ? parts[1] : undefined;
  const [channelName, setChannelName] = useState<string | null>(null);
  const [managerName, setManagerName] = useState<string | null>(null);

  // Chỉ nạp tên kênh khi ĐỔI kênh — không nạp lại khi chuyển tab con trong Studio.
  useEffect(() => {
    if (channelId) {
      api.get<Account>(`/api/accounts/${channelId}`).then((a) => setChannelName(a.name)).catch(() => setChannelName(null));
    } else {
      setChannelName(null);
    }
  }, [channelId]);

  useEffect(() => {
    if (managerId) {
      api.get<Identity[]>('/api/identities')
        .then((list) => setManagerName(list.find((i) => String(i.id) === managerId)?.name || null))
        .catch(() => setManagerName(null));
    } else setManagerName(null);
  }, [managerId]);

  const crumbs: { label: string; to?: string }[] = [];
  if (parts.length === 0) {
    crumbs.push({ label: 'Tổng quan' });
  } else {
    crumbs.push({ label: LABELS[parts[0]] || parts[0], to: parts[0] === 'managers' ? '/channels' : `/${parts[0]}` });
    if (parts[0] === 'channels' && parts[1]) crumbs.push({ label: channelName || 'Chi tiết kênh' });
    if (parts[0] === 'managers' && parts[1]) crumbs.push({ label: `Báo cáo · ${managerName || 'Tài khoản quản lý'}` });
  }

  return (
    <header
      className="sticky top-0 z-30 border-b border-hairline backdrop-blur"
      style={{ height: 'var(--appbar-h)', background: 'rgb(var(--page-rgb) / 0.8)' }}
    >
      <div className="max-w-6xl mx-auto h-full px-6 flex items-center gap-4">
        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <IconChevronRight size={14} className="text-muted shrink-0" />}
              {c.to ? (
                <Link to={c.to} className="text-ink-2 hover:text-ink truncate">{c.label}</Link>
              ) : (
                <span className="font-medium text-ink truncate">{c.label}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="flex-1" />

        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-sm text-muted hover:text-ink-2 transition-colors w-56 max-w-[40vw]"
        >
          <IconSearch size={15} />
          <span className="flex-1 text-left truncate">Tìm kiếm…</span>
          <span className="kbd">⌘K</span>
        </button>

        <NotificationBell />
      </div>
    </header>
  );
}

function NotificationBell() {
  const { unread, recent, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [ring, setRing] = useState(false);
  const prevUnread = useRef(unread);
  const navigate = useNavigate();

  // Rung chuông khi có thông báo mới (unread tăng).
  useEffect(() => {
    if (unread > prevUnread.current) {
      setRing(true);
      const t = setTimeout(() => setRing(false), 700);
      return () => clearTimeout(t);
    }
    prevUnread.current = unread;
  }, [unread]);
  useEffect(() => { prevUnread.current = unread; }, [unread]);

  const openItem = (id: number, link: string | null) => {
    markRead(id);
    setOpen(false);
    if (link) {
      if (/^https?:\/\//.test(link)) window.open(link, '_blank', 'noopener');
      else navigate(link);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="relative p-2 rounded-lg text-ink-2 hover:text-ink hover:bg-[var(--hover-wash)]"
        title="Thông báo"
      >
        <IconBell size={18} style={ring ? { animation: 'wiggle 0.6s var(--ease-out)', transformOrigin: 'top center' } : undefined} />
        {unread > 0 && <span key={unread} className="badge-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-80 popover z-40 !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-hairline">
            <span className="text-xs font-semibold">Thông báo</span>
            {unread > 0 && (
              <button onMouseDown={(e) => e.preventDefault()} onClick={markAllRead} className="text-[11px] text-brand hover:underline">
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto py-1">
            {recent.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted">Chưa có thông báo nào</div>
            ) : (
              recent.map((n) => (
                <button
                  key={n.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => openItem(n.id, n.link)}
                  className="w-full text-left flex gap-2.5 px-3 py-2 hover:bg-[var(--hover-wash)]"
                >
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: levelStyle(n.level).dot }} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm truncate ${n.read ? 'text-ink-2' : 'font-medium text-ink'}`}>{n.title}</span>
                    {n.body && <span className="block text-[11px] text-muted truncate">{n.body}</span>}
                    <span className="block text-[10px] text-muted mt-0.5">{fmtRelative(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand shrink-0" />}
                </button>
              ))
            )}
          </div>
          <Link
            to="/notifications"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen(false)}
            className="block text-center text-xs text-brand hover:underline px-3 py-2 border-t border-hairline"
          >
            Xem tất cả thông báo
          </Link>
        </div>
      )}
    </div>
  );
}
