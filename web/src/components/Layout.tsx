import { ComponentType, ReactNode, SVGProps } from 'react';
import { NavLink } from 'react-router-dom';
import { ThemeMode, useTheme } from '../theme';
import {
  IconChannels, IconCoins, IconDashboard, IconLogout, IconMonitor, IconMoon,
  IconQueue, IconSettings, IconSun, IconUpload,
} from './icons';

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const NAV: { to: string; label: string; icon: Icon }[] = [
  { to: '/', label: 'Tổng quan', icon: IconDashboard },
  { to: '/channels', label: 'Kênh', icon: IconChannels },
  { to: '/upload', label: 'Đăng video', icon: IconUpload },
  { to: '/jobs', label: 'Hàng đợi', icon: IconQueue },
  { to: '/revenue', label: 'Doanh thu', icon: IconCoins },
  { to: '/settings', label: 'Cài đặt', icon: IconSettings },
];

export default function Layout({ username, onLogout, children }: {
  username: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 bg-sidebar text-white flex flex-col">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-brand grid place-items-center font-bold text-sm text-white">MS</div>
          <div>
            <div className="font-semibold leading-tight">MS Hub</div>
            <div className="text-[11px] text-white/50">Quản lý đa kênh</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-brand text-white font-medium' : 'text-white/70 hover:bg-sidebar-2 hover:text-white'
                }`
              }
            >
              <Icon size={18} className="shrink-0 opacity-90" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-white/10">
          <ThemeSwitch />
        </div>
        <div className="px-4 pb-4 pt-1 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{username}</div>
            <div className="text-[11px] text-white/50">Quản trị viên</div>
          </div>
          <button
            onClick={onLogout}
            className="text-white/60 hover:text-white border border-white/15 rounded-md p-1.5"
            title="Đăng xuất"
          >
            <IconLogout size={15} />
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">{children}</div>
      </main>
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
