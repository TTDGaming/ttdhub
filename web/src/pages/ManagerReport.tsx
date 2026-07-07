import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { ManagerReport as Report } from '../types';
import { StatCard, PlatformBadge, Avatar, EmptyState, MonetizedBadge } from '../components/bits';
import { PageSkeleton } from '../components/Skeletons';
import { TimeBarChart } from '../components/charts';
import { useToast } from '../components/Toast';
import { IconChannels, IconUsers } from '../components/icons';
import { fmtCompact, fmtDelta, fmtMoney, fmtMonth } from '../format';

export default function ManagerReport() {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Report>(`/api/identities/${id}/report`).then(setData).catch((e) => { setError(e.message); toast.error(e.message); });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <EmptyState icon={<IconUsers />} title="Không tải được báo cáo" hint={error} action={<Link to="/channels" className="btn-primary">Về danh sách kênh</Link>} />;
  if (!data) return <PageSkeleton />;

  const cur = data.currency;
  const t = data.totals;

  return (
    <div>
      <div className="mb-4">
        <Link to="/channels" className="text-xs text-muted hover:text-brand">← Danh sách kênh</Link>
      </div>

      <div className="flex items-center gap-4 min-w-0 mb-6">
        <div className="w-14 h-14 rounded-xl bg-brand/10 text-brand grid place-items-center shrink-0">
          <IconUsers size={26} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{data.identity.name || 'Tài khoản quản lý'}</h1>
          <div className="text-sm text-muted truncate">
            {data.identity.email} · {t.channels} kênh · {t.managed} được quản lý · {t.monetizedCount} đã BKT
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6 stagger-in">
        <StatCard label="Tổng view" count={t.totalViews} format={fmtCompact} delta={t.views48h} hint="Δ 48h" />
        <StatCard label="Tổng follower" count={t.totalFollowers} format={fmtCompact} delta={t.followers48h} hint="Δ 48h" />
        <StatCard label="Tổng video" count={t.totalVideos} format={fmtCompact} />
        <StatCard label="Doanh thu tháng này" count={t.recordedThisMonth} format={(n) => fmtMoney(n, cur)} hint={fmtMonth(data.thisMonth)} />
        <StatCard label="Ước tính 30 ngày" count={t.est30} format={(n) => fmtMoney(n, cur)} hint="RPM × view 30d" />
      </div>

      <div className="card px-5 py-4 mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <div className="font-semibold text-sm">Doanh thu 12 tháng — toàn bộ kênh của tài khoản</div>
          <div className="text-xs text-muted">tổng 12 tháng {fmtMoney(t.recorded12m, cur)}</div>
        </div>
        <TimeBarChart
          data={data.monthly}
          dataKey="total"
          name="Doanh thu"
          color="var(--series-blue)"
          xKey="month"
          xFormatter={fmtMonth}
          valueFormatter={(v) => fmtMoney(v, cur)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-hairline font-semibold text-sm">Hiệu suất từng kênh</div>
        {data.channels.length === 0 ? (
          <EmptyState icon={<IconChannels />} title="Chưa có kênh" hint="Quét kênh cho tài khoản này ở trang Kênh." />
        ) : (
          <table className="table-modern">
            <thead>
              <tr>
                <th>Kênh</th>
                <th>Kiếm tiền</th>
                <th className="text-right">View</th>
                <th className="text-right">View 48h</th>
                <th className="text-right">Follower</th>
                <th className="text-right">Follower 48h</th>
                <th className="text-right">Ước tính 30d</th>
                <th className="text-right">Tháng này</th>
              </tr>
            </thead>
            <tbody className="stagger-in">
              {data.channels.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/channels/${c.id}`} className="flex items-center gap-2.5 group">
                      <Avatar url={c.avatarUrl} name={c.name} size={28} />
                      <div className="min-w-0">
                        <div className="font-medium truncate group-hover:text-brand">
                          {c.name}
                          {c.role === 'manager' && <span className="ml-1.5 text-[10px] text-muted">(quản lý)</span>}
                        </div>
                        <PlatformBadge platform={c.platform} />
                      </div>
                    </Link>
                  </td>
                  <td><MonetizedBadge value={c.monetized} /></td>
                  <td className="text-right tabular-nums">{fmtCompact(c.views)}</td>
                  <td className="text-right tabular-nums"><Delta v={c.views48h} /></td>
                  <td className="text-right tabular-nums">{fmtCompact(c.followers)}</td>
                  <td className="text-right tabular-nums"><Delta v={c.followers48h} /></td>
                  <td className="text-right tabular-nums">{c.est30 != null ? fmtMoney(c.est30, cur) : '—'}</td>
                  <td className="text-right tabular-nums font-medium">{fmtMoney(c.recordedThisMonth, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-5 py-2.5 text-[11px] text-muted border-t border-hairline">
          Ước tính 30d = RPM × lượt xem mới 30 ngày (đặt RPM trong chi tiết kênh). Doanh thu tháng nhập ở trang Doanh thu.
        </div>
      </div>
    </div>
  );
}

function Delta({ v }: { v: number }) {
  if (!v) return <span className="text-muted">0</span>;
  return <span className={v > 0 ? 'text-pos font-medium' : 'text-neg font-medium'}>{fmtDelta(v)}</span>;
}
