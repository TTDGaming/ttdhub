interface Option {
  key: string;
  label: string;
}

/** Điều khiển phân đoạn dùng chung (khoảng thời gian, bộ lọc trạng thái...). */
export default function Segmented({ options, value, onChange, className = '' }: {
  options: Option[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={`segmented ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          data-active={value === o.key}
          className="segmented-item"
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
