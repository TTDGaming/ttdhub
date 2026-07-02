export function fmtNumber(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(n);
}

export function fmtCompact(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function fmtDelta(n: number | null | undefined): string {
  if (n == null) return '—';
  const s = fmtCompact(Math.abs(n));
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : '0';
}

export function fmtTime(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ts));
}

export function fmtHour(ts: number): string {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
}

export function fmtDayHour(ts: number): string {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
}

export function fmtMoney(n: number | null | undefined, currency = 'USD'): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(n);
}

export function fmtPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const s = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Math.abs(n) * 100);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${s}%`;
}

/** 'YYYY-MM' → 'T7/2026' */
export function fmtMonth(m: string): string {
  const [y, mo] = m.split('-');
  return `T${Number(mo)}/${y}`;
}

export const PLATFORM_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
};

/** Màu series theo nền tảng — lấy từ palette categorical đã validate. */
export const PLATFORM_COLOR: Record<string, string> = {
  youtube: '#e34948',
  tiktok: '#1baf7a',
  facebook: '#2a78d6',
};
