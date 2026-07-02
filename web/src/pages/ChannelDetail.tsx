import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Account, HistoryPoint } from '../types';
import { PlatformBadge, Avatar, Spinner, StatCard, MonetizedBadge, StatusPill } from '../components/bits';
import { TimeAreaChart, TimeBarChart } from '../components/charts';
import ConnectModal from '../components/ConnectModal';
import { IconGlobe, IconRefresh } from '../components/icons';
import { fmtCompact, fmtDayHour, fmtPercent, fmtTime, PLATFORM_COLOR } from '../format';

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
  const [browserOpen, setBrowserOpen] = useState(false);

  const load = useCallback(async () => {
    const acc = await api.get<Account>(`/api/accounts/${id}`);
    setAccount(acc);
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

  // ----- Tăng trưởng -----
  const data = useMemo(
    () => points.map((p) => ({ t: p.t, views: p.views, followers: p.followers, likes: p.likes })),
    [points]
  );
  const hasViews = points.some((p) => p.views != null);
  const hasLikes = points.some((p) => p.likes != null);

  // Chuỗi "giá trị mới theo kỳ": 48h → theo giờ, còn lại → theo ngày
  const growthSeries = useMemo(() => {
    const bucketMs = range === '48h' ? 3600_000 : 24 * 3600_000;
    const build = (key: 'views' | 'followers' | 'likes') => {
      const byBucket = new Map<number, number>();
      for (const p of points) {
        const v = p[key];
        if (v != null) byBucket.set(Math.floor(p.t / bucketMs) * bucketMs, v); // giá trị cuối mỗi kỳ
      }
      const sorted = [...byBucket.entries()].sort((a, b) => a[0] - b[0]);
      const out: { t: number; delta: number }[] = [];
      for (let i = 1; i < sorted.length; i++) {
        out.push({ t: sorted[i][0], delta: Math.max(0, sorted[i][1] - sorted[i - 1][1]) });
      }
      return out;
    };
    return { views: build('views'), followers: build('followers'), likes: build('likes') };
  }, [points, range]);

  // % tăng trưởng trong khoảng đang xem
  const growthRate = useMemo(() => {
    const rate = (key: 'views' | 'followers') => {
      const vals = points.map((p) => p[key]).filter((v): v is number => v != null);
      if (vals.length < 2 || vals[0] === 0) return null;
      return (vals[vals.length - 1] - vals[0]) / vals[0];
    };
    return { views: rate('views'), followers: rate('followers') };
  }, [points]);

  if (!account) return <div className="text-sm text-muted">Đang tải…</div>;
  const color = PLATFORM_COLOR[account.platform];
  const growthUnit = range === '48h' ? 'giờ' : 'ngày';

  return (
    <div>
      <div className="mb-4"><Link to="/channels" className="text-xs text-muted hover:text-brand">← Danh sách kênh</Link></div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Avatar url={account.avatar_url} name={account.name} size={56} />
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold">{account.name}</h1>
              <PlatformBadge platform={account.platform} />
              <MonetizedBadge value={account.monetized} />
              <StatusPill status={account.status} />
            </div>
            <div className="text-sm text-muted mt-0.5">
              {account.handle || account.external_id} · cập nhật {fmtTime(account.stats?.takenAt)}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="btn-ghost" onClick={() => setBrowserOpen(true)} title="Mở trình duyệt cách ly của kênh — đăng nhập lại khi hết phiên, kiểm tra kênh">
            <IconGlobe size={16} /> Trình duyệt kênh
          </button>
          <button className="btn-ghost" onClick={refresh} disabled={busy}>
            {busy ? <Spinner /> : <IconRefresh size={16} />} Lấy số liệu
          </button>
          <button className="btn-danger" onClick={remove}>Gỡ kênh</button>
        </div>
      </div>

      {account.status === 'error' && (
        <div className="mb-4 alert-neg flex items-center justify-between gap-3">
          <span>Phiên đăng nhập của kênh đã hết hạn — các job đăng video đang tạm dừng.</span>
          <button className="btn-primary !py-1.5" onClick={() => setBrowserOpen(true)}>Đăng nhập lại</button>
        </div>
      )}
      {error && <div className="text-sm text-neg mb-4">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Follower" value={fmtCompact(account.stats?.followers)} delta={account.stats?.followers48h} hint="48h" />
        {hasViews && <StatCard label="Tổng view" value={fmtCompact(account.stats?.views)} delta={account.stats?.views48h} hint="48h" />}
        {hasLikes && <StatCard label="Lượt thích" value={fmtCompact(account.stats?.likes)} delta={account.stats?.likes48h} hint="48h" />}
        <StatCard label="Số video" value={fmtCompact(account.stats?.videos)} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
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
        <div className="text-xs text-muted">
          Tốc độ tăng trưởng ({RANGES.find((r) => r.key === range)?.label}):{' '}
          {hasViews && (
            <span className="mr-3">
              view <b className={growthRate.views && growthRate.views > 0 ? 'text-pos' : 'text-ink'}>{fmtPercent(growthRate.views)}</b>
            </span>
          )}
          <span>
            follower <b className={growthRate.followers && growthRate.followers > 0 ? 'text-pos' : 'text-ink'}>{fmtPercent(growthRate.followers)}</b>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {hasViews && (
          <ChartCard title="Tổng lượt xem">
            <TimeAreaChart data={data} dataKey="views" name="Lượt xem" color={color} height={220} />
          </ChartCard>
        )}
        <ChartCard title="Follower / Người đăng ký">
          <TimeAreaChart data={data} dataKey="followers" name="Follower" color="var(--series-blue)" height={220} />
        </ChartCard>
        {hasLikes && (
          <ChartCard title="Lượt thích">
            <TimeAreaChart data={data} dataKey="likes" name="Lượt thích" color="var(--series-aqua)" height={220} />
          </ChartCard>
        )}
      </div>

      {/* Tốc độ tăng trưởng */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {hasViews && growthSeries.views.length >= 2 && (
          <ChartCard title={`View mới theo ${growthUnit}`}>
            <TimeBarChart data={growthSeries.views} dataKey="delta" name="View mới" color={color} xFormatter={fmtDayHour} />
          </ChartCard>
        )}
        {growthSeries.followers.length >= 2 && (
          <ChartCard title={`Follower mới theo ${growthUnit}`}>
            <TimeBarChart data={growthSeries.followers} dataKey="delta" name="Follower mới" color="var(--series-blue)" xFormatter={fmtDayHour} />
          </ChartCard>
        )}
        {!hasViews && growthSeries.likes.length >= 2 && (
          <ChartCard title={`Lượt thích mới theo ${growthUnit}`}>
            <TimeBarChart data={growthSeries.likes} dataKey="delta" name="Tim mới" color="var(--series-aqua)" xFormatter={fmtDayHour} />
          </ChartCard>
        )}
      </div>

      <ChannelSettings account={account} onSaved={load} />

      {browserOpen && (
        <ConnectModal
          platform={account.platform}
          accountId={account.id}
          onClose={(ok) => {
            setBrowserOpen(false);
            if (ok) load();
          }}
        />
      )}
    </div>
  );
}

function ChannelSettings({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const [monetized, setMonetized] = useState(account.monetized);
  const [rpm, setRpm] = useState(account.rpm != null ? String(account.rpm) : '');
  const [note, setNote] = useState(account.note || '');
  const [pageUrl, setPageUrl] = useState(account.page_url || '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMonetized(account.monetized);
    setRpm(account.rpm != null ? String(account.rpm) : '');
    setNote(account.note || '');
    setPageUrl(account.page_url || '');
  }, [account]);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      await api.patch(`/api/accounts/${account.id}`, {
        monetized,
        rpm: rpm === '' ? null : Number(rpm),
        note,
        ...(account.platform === 'facebook' ? { pageUrl } : {}),
      });
      onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card px-5 py-4">
      <div className="font-semibold text-sm mb-3">Thiết lập kênh</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <label className="label">Trạng thái kiếm tiền (BKT)</label>
          <select className="input" value={monetized} onChange={(e) => setMonetized(e.target.value as Account['monetized'])}>
            <option value="unknown">Chưa rõ</option>
            <option value="yes">Đã bật kiếm tiền</option>
            <option value="no">Chưa bật kiếm tiền</option>
          </select>
        </div>
        <div>
          <label className="label">RPM — doanh thu ước tính / 1000 view</label>
          <input className="input" type="number" min="0" step="any" value={rpm}
            onChange={(e) => setRpm(e.target.value)} placeholder="ví dụ: 1.5" />
        </div>
        <div>
          <label className="label">Ghi chú</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="nội dung, người phụ trách..." />
        </div>
        {account.platform === 'facebook' && (
          <div className="lg:col-span-3">
            <label className="label">URL Trang (bắt buộc để đăng video lên Trang)</label>
            <input className="input" value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://www.facebook.com/tenTrang" />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />} Lưu thiết lập</button>
        {saved && <span className="text-sm text-pos">✓ Đã lưu</span>}
        <span className="text-xs text-muted">RPM dùng để ước tính doanh thu ở trang Doanh thu (kênh YouTube).</span>
      </div>
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
