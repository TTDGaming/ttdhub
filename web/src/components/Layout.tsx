import { ComponentType, ReactNode, SVGProps, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ThemeMode, useTheme } from '../theme';
import AppBar from './AppBar';
import CommandPalette from './CommandPalette';
import { useNotifications } from './Notifications';
import {
  IconBell, IconChannels, IconCoins, IconDashboard, IconLogout, IconMonitor, IconMoon,
  IconQueue, IconSettings, IconSun, IconUpload,
} from './icons';

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const SECTIONS: { title: string; items: { to: string; label: string; icon: Icon; badge?: 'unread' }[] }[] = [
  {
    title: 'Điều hướng',
    items: [
      { to: '/', label: 'Tổng quan', icon: IconDashboard },
      { to: '/channels', label: 'Kênh', icon: IconChannels },
    ],
  },
  {
    title: 'Nội dung',
    items: [
      { to: '/upload', label: 'Đăng video', icon: IconUpload },
      { to: '/jobs', label: 'Hàng đợi', icon: IconQueue },
    ],
  },
  {
    title: 'Kinh doanh',
    items: [{ to: '/revenue', label: 'Doanh thu', icon: IconCoins }],
  },
  {
    title: 'Hệ thống',
    items: [
      { to: '/notifications', label: 'Thông báo', icon: IconBell, badge: 'unread' },
      { to: '/settings', label: 'Cài đặt', icon: IconSettings },
    ],
  },
];

export default function Layout({ username, onLogout, children }: {
  username: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { unread } = useNotifications();
  const loc = useLocation();
  const parts = loc.pathname.split('/').filter(Boolean);
  // Trong "Studio kênh" mọi tab con dùng chung một key để không remount shell.
  const animKey = parts[0] === 'channels' && parts[1] ? `/channels/${parts[1]}` : loc.pathname;

  // ⌘K / Ctrl+K mở command palette. Bỏ qua khi trình duyệt nhúng (canvas) đang
  // nhận phím — tránh cướp phím của luồng đăng nhập từ xa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const el = document.activeElement as HTMLElement | null;
        if (el?.hasAttribute('data-remote-canvas')) return;
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 flex flex-col text-white" style={{ background: 'var(--sidebar)' }}>
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-brand grid place-items-center font-bold text-sm text-white">MS</div>
          <div>
            <div className="font-semibold leading-tight">MS Hub</div>
            <div className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>Quản lý đa kênh</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {SECTIONS.map((section) => (
            <div key={section.title} className="mb-4">
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sidebar-muted)' }}>
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map(({ to, label, icon: Icon, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 rounded-lg pl-3 pr-2 py-2 text-sm transition-colors ${
                        isActive ? 'bg-brand text-white font-medium' : 'hover:bg-white/5'
                      }`
                    }
                    style={({ isActive }) => (isActive ? {} : { color: 'var(--sidebar-ink)' })}
                  >
                    <Icon size={17} className="shrink-0 opacity-90" />
                    <span className="flex-1">{label}</span>
                    {badge === 'unread' && unread > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold text-white grid place-items-center shrink-0" style={{ background: 'var(--neg)' }}>
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-white/10">
          <ThemeSwitch />
        </div>
        <div className="px-4 pb-4 pt-1 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{username}</div>
            <div className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>Quản trị viên</div>
          </div>
          <button onClick={onLogout} className="text-white/60 hover:text-white border border-white/15 rounded-md p-1.5" title="Đăng xuất">
            <IconLogout size={15} />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <AppBar onOpenPalette={() => setPaletteOpen(true)} />
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* Key theo section, KHÔNG theo pathname đầy đủ — nếu không, chuyển tab
              trong "Studio kênh" (/channels/:id/*) sẽ remount cả shell và nạp lại kênh. */}
          <div key={animKey} className="animate-page">{children}</div>
        </div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function ThemeSwitch() {
  const { mode, setMode } = useTheme();
  const options: { key: ThemeMode; icon: Icon; label: string }[] = [
    { key: 'light', icon: IconSun, label: 'Sáng' },
    { key: 'dark', icon: IconMoon, label: 'Tối' },
    { key: 'system', icon: IconMonitor, label: 'Theo hệ thống' },
  ];
  return (
    <div className="flex rounded-lg bg-white/5 border border-white/10 p-0.5">
      {options.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          onClick={() => setMode(key)}
          title={label}
          aria-label={label}
          className={`flex-1 grid place-items-center rounded-md py-1.5 transition-colors ${
            mode === key ? 'bg-brand text-white' : 'text-white/50 hover:text-white'
          }`}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
