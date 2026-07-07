import { FormEvent, useState } from 'react';
import { api } from '../api';
import { Spinner } from '../components/bits';

export default function Login({ needsSetup, onDone }: { needsSetup: boolean; onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (needsSetup && password !== confirm) {
      setError('Mật khẩu nhập lại không khớp');
      return;
    }
    setBusy(true);
    try {
      await api.post(needsSetup ? '/api/auth/setup' : '/api/auth/login', { username, password });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full grid place-items-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-brand grid place-items-center font-bold text-white">MS</div>
          <div>
            <div className="font-semibold text-lg leading-tight">MS Hub</div>
            <div className="text-xs text-muted">Quản lý đa kênh YouTube · TikTok · Facebook</div>
          </div>
        </div>
        <form onSubmit={submit} className="card px-6 py-6 space-y-4">
          <div className="text-sm font-semibold">
            {needsSetup ? 'Tạo tài khoản quản trị (lần chạy đầu)' : 'Đăng nhập'}
          </div>
          <div>
            <label className="label">Tên đăng nhập</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          </div>
          <div>
            <label className="label">Mật khẩu</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {needsSetup && (
            <div>
              <label className="label">Nhập lại mật khẩu</label>
              <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
            </div>
          )}
          {error && <div className="text-sm text-neg">{error}</div>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy && <Spinner />} {needsSetup ? 'Khởi tạo & đăng nhập' : 'Đăng nhập'}
          </button>
        </form>
        <p className="text-[11px] text-muted text-center mt-4">
          Toàn bộ dữ liệu (tài khoản, cookie, video) được lưu cục bộ trên server của bạn.
        </p>
      </div>
    </div>
  );
}
