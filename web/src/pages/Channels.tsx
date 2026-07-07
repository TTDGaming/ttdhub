import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Account, Identity } from '../types';
import { PageHeader, PlatformBadge, Avatar, EmptyState, StatusPill, MonetizedBadge, Spinner } from '../components/bits';
import { CardGridSkeleton } from '../components/Skeletons';
import { ConfirmDialog } from '../components/Modal';
import ConnectModal from '../components/ConnectModal';
import { useToast } from '../components/Toast';
import { IconChannels, IconChart, IconLink, IconPlus, IconRefresh, IconSearch, IconTrash, IconUsers } from '../components/icons';
import { fmtCompact, fmtDelta, PLATFORM_LABEL } from '../format';

const SINGLE = [
  { key: 'youtube', hint: 'Đăng nhập một kênh YouTube độc lập' },
  { key: 'tiktok', hint: 'Đăng nhập tài khoản TikTok' },
  { key: 'facebook', hint: 'Đăng nhập Facebook (Trang/TCN)' },
];

interface ConnectReq { platform: string; mode: 'single' | 'manager'; identityId?: number; accountId?: number; }

export default function Channels() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [connect, setConnect] = useState<ConnectReq | null>(null);
  const [singleMenu, setSingleMenu] = useState(false);
  const [rediscovering, setRediscovering] = useState<number | null>(null);
  const [delIdentity, setDelIdentity] = useState<Identity | null>(null);

  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState('all');
  const [tag, setTag] = useState('all');

  const load = useCallback(async () => {
    const [accs, idns] = await Promise.all([api.get<Account[]>('/api/accounts'), api.get<Identity[]>('/api/identities')]);
    setAccounts(accs);
    setIdentities(idns);
  }, []);
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mở nhanh từ command palette (?connect=manager)
  useEffect(() => {
    if (params.get('connect') === 'manager') {
      setConnect({ platform: 'youtube', mode: 'manager' });
      params.delete('connect');
      setParams(params, { replace: true });
    }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const allTags = useMemo(() => {
    const s = new Set<string>();
    (accounts || []).forEach((a) => a.tags?.forEach((t) => s.add(t)));
    return [...s].sort();
  }, [accounts]);

  const match = (a: Account) =>
    (platform === 'all' || a.platform === platform) &&
    (tag === 'all' || a.tags?.includes(tag)) &&
    (!q || (a.name || '').toLowerCase().includes(q.toLowerCase()) || (a.handle || '').toLowerCase().includes(q.toLowerCase()));

  const managed = identities.map((idn) => ({
    identity: idn,
    channels: (accounts || []).filter((a) => a.identity_id === idn.id && match(a)),
  })).filter((g) => g.channels.length > 0 || (!q && platform === 'all' && tag === 'all'));

  const standalone = (accounts || []).filter((a) => !a.identity_id && match(a));

  const rediscover = async (idn: Identity) => {
    setRediscovering(idn.id);
    try {
      const r = await api.post<{ channels: number }>(`/api/identities/${idn.id}/rediscover`);
      toast.success(`Đã quét lại: ${r.channels} kênh`);
      await load();
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        toast.error('Phiên đã hết hạn — mở trình duyệt để đăng nhập lại', { label: 'Mở', onClick: () => setConnect({ platform: idn.platform, mode: 'manager', identityId: idn.id }) });
      } else toast.error(err.message);
    } finally {
      setRediscovering(null);
    }
  };

  const removeIdentity = async () => {
    if (!delIdentity) return;
    try {
      await api.delete(`/api/identities/${delIdentity.id}`);
      toast.success('Đã gỡ tài khoản quản lý');
      setDelIdentity(null);
      await load();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <PageHeader
        title="Kênh"
        subtitle="Kết nối một tài khoản Google để quản lý nhiều kênh, hoặc thêm kênh độc lập"
        actions={
          <div className="flex gap-2">
            <div className="relative">
              <button className="btn-ghost" onClick={() => setSingleMenu((v) => !v)} onBlur={() => setTimeout(() => setSingleMenu(false), 150)}>
                <IconPlus size={15} /> Kênh đơn
              </button>
              {singleMenu && (
                <div className="absolute right-0 mt-1 w-56 popover z-40">
                  {SINGLE.map((p) => (
                    <button key={p.key} onMouseDown={(e) => e.preventDefault()} title={p.hint}
                      onClick={() => { setSingleMenu(false); setConnect({ platform: p.key, mode: 'single' }); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-2 hover:bg-[var(--hover-wash)] hover:text-ink">
                      <PlatformBadge platform={p.key} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-primary" onClick={() => setConnect({ platform: 'youtube', mode: 'manager' })}>
              <IconLink size={16} /> Kết nối tài khoản quản lý
            </button>
          </div>
        }
      />

      {/* Toolbar lọc */}
      {(accounts?.length || 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input !pl-9" placeholder="Tìm kênh theo tên / handle…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input max-w-[150px]" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="all">Mọi nền tảng</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
          </select>
          {allTags.length > 0 && (
            <select className="input max-w-[150px]" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="all">Mọi nhãn</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
      )}

      {accounts === null ? (
        <CardGridSkeleton count={6} />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<IconChannels />}
          title="Chưa kết nối kênh nào"
          hint="Kết nối một tài khoản Google quản lý (được cấp quyền Người quản lý cho nhiều kênh) để tự phát hiện tất cả kênh — hoặc thêm một kênh độc lập."
          action={<button className="btn-primary" onClick={() => setConnect({ platform: 'youtube', mode: 'manager' })}><IconLink size={16} /> Kết nối tài khoản quản lý</button>}
        />
      ) : (
        <div className="space-y-8">
          {managed.map(({ identity, channels }) => (
            <section key={identity.id}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand grid place-items-center shrink-0"><IconUsers size={16} /></div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{identity.name || 'Tài khoản quản lý'}</div>
                    <div className="text-[11px] text-muted truncate">{identity.email} · {identity.channelCount} kênh ({identity.managedCount} được quản lý)</div>
                  </div>
                  {identity.status === 'error' && <span className="chip chip-bad shrink-0">Cần đăng nhập lại</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link to={`/managers/${identity.id}`} className="btn-ghost btn-sm"><IconChart size={14} /> Báo cáo</Link>
                  <button className="btn-ghost btn-sm" onClick={() => rediscover(identity)} disabled={rediscovering === identity.id}>
                    {rediscovering === identity.id ? <Spinner /> : <IconRefresh size={14} />} Quét kênh
                  </button>
                  <button className="btn-ghost btn-icon" title="Gỡ tài khoản quản lý" onClick={() => setDelIdentity(identity)}><IconTrash size={15} /></button>
                </div>
              </div>
              {channels.length === 0 ? (
                <div className="text-sm text-muted px-1">
                  Chưa phát hiện kênh nào cho tài khoản này — bấm <b>Quét kênh</b> sau khi đã được cấp quyền quản lý.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-in">
                  {channels.map((acc) => <ChannelCard key={acc.id} acc={acc} />)}
                </div>
              )}
            </section>
          ))}

          {standalone.length > 0 && (
            <section>
              {managed.length > 0 && <div className="font-semibold text-sm mb-3 text-ink-2">Kênh độc lập</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-in">
                {standalone.map((acc) => <ChannelCard key={acc.id} acc={acc} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {connect && (
        <ConnectModal
          platform={connect.platform}
          mode={connect.mode}
          identityId={connect.identityId}
          accountId={connect.accountId}
          onClose={(ok) => { setConnect(null); if (ok) { load(); toast.success('Kết nối thành công'); } }}
        />
      )}
      <ConfirmDialog
        open={!!delIdentity}
        title="Gỡ tài khoản quản lý?"
        message={<>Gỡ <b>{delIdentity?.email}</b> sẽ xóa tất cả {delIdentity?.channelCount} kênh thuộc tài khoản này khỏi tool cùng số liệu đã thu, và xóa phiên đăng nhập. Kênh thật không bị ảnh hưởng.</>}
        confirmLabel="Gỡ tài khoản"
        danger
        onConfirm={removeIdentity}
        onClose={() => setDelIdentity(null)}
      />
    </div>
  );
}

function ChannelCard({ acc }: { acc: Account }) {
  return (
    <Link to={`/channels/${acc.id}`} className="card px-5 py-4 block transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] hover:border-brand/40">
      <div className="flex items-center gap-3">
        <Avatar url={acc.avatar_url} name={acc.name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{acc.name || 'Đang kết nối…'}</div>
          <div className="text-xs text-muted truncate">{acc.handle || acc.external_id || ''}</div>
        </div>
        <PlatformBadge platform={acc.platform} />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        <MiniStat label="Follower" value={fmtCompact(acc.stats?.followers)} />
        <MiniStat label="View 48h" value={fmtDelta(acc.stats?.views48h)} positive={(acc.stats?.views48h ?? 0) > 0} />
        <MiniStat label="Follower 48h" value={fmtDelta(acc.stats?.followers48h)} positive={(acc.stats?.followers48h ?? 0) > 0} />
      </div>
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        <StatusPill status={acc.status} />
        <MonetizedBadge value={acc.monetized} />
        {acc.tags?.map((t) => <span key={t} className="chip chip-neutral">{t}</span>)}
      </div>
    </Link>
  );
}

function MiniStat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-lg bg-page px-2 py-2">
      <div className={`text-sm font-semibold ${positive ? 'text-pos' : ''}`}>{value}</div>
      <div className="text-[10px] text-muted mt-0.5">{label}</div>
    </div>
  );
}
