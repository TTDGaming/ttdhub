import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Account } from '../types';
import { Modal } from './Modal';
import { Avatar, PlatformBadge } from './bits';
import { useTheme } from '../theme';
import {
  IconBell, IconChannels, IconChart, IconCoins, IconDashboard, IconLink, IconQueue, IconSearch, IconSettings, IconUpload,
} from './icons';

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
  keywords?: string;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { setMode } = useTheme();
  const [q, setQ] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      api.get<Account[]>('/api/accounts').then(setAccounts).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const go = (path: string) => { navigate(path); onClose(); };

  const commands: Cmd[] = useMemo(() => {
    const nav: Cmd[] = [
      { id: 'n1', label: 'Tổng quan', icon: <IconDashboard size={16} />, run: () => go('/'), keywords: 'dashboard home' },
      { id: 'n2', label: 'Kênh', icon: <IconChannels size={16} />, run: () => go('/channels'), keywords: 'channels' },
      { id: 'n3', label: 'Đăng video', icon: <IconUpload size={16} />, run: () => go('/upload'), keywords: 'upload post' },
      { id: 'n4', label: 'Hàng đợi', icon: <IconQueue size={16} />, run: () => go('/jobs'), keywords: 'jobs queue' },
      { id: 'n5', label: 'Doanh thu', icon: <IconCoins size={16} />, run: () => go('/revenue'), keywords: 'revenue money' },
      { id: 'n6', label: 'Thông báo', icon: <IconBell size={16} />, run: () => go('/notifications'), keywords: 'notifications thong bao alerts' },
      { id: 'n7', label: 'Cài đặt', icon: <IconSettings size={16} />, run: () => go('/settings'), keywords: 'settings' },
    ];
    const actions: Cmd[] = [
      { id: 'a1', label: 'Kết nối tài khoản quản lý (Google)', hint: 'Lệnh', icon: <IconLink size={16} />, run: () => go('/channels?connect=manager'), keywords: 'manager google youtube connect' },
      { id: 'a2', label: 'Ghi nhận doanh thu', hint: 'Lệnh', icon: <IconCoins size={16} />, run: () => go('/revenue?add=1'), keywords: 'revenue add' },
      { id: 'a3', label: 'Giao diện sáng', hint: 'Theme', icon: <IconChart size={16} />, run: () => { setMode('light'); onClose(); }, keywords: 'light theme' },
      { id: 'a4', label: 'Giao diện tối', hint: 'Theme', icon: <IconChart size={16} />, run: () => { setMode('dark'); onClose(); }, keywords: 'dark theme' },
    ];
    const chans: Cmd[] = accounts.map((a) => ({
      id: `c${a.id}`,
      label: a.name || 'Kênh',
      hint: a.platform,
      icon: <Avatar url={a.avatar_url} name={a.name} size={18} />,
      run: () => go(`/channels/${a.id}`),
      keywords: `${a.handle || ''} ${a.platform}`,
    }));
    return [...nav, ...actions, ...chans];
  }, [accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter((c) => (c.label + ' ' + (c.keywords || '')).toLowerCase().includes(s));
  }, [q, commands]);

  useEffect(() => { setActive(0); }, [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[active]?.run(); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" className="!rounded-2xl">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-hairline">
        <IconSearch size={18} className="text-muted shrink-0" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Tìm kênh, trang, lệnh…"
          className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-muted"
        />
        <span className="kbd">Esc</span>
      </div>
      <div className="max-h-[52vh] overflow-y-auto py-2">
        {filtered.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted">Không có kết quả</div>}
        {filtered.map((c, i) => (
          <button
            key={c.id}
            onMouseEnter={() => setActive(i)}
            onClick={c.run}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm ${i === active ? 'bg-[var(--hover-wash)]' : ''}`}
          >
            <span className="text-ink-2 shrink-0 grid place-items-center w-[18px]">{c.icon}</span>
            <span className="flex-1 text-ink truncate">{c.label}</span>
            {c.hint && <span className="text-[11px] text-muted shrink-0">{c.hint}</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}
