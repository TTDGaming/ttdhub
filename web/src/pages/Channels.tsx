import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Account } from '../types';
import { PageHeader, PlatformBadge, Avatar, EmptyState, StatusPill, MonetizedBadge } from '../components/bits';
import ConnectModal from '../components/ConnectModal';
import { IconChannels, IconPlus } from '../components/icons';
import { fmtCompact, fmtDelta, PLATFORM_LABEL } from '../format';

const PLATFORMS: { key: string; hint: string }[] = [
  { key: 'youtube', hint: 'Đăng nhập Google → kênh YouTube' },
  { key: 'tiktok', hint: 'Đăng nhập tài khoản TikTok' },
  { key: 'facebook', hint: 'Đăng nhập Facebook (Trang/TCN)' },
];

export default function Channels() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => api.get<Account[]>('/api/accounts').then(setAccounts).catch((e) => setError(e.message)),
    []
  );
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Kênh"
        subtitle="Mỗi kênh chạy trong một profile trình duyệt cách ly riêng trên server"
        actions={
          <div className="flex gap-2">
            {PLATFORMS.map((p) => (
              <button key={p.key} className="btn-ghost" title={p.hint} onClick={() => setConnecting(p.key)}>
                <IconPlus size={15} /> {PLATFORM_LABEL[p.key]}
              </button>
            ))}
          </div>
        }
      />

      {error && <div className="text-sm text-neg mb-4">{error}</div>}

      {accounts && accounts.length === 0 && (
        <EmptyState
          icon={<IconChannels />}
          title="Chưa kết nối kênh nào"
          hint='Bấm "+ YouTube / TikTok / Facebook" phía trên, đăng nhập trong trình duyệt nhúng là xong — không cần API key, không đụng vào trang quản lý gốc.'
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(accounts || []).map((acc) => (
          <Link key={acc.id} to={`/channels/${acc.id}`} className="card px-5 py-4 hover:border-brand/50 transition-colors block">
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
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <StatusPill status={acc.status} />
                <MonetizedBadge value={acc.monetized} />
              </div>
              {acc.note && <span className="text-[11px] text-muted truncate">{acc.note}</span>}
            </div>
          </Link>
        ))}
      </div>

      {connecting && (
        <ConnectModal
          platform={connecting}
          onClose={(ok) => {
            setConnecting(null);
            if (ok) load();
          }}
        />
      )}
    </div>
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
