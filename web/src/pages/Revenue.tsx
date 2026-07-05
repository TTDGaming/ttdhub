import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { RevenueEntry, RevenueSummary } from '../types';
import { PageHeader, StatCard, PlatformBadge, Avatar, EmptyState, MonetizedBadge, Spinner } from '../components/bits';
import { PageSkeleton } from '../components/Skeletons';
import { Modal, ModalHeader } from '../components/Modal';
import { useToast } from '../components/Toast';
import { TimeBarChart } from '../components/charts';
import { IconChannels, IconCoins, IconDownload, IconPlus } from '../components/icons';
import { fmtCompact, fmtMoney, fmtMonth } from '../format';

export default function Revenue() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<RevenueSummary | null>(null);
  const [entries, setEntries] = useState<RevenueEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const [summary, list] = await Promise.all([
      api.get<RevenueSummary>('/api/revenue/summary'),
      api.get<RevenueEntry[]>('/api/revenue/entries'),
    ]);
    setData(summary);
    setEntries(list);
  }, []);
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (params.get('add')) { setShowAdd(true); params.delete('add'); setParams(params, { replace: true }); }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <PageSkeleton />;
  const cur = data.currency;

  return (
    <div>
      <PageHeader
        title="Doanh thu"
        subtitle="Ghi nhận doanh thu theo tháng cho từng kênh; ước tính tự động từ RPM × view"
        actions={
          <div className="flex gap-2">
            <a href="/api/revenue/export.csv" className="btn-ghost" download><IconDownload size={16} /> Xuất CSV</a>
            <button className="btn-primary" onClick={() => setShowAdd(true)}><IconPlus size={16} /> Ghi nhận doanh thu</button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-in">
        <StatCard label="Tháng này (ghi nhận)" count={data.totals.recordedThisMonth} format={(n) => fmtMoney(n, cur)} hint={fmtMonth(data.thisMonth)} />
        <StatCard label="Ước tính 30 ngày" count={data.totals.est30} format={(n) => fmtMoney(n, cur)} hint="RPM × view 30 ngày" />
        <StatCard label="Tổng 12 tháng" count={data.totals.recorded12m} format={(n) => fmtMoney(n, cur)} hint="đã ghi nhận" />
        <StatCard
          label="Kênh đã BKT"
          value={`${data.totals.monetizedCount}/${data.totals.accountCount}`}
          hint="bật kiếm tiền"
        />
      </div>

      <div className="card px-5 py-4 mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <div className="font-semibold text-sm">Doanh thu ghi nhận theo tháng — 12 tháng</div>
          <div className="text-xs text-muted">toàn hệ thống</div>
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

      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-3.5 border-b border-hairline font-semibold text-sm">Doanh thu từng kênh</div>
        {data.accounts.length === 0 ? (
          <EmptyState icon={<IconChannels />} title="Chưa có kênh" hint="Kết nối kênh trước ở trang Kênh." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-hairline">
                <th className="px-5 py-2.5 font-medium">Kênh</th>
                <th className="px-3 py-2.5 font-medium">Kiếm tiền</th>
                <th className="px-3 py-2.5 font-medium text-right">RPM</th>
                <th className="px-3 py-2.5 font-medium text-right">View 30d</th>
                <th className="px-3 py-2.5 font-medium text-right">Ước tính 30d</th>
                <th className="px-3 py-2.5 font-medium text-right">Tháng này</th>
                <th className="px-5 py-2.5 font-medium text-right">12 tháng</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((acc) => (
                <tr key={acc.id} className="border-b border-hairline last:border-0 row-hover">
                  <td className="px-5 py-3">
                    <Link to={`/channels/${acc.id}`} className="flex items-center gap-2.5 group">
                      <Avatar url={acc.avatarUrl} name={acc.name} size={28} />
                      <div>
                        <div className="font-medium group-hover:text-brand">{acc.name}</div>
                        <PlatformBadge platform={acc.platform} />
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3"><MonetizedBadge value={acc.monetized} /></td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {acc.rpm != null ? fmtMoney(acc.rpm, cur) : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtCompact(acc.views30d)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(acc.est30, cur)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium">{fmtMoney(acc.recordedThisMonth, cur)}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">{fmtMoney(acc.recorded12m, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-5 py-2.5 text-[11px] text-muted border-t border-hairline">
          Đặt RPM và trạng thái kiếm tiền trong trang chi tiết từng kênh. Ước tính chỉ có với kênh theo dõi được
          tổng view (YouTube); TikTok/Facebook dùng ghi nhận tay.
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-hairline font-semibold text-sm">
          Lịch sử ghi nhận ({entries.length})
        </div>
        {entries.length === 0 ? (
          <div className="py-4">
            <EmptyState icon={<IconCoins />} title="Chưa có bản ghi nào"
              hint='Bấm "Ghi nhận doanh thu" để nhập doanh thu thực nhận theo tháng cho từng kênh.' />
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-hairline last:border-0 row-hover">
                  <td className="px-5 py-2.5 w-28 font-medium tabular-nums">{fmtMonth(e.month)}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{e.account_name}</span>{' '}
                    <span className="text-xs text-muted">· {e.platform}</span>
                    {e.note && <span className="text-xs text-muted"> · {e.note}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{fmtMoney(e.amount, cur)}</td>
                  <td className="px-5 py-2.5 w-16 text-right">
                    <button
                      className="text-xs text-neg hover:underline"
                      onClick={async () => { await api.delete(`/api/revenue/entries/${e.id}`); load(); toast.success('Đã xóa bản ghi'); }}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <AddEntryModal
          accounts={data.accounts}
          currency={cur}
          onClose={(saved) => {
            setShowAdd(false);
            if (saved) load();
          }}
        />
      )}
    </div>
  );
}

function AddEntryModal({ accounts, currency, onClose }: {
  accounts: RevenueSummary['accounts'];
  currency: string;
  onClose: (saved: boolean) => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 0);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/revenue/entries', { accountId, month, amount: Number(amount), note });
      toast.success('Đã ghi nhận doanh thu');
      onClose(true);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={() => onClose(false)} size="md">
      <ModalHeader title="Ghi nhận doanh thu tháng" onClose={() => onClose(false)} />
      <form onSubmit={submit} className="px-5 py-4 space-y-4">
        <div>
          <label className="label">Kênh</label>
          <select className="input" value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.platform})</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tháng</label>
            <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
          </div>
          <div>
            <label className="label">Số tiền ({currency})</label>
            <input className="input" type="number" min="0" step="any" value={amount}
              onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" />
          </div>
        </div>
        <div>
          <label className="label">Ghi chú (tùy chọn)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="AdSense, Creator Rewards..." />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => onClose(false)}>Hủy</button>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Lưu</button>
        </div>
      </form>
    </Modal>
  );
}
