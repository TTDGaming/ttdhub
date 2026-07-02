import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Account, ChannelComment, ChannelVideo, HistoryPoint } from '../../types';
import { Avatar, StatCard, Spinner } from '../../components/bits';
import { TimeAreaChart } from '../../components/charts';
import { useToast } from '../../components/Toast';
import { IconChevronRight } from '../../components/icons';
import { fmtCompact, fmtTime, PLATFORM_COLOR } from '../../format';
import { useStudio } from './StudioChannel';

export default function ChannelOverview() {
  const { account, reload } = useStudio();
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [comments, setComments] = useState<ChannelComment[]>([]);

  useEffect(() => {
    api.get<{ points: HistoryPoint[] }>(`/api/stats/accounts/${account.id}/history?range=48h`).then((h) => setPoints(h.points)).catch(() => {});
    api.get<{ videos: ChannelVideo[] }>(`/api/accounts/${account.id}/videos?sort=recent`).then((r) => setVideos(r.videos.slice(0, 4))).catch(() => {});
    api.get<{ comments: ChannelComment[] }>(`/api/accounts/${account.id}/comments`).then((r) => setComments(r.comments.slice(0, 3))).catch(() => {});
  }, [account.id]);

  const data = useMemo(() => points.map((p) => ({ t: p.t, views: p.views, followers: p.followers })), [points]);
  const hasViews = points.some((p) => p.views != null);
  const s = account.stats;
  const color = PLATFORM_COLOR[account.platform];

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Follower" value={fmtCompact(s?.followers)} delta={s?.followers48h} hint="48h" />
        {hasViews && <StatCard label="Tổng view" value={fmtCompact(s?.views)} delta={s?.views48h} hint="48h" />}
        {s?.likes != null && <StatCard label="Lượt thích" value={fmtCompact(s?.likes)} delta={s?.likes48h} hint="48h" />}
        <StatCard label="Số video" value={fmtCompact(s?.videos)} />
      </div>

      <div className="card px-5 py-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-sm">{hasViews ? 'Lượt xem 48 giờ' : 'Follower 48 giờ'}</div>
          <Link to="analytics" className="text-xs text-brand hover:underline flex items-center gap-0.5">Phân tích chi tiết <IconChevronRight size={13} /></Link>
        </div>
        {data.length >= 2 ? (
          <TimeAreaChart data={data} dataKey={hasViews ? 'views' : 'followers'} name={hasViews ? 'Lượt xem' : 'Follower'} color={color} height={200} />
        ) : (
          <div className="text-sm text-muted py-10 text-center">Chưa đủ dữ liệu — số liệu thu tự động mỗi 30 phút.</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PreviewCard title="Video gần đây" to="content" empty="Chưa đồng bộ video">
          {videos.map((v) => (
            <div key={v.id} className="flex items-center gap-3 py-2">
              <div className="w-14 aspect-video rounded bg-page overflow-hidden shrink-0">
                {v.thumbnailUrl && <img src={v.thumbnailUrl} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{v.title}</div>
                <div className="text-[11px] text-muted">{fmtCompact(v.views)} lượt xem · {v.publishedText || ''}</div>
              </div>
            </div>
          ))}
        </PreviewCard>

        <PreviewCard title="Bình luận mới" to="community" empty="Chưa đồng bộ bình luận">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5 py-2">
              <Avatar url={c.authorAvatar} name={c.author} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium">{c.author}</div>
                <div className="text-sm text-ink-2 truncate">{c.text}</div>
              </div>
            </div>
          ))}
        </PreviewCard>
      </div>

      <ChannelSettings account={account} onSaved={reload} />
    </div>
  );
}

function PreviewCard({ title, to, empty, children }: { title: string; to: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="card px-5 py-4">
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold text-sm">{title}</div>
        <Link to={to} className="text-xs text-brand hover:underline flex items-center gap-0.5">Xem tất cả <IconChevronRight size={13} /></Link>
      </div>
      {hasChildren ? <div className="divide-y divide-hairline">{children}</div> : <div className="text-sm text-muted py-6 text-center">{empty}</div>}
    </div>
  );
}

function ChannelSettings({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const toast = useToast();
  const [monetized, setMonetized] = useState(account.monetized);
  const [rpm, setRpm] = useState(account.rpm != null ? String(account.rpm) : '');
  const [note, setNote] = useState(account.note || '');
  const [pageUrl, setPageUrl] = useState(account.page_url || '');
  const [tags, setTags] = useState<string[]>(account.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/accounts/${account.id}`, {
        monetized, rpm: rpm === '' ? null : Number(rpm), note, tags,
        ...(account.platform === 'facebook' ? { pageUrl } : {}),
      });
      onSaved();
      toast.success('Đã lưu thiết lập kênh');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addTag = (t: string) => {
    const v = t.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput('');
  };

  return (
    <div className="card px-5 py-4">
      <div className="font-semibold text-sm mb-3">Thiết lập kênh</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <label className="label">Trạng thái kiếm tiền (BKT)</label>
          <select className="input" value={monetized} onChange={(e) => setMonetized(e.target.value as Account['monetized'])}>
            <option value="unknown">Chưa rõ</option>
            <option value="yes">Đã bật kiếm tiền</option>
            <option value="no">Chưa bật kiếm tiền</option>
          </select>
        </div>
        <div>
          <label className="label">RPM — doanh thu / 1000 view</label>
          <input className="input" type="number" min="0" step="any" value={rpm} onChange={(e) => setRpm(e.target.value)} placeholder="ví dụ: 1.5" />
        </div>
        <div>
          <label className="label">Ghi chú</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="nội dung, người phụ trách..." />
        </div>
        <div className="lg:col-span-3">
          <label className="label">Nhãn / nhóm</label>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface px-2 py-2">
            {tags.map((t) => (
              <span key={t} className="chip chip-info">
                {t}
                <button className="ml-1 hover:text-neg" onClick={() => setTags(tags.filter((x) => x !== t))}>×</button>
              </span>
            ))}
            <input
              className="flex-1 min-w-[120px] bg-transparent outline-none text-sm px-1"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); } }}
              onBlur={() => tagInput && addTag(tagInput)}
              placeholder="thêm nhãn rồi Enter…"
            />
          </div>
        </div>
        {account.platform === 'facebook' && (
          <div className="lg:col-span-3">
            <label className="label">URL Trang (bắt buộc để đăng video lên Trang)</label>
            <input className="input" value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://www.facebook.com/tenTrang" />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />} Lưu thiết lập</button>
        <span className="text-xs text-muted">RPM dùng để ước tính doanh thu ở trang Doanh thu.</span>
      </div>
    </div>
  );
}
