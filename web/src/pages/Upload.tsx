import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Account } from '../types';
import { PageHeader, PlatformBadge, Avatar, Spinner } from '../components/bits';
import { IconFilm, IconUpload, IconUsers } from '../components/icons';

interface VideoItem {
  file: File;
  title: string;
  description: string;
  tags: string;
  privacy: 'public' | 'unlisted' | 'private';
  scheduleAt: string; // datetime-local
}

export default function Upload() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [items, setItems] = useState<VideoItem[]>([]);
  const [commonDesc, setCommonDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Account[]>('/api/accounts').then((all) => setAccounts(all.filter((a) => a.status === 'active')));
  }, []);

  const addFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setItems((prev) => [
      ...prev,
      ...files.map((file) => ({
        file,
        title: file.name.replace(/\.[^.]+$/, ''),
        description: '',
        tags: '',
        privacy: 'public' as const,
        scheduleAt: '',
      })),
    ]);
    e.target.value = '';
  };

  const updateItem = (i: number, patch: Partial<VideoItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const toggleAccount = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Nhóm kênh theo tài khoản quản lý; kênh độc lập gom vào một nhóm riêng.
  const groups = useMemo(() => {
    const byId = new Map<number, { key: string; name: string; email: string | null; managed: boolean; channels: Account[] }>();
    const standalone: Account[] = [];
    for (const a of accounts) {
      if (a.identity_id && a.identity) {
        const g = byId.get(a.identity_id) || {
          key: `idn-${a.identity_id}`, name: a.identity.name || 'Tài khoản quản lý',
          email: a.identity.email, managed: true, channels: [],
        };
        g.channels.push(a);
        byId.set(a.identity_id, g);
      } else standalone.push(a);
    }
    const out = [...byId.values()];
    if (standalone.length) out.push({ key: 'standalone', name: 'Kênh độc lập', email: null, managed: false, channels: standalone });
    return out;
  }, [accounts]);

  const setMany = (ids: number[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const allIds = useMemo(() => accounts.map((a) => a.id), [accounts]);

  const jobCount = items.length * selected.size;
  const totalSize = useMemo(() => items.reduce((s, it) => s + it.file.size, 0), [items]);

  const submit = async () => {
    setError(null);
    if (!items.length) return setError('Chưa chọn video nào');
    if (!selected.size) return setError('Chưa chọn kênh đăng');
    setBusy(true);
    try {
      await api.uploadBatch(
        items.map((it) => it.file),
        {
          items: items.map((it, i) => ({
            fileIndex: i,
            title: it.title,
            description: it.description || commonDesc,
            tags: it.tags,
            privacy: it.privacy,
            scheduleAt: it.scheduleAt ? new Date(it.scheduleAt).getTime() : null,
            accountIds: [...selected],
          })),
        },
        setProgress
      );
      navigate('/jobs');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Đăng video hàng loạt"
        subtitle="Mỗi video × mỗi kênh đã chọn = một job trong hàng đợi, tool tự đăng lần lượt"
      />

      {/* Bước 1: chọn kênh — nhóm theo tài khoản quản lý */}
      <div className="card px-5 py-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="font-semibold text-sm">1 · Chọn kênh đăng ({selected.size} đã chọn)</div>
          {accounts.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <button className="text-brand hover:underline" onClick={() => setMany(allIds, true)}>Chọn tất cả</button>
              <button className="text-muted hover:text-ink" onClick={() => setMany(allIds, false)} disabled={selected.size === 0}>Bỏ chọn</button>
            </div>
          )}
        </div>
        {accounts.length === 0 ? (
          <div className="text-sm text-muted">
            Chưa có kênh nào hoạt động — <Link to="/channels" className="text-brand hover:underline">kết nối kênh trước</Link>.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => {
              const ids = g.channels.map((c) => c.id);
              const selCount = ids.filter((id) => selected.has(id)).length;
              const allOn = selCount === ids.length;
              return (
                <div key={g.key}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {g.managed && <span className="w-6 h-6 rounded-md bg-brand/10 text-brand grid place-items-center shrink-0"><IconUsers size={13} /></span>}
                      <span className="text-xs font-semibold text-ink-2 truncate">{g.name}</span>
                      {g.email && <span className="text-[11px] text-muted truncate">· {g.email}</span>}
                      <span className="text-[11px] text-muted shrink-0">({selCount}/{ids.length})</span>
                    </div>
                    <button
                      className="text-[11px] font-medium text-brand hover:underline shrink-0"
                      onClick={() => setMany(ids, !allOn)}
                    >
                      {allOn ? 'Bỏ chọn nhóm' : 'Chọn cả nhóm'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {g.channels.map((acc) => {
                      const on = selected.has(acc.id);
                      return (
                        <button
                          key={acc.id}
                          onClick={() => toggleAccount(acc.id)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                            on ? 'border-brand bg-brand/5 text-ink' : 'border-hairline bg-surface text-ink-2 hover:bg-[var(--hover-wash)]'
                          }`}
                        >
                          <Avatar url={acc.avatar_url} name={acc.name} size={22} />
                          <span className="font-medium">{acc.name}</span>
                          <PlatformBadge platform={acc.platform} />
                          <span className={`w-4 h-4 rounded grid place-items-center text-[10px] text-white ${on ? 'bg-brand' : 'bg-hairline'}`}>
                            {on ? '✓' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bước 2: chọn video + metadata */}
      <div className="card px-5 py-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-sm">2 · Video ({items.length})</div>
          <label className="btn-ghost cursor-pointer">
            + Thêm video
            <input type="file" accept="video/*" multiple className="hidden" onChange={addFiles} />
          </label>
        </div>

        {items.length === 0 ? (
          <label className="block border-2 border-dashed border-hairline rounded-xl py-12 text-center text-sm text-muted cursor-pointer hover:border-brand/50 hover:text-ink-2">
            Bấm để chọn nhiều video (hoặc dùng nút “+ Thêm video”)
            <input type="file" accept="video/*" multiple className="hidden" onChange={addFiles} />
          </label>
        ) : (
          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="rounded-lg border border-hairline px-4 py-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-xs text-muted truncate flex items-center gap-1.5">
                    <IconFilm size={13} /> {it.file.name} · {(it.file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                  <button className="text-xs text-neg hover:underline shrink-0"
                    onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}>
                    Xóa
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Tiêu đề</label>
                    <input className="input" value={it.title} onChange={(e) => updateItem(i, { title: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Tags (phân cách bằng dấu phẩy)</label>
                    <input className="input" value={it.tags} placeholder="gaming, highlight"
                      onChange={(e) => updateItem(i, { tags: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Mô tả riêng (bỏ trống = dùng mô tả chung)</label>
                    <textarea className="input" rows={2} value={it.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Hiển thị (YouTube)</label>
                      <select className="input" value={it.privacy}
                        onChange={(e) => updateItem(i, { privacy: e.target.value as VideoItem['privacy'] })}>
                        <option value="public">Công khai</option>
                        <option value="unlisted">Không công khai</option>
                        <option value="private">Riêng tư</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Hẹn giờ đăng (tùy chọn)</label>
                      <input className="input" type="datetime-local" value={it.scheduleAt}
                        onChange={(e) => updateItem(i, { scheduleAt: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-3">
            <label className="label">Mô tả chung (áp dụng cho video không có mô tả riêng)</label>
            <textarea className="input" rows={2} value={commonDesc} onChange={(e) => setCommonDesc(e.target.value)} />
          </div>
        )}
      </div>

      {/* Bước 3: đăng */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted">
            {items.length} video × {selected.size} kênh = <b className="text-ink">{jobCount} job</b>
            {totalSize > 0 && <> · tổng {(totalSize / 1024 / 1024).toFixed(0)} MB</>}
          </div>
          <button className="btn-primary" onClick={submit} disabled={busy || !jobCount}>
            {busy ? <Spinner /> : <IconUpload size={16} />} {busy ? `Đang gửi lên server ${progress}%` : 'Đưa vào hàng đợi'}
          </button>
        </div>
        {busy && (
          <div className="mt-3 h-2 rounded-full bg-page overflow-hidden">
            <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <div className="text-sm text-neg mt-3">{error}</div>}
      </div>
    </div>
  );
}
