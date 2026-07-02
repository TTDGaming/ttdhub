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
          <span className={delta > 0 ? 'text-pos font-medium' : 'text-neg font-medium'}>
            {delta > 0 ? '▲' : '▼'} {fmtDelta(delta)}
          </span>
        )}
        {hint && <span className="text-muted">{hint}</span>}
      </div>
    </div>
  );
}

export function PlatformBadge({ platform }: { platform: string }) {
  const color = PLATFORM_COLOR[platform];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium border"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 7%, transparent)`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
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
  icon: ReactNode; title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <div className="card grid place-items-center py-14 text-center">
      <div>
        <div className="text-muted mb-3 grid place-items-center [&>svg]:w-10 [&>svg]:h-10 text-4xl">{icon}</div>
        <div className="font-medium">{title}</div>
        {hint && <div className="text-sm text-muted mt-1 max-w-sm mx-auto">{hint}</div>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

const DOT = <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />;

/** Nhãn trạng thái bật kiếm tiền của kênh. */
export function MonetizedBadge({ value }: { value: 'yes' | 'no' | 'unknown' }) {
  const map = {
    yes: { label: 'Đã BKT', cls: 'chip-good' },
    no: { label: 'Chưa BKT', cls: 'chip-neutral' },
    unknown: { label: 'BKT: chưa rõ', cls: 'chip-faded' },
  }[value] || { label: value, cls: 'chip-faded' };
  return (
    <span className={`chip ${map.cls}`}>
      {DOT} {map.label}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    queued: { label: 'Đang chờ', cls: 'chip-neutral' },
    uploading: { label: 'Đang đăng', cls: 'chip-info' },
    done: { label: 'Hoàn tất', cls: 'chip-good' },
    error: { label: 'Lỗi', cls: 'chip-bad' },
    canceled: { label: 'Đã hủy', cls: 'chip-faded' },
    active: { label: 'Hoạt động', cls: 'chip-good' },
    connecting: { label: 'Đang kết nối', cls: 'chip-neutral' },
  };
  const s = map[status] || { label: status, cls: 'chip-neutral' };
  return (
    <span className={`chip ${s.cls}`}>
      {DOT} {s.label}
    </span>
  );
}

/** Riêng cho trạng thái tài khoản: 'error' nghĩa là hết phiên đăng nhập. */
export function AccountStatusPill({ status }: { status: string }) {
  if (status === 'error') {
    return <span className="chip chip-bad">{DOT} Cần đăng nhập lại</span>;
  }
  return <StatusPill status={status} />;
}
