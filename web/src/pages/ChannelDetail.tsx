import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Account, HistoryPoint } from '../types';
import { PageHeader, PlatformBadge, Avatar, Spinner, StatCard } from '../components/bits';
import { TimeAreaChart } from '../components/charts';
import { fmtCompact, fmtTime, PLATFORM_COLOR } from '../format';

const RANGES = [
  { key: '48h', label: '48 giờ' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: '90d', label: '90 ngày' },
];

export default function ChannelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [range, setRange] = useState('48h');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageUrl, setPageUrl] = useState('');

  const load = useCallback(async () => {
    const acc = await api.get<Account>(`/api/accounts/${id}`);
    setAccount(acc);
    setPageUrl(acc.page_url || '');
    const h = await api.get<{ points: HistoryPoint[] }>(`/api/stats/accounts/${id}/history?range=${range}`);
    setPoints(h.points);
  }, [id, range]);

  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/accounts/${id}/refresh-stats`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm('Gỡ kênh này? Toàn bộ cookie đăng nhập + profile trình duyệt của kênh sẽ bị xóa vĩnh viễn.')) return;
    await api.delete(`/api/accounts/${id}`);
    navigate('/channels');
  };

  const savePageUrl = async () => {
    await api.patch(`/api/accounts/${id}`, { pageUrl });
    await load();
  };

  if (!account) return <div className="text-sm text-muted">Đang tải…</div>;
  const color = PLATFORM_COLOR[account.platform];
  const data = points.map((p) => ({ t: p.t, views: p.views, followers: p.followers, likes: p.likes }));
  const hasViews = points.some((p) => p.views != null);
  const hasLikes = points.some((p) => p.likes != null);

  return (
    <div>
      <div className="mb-4"><Link to="/channels" className="text-xs text-muted hover:text-brand">← Danh sách kênh</Link></div>
      <PageHeader
        title=""
        actions={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={refresh} disabled={busy}>
              {busy ? <Spinner /> : '🔄'} Lấy số liệu ngay
            </button>
            <button className="btn-danger" onClick={remove}>Gỡ kênh</button>
          </div>
        }
        subtitle=""
      />
      <div className="flex items-center gap-4 -mt-4 mb-6">
        <Avatar url={account.avatar_url} name={account.name} size={56} />
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{account.name}</h1>
            <PlatformBadge platform={account.platform} />
          </div>
          <div className="text-sm text-muted">
            {account.handle || account.external_id} · cập nhật {fmtTime(account.stats?.takenAt)}
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-[#d03b3b] mb-4">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Follower" value={fmtCompact(account.stats?.followers)} delta={account.stats?.followers48h} hint="48h" />
        {hasViews && <StatCard label="Tổng view" value={fmtCompact(account.stats?.views)} delta={account.stats?.views48h} hint="48h" />}
        {hasLikes && <StatCard label="Lượt thích" value={fmtCompact(account.stats?.likes)} delta={account.stats?.likes48h} hint="48h" />}
        <StatCard label="Số video" value={fmtCompact(account.stats?.videos)} />
      </div>

      <div className="flex items-center gap-1.5 mb-4">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              range === r.key ? 'bg-brand text-white border-brand' : 'bg-surface text-ink-2 border-hairline hover:bg-page'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {hasViews && (
          <ChartCard title="Tổng lượt xem">
            <TimeAreaChart data={data} dataKey="views" name="Lượt xem" color={color} height={220} />
          </ChartCard>
        )}
        <ChartCard title="Follower / Người đăng ký">
          <TimeAreaChart data={data} dataKey="followers" name="Follower" color="#2a78d6" height={220} />
        </ChartCard>
        {hasLikes && (
          <ChartCard title="Lượt thích">
            <TimeAreaChart data={data} dataKey="likes" name="Lượt thích" color="#1baf7a" height={220} />
          </ChartCard>
        )}
      </div>

      {account.platform === 'facebook' && (
        <div className="card px-5 py-4">
          <div className="font-semibold text-sm mb-1">URL Trang (bắt buộc để đăng video lên Trang)</div>
          <p className="text-xs text-muted mb-3">
            Dán liên kết Trang/TCN mà tài khoản này quản lý, ví dụ https://www.facebook.com/tenTrang
          </p>
          <div className="flex gap-2 max-w-xl">
            <input className="input" value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://www.facebook.com/..." />
            <button className="btn-primary shrink-0" onClick={savePageUrl}>Lưu</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card px-5 py-4">
      <div className="font-semibold text-sm mb-2">{title}</div>
      {children}
    </div>
  );
}
