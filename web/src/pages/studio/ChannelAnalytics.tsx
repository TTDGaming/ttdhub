import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { ChannelVideo, HistoryPoint } from '../../types';
import { StatCard } from '../../components/bits';
import { ChartSkeleton } from '../../components/Skeletons';
import { TimeAreaChart, TimeBarChart } from '../../components/charts';
import Segmented from '../../components/Segmented';
import { fmtCompact, fmtDayHour, fmtPercent, PLATFORM_COLOR } from '../../format';
import { useStudio } from './StudioChannel';

const RANGES = [
  { key: '48h', label: '48 giờ' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: '90d', label: '90 ngày' },
];

export default function ChannelAnalytics() {
  const { account } = useStudio();
  const [range, setRange] = useState('7d');
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  const [top, setTop] = useState<{ video_id: string; title: string; value: number }[]>([]);

  useEffect(() => {
    setPoints(null);
    api.get<{ points: HistoryPoint[] }>(`/api/stats/accounts/${account.id}/history?range=${range}`)
      .then((h) => setPoints(h.points)).catch(() => setPoints([]));
  }, [account.id, range]);

  useEffect(() => {
    api.get<{ videos: { video_id: string; title: string; value: number }[] }>(`/api/accounts/${account.id}/videos/top?metric=views&limit=8`)
      .then((r) => setTop(r.videos)).catch(() => setTop([]));
  }, [account.id]);

  const data = useMemo(() => (points || []).map((p) => ({ t: p.t, views: p.views, followers: p.followers, likes: p.likes })), [points]);
  const hasViews = (points || []).some((p) => p.views != null);
  const hasLikes = (points || []).some((p) => p.likes != null);
  const color = PLATFORM_COLOR[account.platform];
  const unit = range === '48h' ? 'giờ' : 'ngày';

  const growthSeries = useMemo(() => {
    const bucketMs = range === '48h' ? 3600_000 : 24 * 3600_000;
    const build = (key: 'views' | 'followers') => {
      const byBucket = new Map<number, number>();
      for (const p of points || []) {
        const v = p[key];
        if (v != null) byBucket.set(Math.floor(p.t / bucketMs) * bucketMs, v);
      }
      const sorted = [...byBucket.entries()].sort((a, b) => a[0] - b[0]);
      const out: { t: number; delta: number }[] = [];
      for (let i = 1; i < sorted.length; i++) out.push({ t: sorted[i][0], delta: Math.max(0, sorted[i][1] - sorted[i - 1][1]) });
      return out;
    };
    return { views: build('views'), followers: build('followers') };
  }, [points, range]);

  const rate = useMemo(() => {
    const r = (key: 'views' | 'followers') => {
      const vals = (points || []).map((p) => p[key]).filter((v): v is number => v != null);
      if (vals.length < 2 || vals[0] === 0) return null;
      return (vals[vals.length - 1] - vals[0]) / vals[0];
    };
    return { views: r('views'), followers: r('followers') };
  }, [points]);

  const maxTop = Math.max(1, ...top.map((v) => v.value));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <Segmented options={RANGES} value={range} onChange={setRange} />
        <div className="text-xs text-muted">
          Tăng trưởng {RANGES.find((r) => r.key === range)?.label}:{' '}
          {hasViews && <span className="mr-3">view <b className={rate.views && rate.views > 0 ? 'text-pos' : 'text-ink'}>{fmtPercent(rate.views)}</b></span>}
          <span>follower <b className={rate.followers && rate.followers > 0 ? 'text-pos' : 'text-ink'}>{fmtPercent(rate.followers)}</b></span>
        </div>
      </div>

      {points === null ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton height={220} /><ChartSkeleton height={220} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {hasViews && <ChartCard title="Tổng lượt xem"><TimeAreaChart data={data} dataKey="views" name="Lượt xem" color={color} height={220} /></ChartCard>}
            <ChartCard title="Follower / Người đăng ký"><TimeAreaChart data={data} dataKey="followers" name="Follower" color="var(--series-blue)" height={220} /></ChartCard>
            {hasLikes && <ChartCard title="Lượt thích"><TimeAreaChart data={data} dataKey="likes" name="Lượt thích" color="var(--series-aqua)" height={220} /></ChartCard>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {hasViews && growthSeries.views.length >= 2 && (
              <ChartCard title={`View mới theo ${unit}`}><TimeBarChart data={growthSeries.views} dataKey="delta" name="View mới" color={color} xFormatter={fmtDayHour} /></ChartCard>
            )}
            {growthSeries.followers.length >= 2 && (
              <ChartCard title={`Follower mới theo ${unit}`}><TimeBarChart data={growthSeries.followers} dataKey="delta" name="Follower mới" color="var(--series-blue)" xFormatter={fmtDayHour} /></ChartCard>
            )}
          </div>
        </>
      )}

      {top.length > 0 && (
        <div className="card px-5 py-4">
          <div className="font-semibold text-sm mb-3">Video xem nhiều nhất</div>
          <div className="space-y-2.5">
            {top.map((v, i) => (
              <div key={v.video_id} className="flex items-center gap-3">
                <span className="text-xs text-muted w-5 text-right tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate mb-1">{v.title}</div>
                  <div className="h-2 rounded-full bg-page overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(v.value / maxTop) * 100}%`, background: color }} />
                  </div>
                </div>
                <span className="text-sm font-medium tabular-nums w-16 text-right">{fmtCompact(v.value)}</span>
              </div>
            ))}
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
