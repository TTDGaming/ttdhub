import { ReactNode } from 'react';
import { PLATFORM_COLOR, PLATFORM_LABEL, fmtDelta } from '../format';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, delta, hint }: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  hint?: string;
}) {
  return (
    <div className="card px-5 py-4">
      <div className="text-xs font-medium text-muted uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold mt-1.5">{value}</div>
      <div className="mt-1 text-xs flex items-center gap-1.5 min-h-[16px]">
        {delta != null && delta !== 0 && (
          <span className={delta > 0 ? 'text-[#006300] font-medium' : 'text-[#d03b3b] font-medium'}>
            {delta > 0 ? '▲' : '▼'} {fmtDelta(delta)}
          </span>
        )}
        {hint && <span className="text-muted">{hint}</span>}
      </div>
    </div>
  );
}

export function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium border"
      style={{
        color: PLATFORM_COLOR[platform],
        borderColor: `${PLATFORM_COLOR[platform]}55`,
        background: `${PLATFORM_COLOR[platform]}0f`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: PLATFORM_COLOR[platform] }} />
      {PLATFORM_LABEL[platform] || platform}
    </span>
  );
}

export function Avatar({ url, name, size = 36 }: { url: string | null; name: string | null; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-hairline text-ink-2 grid place-items-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
}

export function EmptyState({ icon, title, hint, action }: {
  icon: string; title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <div className="card grid place-items-center py-14 text-center">
      <div>
        <div className="text-4xl mb-3">{icon}</div>
        <div className="font-medium">{title}</div>
        {hint && <div className="text-sm text-muted mt-1 max-w-sm mx-auto">{hint}</div>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: string }> = {
    queued: { label: 'Đang chờ', cls: 'bg-page text-ink-2 border-hairline', icon: '🕒' },
    uploading: { label: 'Đang đăng', cls: 'bg-[#2a78d6]/10 text-[#1c5cab] border-[#2a78d6]/30', icon: '⬆️' },
    done: { label: 'Hoàn tất', cls: 'bg-[#0ca30c]/10 text-[#006300] border-[#0ca30c]/30', icon: '✅' },
    error: { label: 'Lỗi', cls: 'bg-[#d03b3b]/10 text-[#d03b3b] border-[#d03b3b]/30', icon: '⚠️' },
    canceled: { label: 'Đã hủy', cls: 'bg-page text-muted border-hairline', icon: '⛔' },
    active: { label: 'Hoạt động', cls: 'bg-[#0ca30c]/10 text-[#006300] border-[#0ca30c]/30', icon: '✅' },
    connecting: { label: 'Đang kết nối', cls: 'bg-page text-ink-2 border-hairline', icon: '🕒' },
  };
  const s = map[status] || { label: status, cls: 'bg-page text-ink-2 border-hairline', icon: '•' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      <span>{s.icon}</span> {s.label}
    </span>
  );
}
