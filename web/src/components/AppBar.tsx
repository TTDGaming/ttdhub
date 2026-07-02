import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import { Account, UploadJob } from '../types';
import { IconBell, IconChevronRight, IconSearch } from './icons';

const LABELS: Record<string, string> = {
  '': 'Tổng quan',
  channels: 'Kênh',
  upload: 'Đăng video',
  jobs: 'Hàng đợi',
  revenue: 'Doanh thu',
  settings: 'Cài đặt',
};

/** Thanh trên cùng: breadcrumb + ô tìm kiếm (mở command palette) + chuông thông báo. */
export default function AppBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const loc = useLocation();
  const parts = loc.pathname.split('/').filter(Boolean);
  const channelId = parts[0] === 'channels' ? parts[1] : undefined;
  const [channelName, setChannelName] = useState<string | null>(null);

  // Chỉ nạp tên kênh khi ĐỔI kênh — không nạp lại khi chuyển tab con trong Studio.
  useEffect(() => {
    if (channelId) {
      api.get<Account>(`/api/accounts/${channelId}`).then((a) => setChannelName(a.name)).catch(() => setChannelName(null));
    } else {
      setChannelName(null);
    }
  }, [channelId]);

  const crumbs: { label: string; to?: string }[] = [];
  if (parts.length === 0) {
    crumbs.push({ label: 'Tổng quan' });
  } else {
    crumbs.push({ label: LABELS[parts[0]] || parts[0], to: `/${parts[0]}` });
    if (parts[0] === 'channels' && parts[1]) crumbs.push({ label: channelName || 'Chi tiết kênh' });
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
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<{ text: string; to: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [accounts, jobs] = await Promise.all([
          api.get<Account[]>('/api/accounts'),
          api.get<UploadJob[]>('/api/uploads/jobs?limit=100'),
        ]);
        if (!alive) return;
        const needReauth = accounts.filter((a) => a.status === 'error');
        const errored = jobs.filter((j) => j.status === 'error');
        const list = [
          ...needReauth.map((a) => ({ text: `Kênh "${a.name}" cần đăng nhập lại`, to: `/channels/${a.id}` })),
          ...errored.slice(0, 8).map((j) => ({ text: `Job lỗi: ${j.title}`, to: '/jobs' })),
        ];
        setItems(list);
        setCount(list.length);
      } catch { /* bỏ qua */ }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="relative p-2 rounded-lg text-ink-2 hover:text-ink hover:bg-[var(--hover-wash)]"
        title="Thông báo"
      >
        <IconBell size={18} />
        {count > 0 && <span className="badge-count">{count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-72 popover z-40">
          <div className="px-3 py-2 text-xs font-medium text-muted">Thông báo</div>
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted">Không có cảnh báo nào</div>
          ) : (
            items.map((it, i) => (
              <Link key={i} to={it.to} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm text-ink-2 hover:bg-[var(--hover-wash)] hover:text-ink">
                {it.text}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
