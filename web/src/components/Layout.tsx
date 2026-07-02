import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Tổng quan', icon: '📊' },
  { to: '/channels', label: 'Kênh', icon: '📡' },
  { to: '/upload', label: 'Đăng video', icon: '⬆️' },
  { to: '/jobs', label: 'Hàng đợi', icon: '🗂️' },
  { to: '/settings', label: 'Cài đặt', icon: '⚙️' },
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
          <div className="w-9 h-9 rounded-lg bg-brand grid place-items-center font-bold text-sm">MS</div>
          <div>
            <div className="font-semibold leading-tight">MS Hub</div>
            <div className="text-[11px] text-white/50">Quản lý đa kênh</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-brand text-white font-medium' : 'text-white/70 hover:bg-sidebar-2 hover:text-white'
                }`
              }
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{username}</div>
            <div className="text-[11px] text-white/50">Quản trị viên</div>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-white/60 hover:text-white border border-white/15 rounded-md px-2 py-1"
            title="Đăng xuất"
          >
            Thoát
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
