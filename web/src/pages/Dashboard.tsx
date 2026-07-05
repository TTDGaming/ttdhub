import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Overview, RevenueSummary } from '../types';
import { PageHeader, StatCard, PlatformBadge, Avatar, EmptyState, MonetizedBadge } from '../components/bits';
import { PageSkeleton } from '../components/Skeletons';
import { useToast } from '../components/Toast';
import { TimeAreaChart, Sparkline } from '../components/charts';
import { IconChannels, IconDownload } from '../components/icons';
import { fmtCompact, fmtDelta, fmtMoney, PLATFORM_COLOR } from '../format';

export default function Dashboard() {
  const toast = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);

  const load = () =>
    Promise.all([
      api.get<Overview>('/api/stats/overview').then(setData),
      api.get<RevenueSummary>('/api/revenue/summary').then(setRevenue).catch(() => {}),
    ]).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  // Gộp view 48h toàn hệ thống theo mốc giờ (delta giữa các snapshot của từng kênh)
  const aggregate = useMemo(() => {
    if (!data) return [];
    const buckets = new Map<number, number>();
    for (const acc of data.accounts) {
      for (let i = 1; i < acc.spark.length; i++) {
        const delta = Math.max(0, acc.spark[i].v - acc.spark[i - 1].v);
        const bucket = Math.floor(acc.spark[i].t / 3_600_000) * 3_600_000;
        buckets.set(bucket, (buckets.get(bucket) || 0) + delta);
      }
    }
    return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, tang: v }));
  }, [data]);

  if (!data) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        subtitle="Toàn bộ kênh của bạn trong một màn hình — số liệu cập nhật tự động"
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6 stagger-in">
        <StatCard label="Kênh đã kết nối" count={data.accountCount} format={(n) => String(Math.round(n))} hint="YouTube · TikTok · Facebook" />
        <StatCard label="View 48 giờ" count={data.views48h} format={fmtCompact} delta={data.views48h} hint="so với 48h trước" />
        <StatCard label="Follower tăng 48h" value={fmtDelta(data.followers48h)} delta={data.followers48h} hint="tất cả các kênh" />
        <StatCard
          label="Doanh thu tháng này"
          count={revenue ? revenue.totals.recordedThisMonth : undefined}
          format={(n) => fmtMoney(n, revenue?.currency)}
          value={revenue ? undefined : '—'}
          hint={revenue ? `ước tính 30d ${fmtMoney(revenue.totals.est30, revenue.currency)}` : ''}
        />
        <StatCard
          label="Hàng đợi đăng"
          count={data.jobs.uploading + data.jobs.queued}
          format={(n) => String(Math.round(n))}
          hint={`${data.jobs.done48h} xong 48h · ${data.jobs.errors} lỗi`}
        />
      </div>

      <div className="card px-5 py-4 mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <div className="font-semibold text-sm">Lượt xem tăng theo giờ — 48 giờ qua</div>
          <div className="text-xs text-muted">tổng hợp mọi kênh</div>
        </div>
        {aggregate.length >= 2 ? (
          <TimeAreaChart data={aggregate} dataKey="tang" name="View tăng" color="var(--series-blue)" />
        ) : (
          <div className="text-sm text-muted py-10 text-center">
            Chưa đủ dữ liệu — hệ thống thu số liệu mỗi 30 phút sau khi bạn kết nối kênh.
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-hairline flex items-center justify-between">
          <div className="font-semibold text-sm">Hiệu suất từng kênh (48h)</div>
          <div className="flex items-center gap-3">
            <a href="/api/stats/export.csv" className="text-xs text-muted hover:text-brand inline-flex items-center gap-1" download><IconDownload size={13} /> Xuất CSV</a>
            <Link to="/channels" className="text-xs text-brand hover:underline">Quản lý kênh →</Link>
          </div>
        </div>
        {data.accounts.length === 0 ? (
          <EmptyState
            icon={<IconChannels />}
            title="Chưa có kênh nào"
            hint="Kết nối kênh đầu tiên bằng cách đăng nhập ngay trong tool — không cần API key."
            action={<Link to="/channels" className="btn-primary">Kết nối kênh</Link>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-hairline">
                <th className="px-5 py-2.5 font-medium">Kênh</th>
                <th className="px-3 py-2.5 font-medium">Nền tảng</th>
                <th className="px-3 py-2.5 font-medium">Kiếm tiền</th>
                <th className="px-3 py-2.5 font-medium text-right">Follower</th>
                <th className="px-3 py-2.5 font-medium text-right">View 48h</th>
                <th className="px-3 py-2.5 font-medium text-right">Follower 48h</th>
                <th className="px-5 py-2.5 font-medium text-right">Xu hướng 48h</th>
              </tr>
            </thead>
            <tbody className="stagger-in">
              {data.accounts.map((acc) => (
                <tr key={acc.id} className="border-b border-hairline last:border-0 row-hover">
                  <td className="px-5 py-3">
                    <Link to={`/channels/${acc.id}`} className="flex items-center gap-3 group">
                      <Avatar url={acc.avatarUrl} name={acc.name} size={32} />
                      <div className="min-w-0">
                        <div className="font-medium truncate group-hover:text-brand">
                          {acc.name || '—'}
                          {acc.status === 'error' && (
                            <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-neg align-middle" title="Cần đăng nhập lại" />
                          )}
                        </div>
                        <div className="text-[11px] text-muted truncate">{acc.handle || ''}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3"><PlatformBadge platform={acc.platform} /></td>
                  <td className="px-3 py-3"><MonetizedBadge value={acc.monetized} /></td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums">{fmtCompact(acc.followers)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <DeltaText value={acc.views48h} />
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <DeltaText value={acc.followers48h} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <Sparkline data={acc.spark} color={PLATFORM_COLOR[acc.platform]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DeltaText({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">—</span>;
  if (value === 0) return <span className="text-muted">0</span>;
  return (
    <span className={value > 0 ? 'text-pos font-medium' : 'text-neg font-medium'}>
      {fmtDelta(value)}
    </span>
  );
}
