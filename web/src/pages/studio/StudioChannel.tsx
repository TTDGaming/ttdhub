import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api } from '../../api';
import { Account } from '../../types';
import { PlatformBadge, Avatar, Spinner, MonetizedBadge, AccountStatusPill } from '../../components/bits';
import { PageSkeleton } from '../../components/Skeletons';
import { ConfirmDialog } from '../../components/Modal';
import ConnectModal from '../../components/ConnectModal';
import { useToast } from '../../components/Toast';
import { IconGlobe, IconRefresh, IconTrash } from '../../components/icons';

export interface StudioContext {
  account: Account;
  reload: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useStudio = () => useOutletContext<StudioContext>();

const TABS = [
  { to: '', label: 'Tổng quan kênh' },
  { to: 'content', label: 'Nội dung' },
  { to: 'analytics', label: 'Số liệu phân tích' },
  { to: 'community', label: 'Cộng đồng' },
];

export default function StudioChannel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const reload = useCallback(async () => {
    const acc = await api.get<Account>(`/api/accounts/${id}`);
    setAccount(acc);
  }, [id]);

  useEffect(() => { reload().catch((e) => toast.error(e.message)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    setBusy(true);
    try {
      await api.post(`/api/accounts/${id}/refresh-stats`);
      await reload();
      toast.success('Đã cập nhật số liệu kênh');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/accounts/${id}`);
      toast.success('Đã gỡ kênh');
      navigate('/channels');
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  if (!account) return <PageSkeleton />;

  return (
    <div>
      <div className="mb-4"><Link to="/channels" className="text-xs text-muted hover:text-brand">← Danh sách kênh</Link></div>

      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar url={account.avatar_url} name={account.name} size={56} />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[22px] leading-tight font-semibold tracking-tight truncate">{account.name}</h1>
              <PlatformBadge platform={account.platform} />
              <MonetizedBadge value={account.monetized} />
              <AccountStatusPill status={account.status} />
              {account.is_manager ? <span className="chip chip-info">Được quản lý</span> : null}
            </div>
            <div className="text-sm text-muted mt-0.5 truncate">
              {account.handle || account.external_id}
              {account.identity && <> · qua tài khoản {account.identity.email || account.identity.name}</>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="btn-ghost" onClick={() => setBrowserOpen(true)} title="Mở trình duyệt cách ly của kênh">
            <IconGlobe size={16} /> Trình duyệt
          </button>
          <button className="btn-ghost" onClick={refresh} disabled={busy}>
            {busy ? <Spinner /> : <IconRefresh size={16} />} Số liệu
          </button>
          <button className="btn-danger" onClick={() => setConfirmDel(true)}><IconTrash size={16} /> Gỡ</button>
        </div>
      </div>

      {account.status === 'error' && (
        <div className="mb-4 alert-neg flex items-center justify-between gap-3">
          <span>Phiên đăng nhập của kênh đã hết hạn — đăng nhập lại để tiếp tục đăng/quản lý.</span>
          <button className="btn-primary !py-1.5" onClick={() => setBrowserOpen(true)}>Đăng nhập lại</button>
        </div>
      )}

      {/* Thanh tab kiểu Studio */}
      <div className="border-b border-hairline mb-6 flex gap-1 -mx-1 overflow-x-auto">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === ''}
            className={({ isActive }) =>
              `relative px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive ? 'text-brand' : 'text-ink-2 hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {t.label}
                {isActive && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-brand" />}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <Outlet context={{ account, reload } satisfies StudioContext} />

      {browserOpen && (
        <ConnectModal
          platform={account.platform}
          accountId={account.id}
          onClose={(ok) => { setBrowserOpen(false); if (ok) { reload(); toast.success('Đã cập nhật phiên đăng nhập'); } }}
        />
      )}
      <ConfirmDialog
        open={confirmDel}
        title="Gỡ kênh này?"
        message="Kênh sẽ bị xóa khỏi tool cùng số liệu đã thu. Với kênh độc lập, profile trình duyệt (cookie đăng nhập) cũng bị xóa. Tài khoản thật của bạn không bị ảnh hưởng."
        confirmLabel="Gỡ kênh"
        danger
        busy={busy}
        onConfirm={remove}
        onClose={() => setConfirmDel(false)}
      />
    </div>
  );
}
