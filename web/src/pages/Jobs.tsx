import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { UploadJob } from '../types';
import { PageHeader, PlatformBadge, Avatar, EmptyState, StatusPill } from '../components/bits';
import { fmtTime } from '../format';
import { IconQueue, IconPlus } from '../components/icons';

const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'queued', label: 'Đang chờ' },
  { key: 'uploading', label: 'Đang đăng' },
  { key: 'done', label: 'Hoàn tất' },
  { key: 'error', label: 'Lỗi' },
];

export default function Jobs() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => api.get<UploadJob[]>('/api/uploads/jobs').then(setJobs).catch((e) => setError(e.message)),
    []
  );
  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const shown = jobs.filter((j) => filter === 'all' || j.status === filter);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Hàng đợi đăng video"
        subtitle="Tự cập nhật mỗi 3 giây — job lỗi có ảnh chụp màn hình trong data/debug để tra cứu"
        actions={<Link to="/upload" className="btn-primary"><IconPlus size={16} /> Đăng video</Link>}
      />

      <div className="flex items-center gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              filter === f.key ? 'bg-brand text-white border-brand' : 'bg-surface text-ink-2 border-hairline hover:bg-page'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-neg mb-4">{error}</div>}

      {shown.length === 0 ? (
        <EmptyState icon={<IconQueue />} title="Không có job nào" hint="Tạo lô đăng video mới từ trang Đăng video." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-hairline">
                <th className="px-5 py-2.5 font-medium">Video</th>
                <th className="px-3 py-2.5 font-medium">Kênh</th>
                <th className="px-3 py-2.5 font-medium">Trạng thái</th>
                <th className="px-3 py-2.5 font-medium w-44">Tiến trình</th>
                <th className="px-3 py-2.5 font-medium">Thời gian</th>
                <th className="px-5 py-2.5 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((j) => (
                <tr key={j.id} className="border-b border-hairline last:border-0 align-top row-hover">
                  <td className="px-5 py-3">
                    <div className="font-medium truncate max-w-[260px]" title={j.title}>{j.title}</div>
                    <div className="text-[11px] text-muted truncate max-w-[260px]">{j.original_name}</div>
                    {j.remote_url && (
                      <a href={j.remote_url} target="_blank" rel="noreferrer" className="text-[11px] text-brand hover:underline">
                        Xem video →
                      </a>
                    )}
                    {j.error && <div className="text-[11px] text-neg mt-1 max-w-[260px]">{j.error}</div>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar url={j.avatar_url} name={j.account_name} size={24} />
                      <div>
                        <div className="text-xs font-medium">{j.account_name}</div>
                        <PlatformBadge platform={j.platform} />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={j.status} />
                    {j.schedule_at && j.status === 'queued' && (
                      <div className="text-[11px] text-muted mt-1">hẹn {fmtTime(j.schedule_at)}</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-2 rounded-full bg-page overflow-hidden">
                      <div
                        className={`h-full transition-all ${j.status === 'error' ? 'bg-neg' : j.status === 'done' ? 'bg-pos-strong' : 'bg-brand'}`}
                        style={{ width: `${j.progress}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-muted mt-1 tabular-nums">{j.progress}%</div>
                  </td>
                  <td className="px-3 py-3 text-[11px] text-muted">
                    <div>Tạo: {fmtTime(j.created_at)}</div>
                    {j.finished_at && <div>Xong: {fmtTime(j.finished_at)}</div>}
                  </td>
                  <td className="px-5 py-3 text-right space-x-2 whitespace-nowrap">
                    {['error', 'canceled'].includes(j.status) && (
                      <button className="text-xs text-brand hover:underline" onClick={() => act(() => api.post(`/api/uploads/jobs/${j.id}/retry`))}>
                        Chạy lại
                      </button>
                    )}
                    {j.status === 'queued' && (
                      <button className="text-xs text-neg hover:underline" onClick={() => act(() => api.post(`/api/uploads/jobs/${j.id}/cancel`))}>
                        Hủy
                      </button>
                    )}
                    {['done', 'error', 'canceled'].includes(j.status) && (
                      <button className="text-xs text-muted hover:underline" onClick={() => act(() => api.delete(`/api/uploads/jobs/${j.id}`))}>
                        Xóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
