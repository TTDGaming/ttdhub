import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fmtDayHour, fmtNumber } from '../format';

// Nhãn trục Y cần đủ chữ số lẻ để các mốc gần nhau không trùng nhau (vd 1,38 Tr / 1,42 Tr)
const fmtAxis = (v: number) =>
  new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 2 }).format(v);

const INK_MUTED = 'var(--text-muted)';
const GRID = 'var(--gridline)';

function ChartTooltip({ active, payload, label, labelFormatter }: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string; stroke?: string }[];
  label?: number;
  labelFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-hairline bg-white px-3 py-2 shadow-card text-xs">
      <div className="text-muted mb-1">{labelFormatter && label != null ? labelFormatter(label) : label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.stroke || p.color }} />
          <span className="text-ink-2">{p.name}:</span>
          <span className="font-semibold text-ink">{fmtNumber(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Biểu đồ vùng một series (view/follower theo thời gian). */
export function TimeAreaChart({ data, dataKey, name, color, height = 260 }: {
  data: { t: number; [k: string]: number | null }[];
  dataKey: string;
  name: string;
  color: string;
  height?: number;
}) {
  const gradId = `grad_${dataKey}_${color.replace('#', '')}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={fmtDayHour}
          tick={{ fontSize: 11, fill: INK_MUTED }}
          axisLine={{ stroke: 'var(--baseline)' }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          tickFormatter={fmtAxis}
          tick={{ fontSize: 11, fill: INK_MUTED }}
          axisLine={false}
          tickLine={false}
          width={52}
          domain={['auto', 'auto']}
        />
        <Tooltip content={<ChartTooltip labelFormatter={fmtDayHour} />} cursor={{ stroke: 'var(--baseline)', strokeDasharray: '4 4' }} />
        <Area
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Sparkline nhỏ gọn cho danh sách kênh. */
export function Sparkline({ data, color, width = 120, height = 36 }: {
  data: { t: number; v: number }[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return <div className="text-[10px] text-muted italic" style={{ width, height, lineHeight: `${height}px` }}>chưa đủ dữ liệu</div>;
  }
  return (
    <LineChart width={width} height={height} data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
      <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      <YAxis hide domain={['dataMin', 'dataMax']} />
      <XAxis hide dataKey="t" />
    </LineChart>
  );
}
