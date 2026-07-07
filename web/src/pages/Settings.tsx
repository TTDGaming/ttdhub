import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { PageHeader, Spinner } from '../components/bits';

export default function Settings() {
  return (
    <div>
      <PageHeader title="Cài đặt" subtitle="Bảo mật, tiền tệ và truy cập từ xa" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <CurrencySetting />
          <ChangePassword />
        </div>
        <TunnelGuide />
      </div>
    </div>
  );
}

function CurrencySetting() {
  const [currency, setCurrency] = useState('USD');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<{ currency: string }>('/api/settings').then((s) => setCurrency(s.currency));
  }, []);

  const save = async (value: string) => {
    setCurrency(value);
    await api.put('/api/settings', { currency: value });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="card px-5 py-4">
      <div className="font-semibold text-sm mb-1">Đơn vị tiền tệ</div>
      <p className="text-xs text-muted mb-3">Dùng cho trang Doanh thu (RPM, ghi nhận, ước tính).</p>
      <div className="flex items-center gap-3">
        <select className="input max-w-[180px]" value={currency} onChange={(e) => save(e.target.value)}>
          <option value="USD">USD — đô la Mỹ</option>
          <option value="VND">VND — đồng Việt Nam</option>
          <option value="EUR">EUR — euro</option>
        </select>
        {saved && <span className="text-sm text-pos">✓ Đã lưu</span>}
      </div>
    </div>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next });
      setMsg({ ok: true, text: 'Đã đổi mật khẩu' });
      setCurrent('');
      setNext('');
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card px-5 py-4 space-y-3">
      <div className="font-semibold text-sm">Đổi mật khẩu quản trị</div>
      <div>
        <label className="label">Mật khẩu hiện tại</label>
        <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div>
        <label className="label">Mật khẩu mới (≥ 6 ký tự)</label>
        <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} />
      </div>
      {msg && <div className={`text-sm ${msg.ok ? 'text-pos' : 'text-neg'}`}>{msg.text}</div>}
      <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Lưu</button>
    </form>
  );
}

function TunnelGuide() {
  return (
    <div className="card px-5 py-4 text-sm space-y-3">
      <div className="font-semibold">Truy cập từ xa qua Cloudflare Tunnel</div>
      <p className="text-ink-2">
        Chạy MS Hub trên máy chủ Linux/Windows tại nhà, quản lý từ bất kỳ đâu — không cần mở port,
        không cần IP tĩnh.
      </p>
      <div>
        <div className="text-xs font-medium text-muted mb-1">Cách nhanh (tunnel tạm thời):</div>
        <pre className="bg-sidebar text-white/90 rounded-lg px-3 py-2.5 text-xs overflow-x-auto">cloudflared tunnel --url http://localhost:3689</pre>
      </div>
      <div>
        <div className="text-xs font-medium text-muted mb-1">Tên miền riêng (tunnel cố định):</div>
        <pre className="bg-sidebar text-white/90 rounded-lg px-3 py-2.5 text-xs overflow-x-auto">{`cloudflared tunnel login
cloudflared tunnel create mshub
cloudflared tunnel route dns mshub hub.tenmiencuaban.com
cloudflared tunnel run mshub`}</pre>
      </div>
      <p className="text-xs text-muted">
        Xem hướng dẫn đầy đủ (kèm cấu hình chạy nền như service) trong <code>docs/cloudflare-tunnel.md</code> của dự án.
        WebSocket (trình duyệt đăng nhập từ xa) hoạt động bình thường qua tunnel.
      </p>
    </div>
  );
}
