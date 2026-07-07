import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AppNotification } from '../types';
import { PageHeader, EmptyState } from '../components/bits';
import { TableSkeleton } from '../components/Skeletons';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useNotifications, levelStyle } from '../components/Notifications';
import { IconBell, IconCheck, IconTrash } from '../components/icons';
import { fmtRelative } from '../format';

const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'unread', label: 'Chưa đọc' },
  { key: 'alert', label: 'Lỗi & cảnh báo' },
];

export default function Notifications() {
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh: refreshBadge } = useNotifications();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  const load = useCallback(async () => {
    setItems(null);
    try {
      const r = await api.get<{ notifications: AppNotification[] }>(`/api/notifications?filter=${filter}&limit=200`);
      setItems(r.notifications);
    } catch (e) {
      toast.error((e as Error).message);
      setItems([]);
    }
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const open = (n: AppNotification) => {
    if (!n.read) api.post(`/api/notifications/${n.id}/read`).then(refreshBadge).catch(() => {});
    if (n.link) {
      if (/^https?:\/\//.test(n.link)) window.open(n.link, '_blank', 'noopener');
      else navigate(n.link);
    } else {
      setItems((list) => list && list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
  };

  const markAll = async () => {
    await api.post('/api/notifications/read-all').catch(() => {});
    await Promise.all([load(), refreshBadge()]);
    toast.success('Đã đánh dấu tất cả là đã đọc');
  };

  const removeOne = async (id: number) => {
    setItems((list) => list && list.filter((x) => x.id !== id));
    await api.delete(`/api/notifications/${id}`).catch(() => {});
    refreshBadge();
  };

  const clearAll = async () => {
    await api.delete('/api/notifications').catch(() => {});
    await Promise.all([load(), refreshBadge()]);
    setClearOpen(false);
    toast.success('Đã xóa toàn bộ thông báo');
  };

  return (
    <div>
      <PageHeader
        title="Thông báo"
        subtitle="Các sự kiện quan trọng: đăng video, lỗi, kênh cần đăng nhập lại, quét kênh…"
        actions={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={markAll}><IconCheck size={16} /> Đọc tất cả</button>
            <button className="btn-ghost" onClick={() => setClearOpen(true)}><IconTrash size={16} /> Xóa hết</button>
          </div>
        }
      />

      <div className="segmented mb-4">
        {FILTERS.map((f) => (
          <button key={f.key} data-active={filter === f.key} className="segmented-item" onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {items === null ? (
        <TableSkeleton rows={6} cols={2} />
      ) : items.length === 0 ? (
        <EmptyState icon={<IconBell />} title="Không có thông báo" hint="Các sự kiện quan trọng sẽ xuất hiện ở đây." />
      ) : (
        <div className="card divide-y divide-[var(--hairline)] overflow-hidden stagger-in">
          {items.map((n) => (
            <div key={n.id} className="flex items-start gap-3 px-4 py-3 group hover:bg-[var(--hover-wash)]">
              <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: levelStyle(n.level).dot }} title={levelStyle(n.level).label} />
              <button className="min-w-0 flex-1 text-left" onClick={() => open(n)}>
                <div className={`text-sm truncate ${n.read ? 'text-ink-2' : 'font-semibold text-ink'}`}>{n.title}</div>
                {n.body && <div className="text-xs text-muted mt-0.5 break-words">{n.body}</div>}
                <div className="text-[11px] text-muted mt-1">{fmtRelative(n.createdAt)}</div>
              </button>
              {!n.read && <span className="mt-1.5 chip chip-info !py-0 shrink-0">Mới</span>}
              <button
                className="p-1.5 rounded-md text-muted hover:text-neg opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                title="Xóa thông báo"
                onClick={() => removeOne(n.id)}
              >
                <IconTrash size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={clearOpen}
        title="Xóa toàn bộ thông báo?"
        message="Tất cả thông báo sẽ bị xóa khỏi lịch sử. Thao tác không thể hoàn tác."
        confirmLabel="Xóa hết"
        danger
        onConfirm={clearAll}
        onClose={() => setClearOpen(false)}
      />
    </div>
  );
}
