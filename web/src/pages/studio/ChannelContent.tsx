import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { ChannelVideo } from '../../types';
import { EmptyState, Spinner } from '../../components/bits';
import { TableSkeleton } from '../../components/Skeletons';
import { ConfirmDialog } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import Segmented from '../../components/Segmented';
import { IconDownload, IconExternal, IconFilm, IconRefresh, IconTrash } from '../../components/icons';
import { fmtCompact, fmtTime } from '../../format';
import { useStudio } from './StudioChannel';

interface VideosResp {
  supported: boolean;
  videos: ChannelVideo[];
  scrapedAt: number | null;
}

export default function ChannelContent() {
  const { account } = useStudio();
  const toast = useToast();
  const [data, setData] = useState<VideosResp | null>(null);
  const [sort, setSort] = useState('recent');
  const [refreshing, setRefreshing] = useState(false);
  const [delTarget, setDelTarget] = useState<ChannelVideo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() =>
    api.get<VideosResp>(`/api/accounts/${account.id}/videos?sort=${sort}`).then(setData).catch((e) => toast.error(e.message)),
  [account.id, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setData(null); load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await api.post<{ count: number; supported: boolean }>(`/api/accounts/${account.id}/videos/refresh`);
      if (!r.supported) toast.info('Nền tảng này chưa hỗ trợ đồng bộ video');
      else toast.success(`Đã đồng bộ ${r.count} video`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const doDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/accounts/${account.id}/videos/${delTarget.externalId}`);
      toast.success('Đã xóa video');
      setDelTarget(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  if (data && !data.supported) {
    return <EmptyState icon={<IconFilm />} title="Chỉ hỗ trợ YouTube"
      hint="Quản lý video (danh sách, tải, xóa) hiện chỉ khả dụng cho kênh YouTube. TikTok/Facebook sẽ được bổ sung sau." />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <Segmented options={[{ key: 'recent', label: 'Mới nhất' }, { key: 'views', label: 'Xem nhiều' }]} value={sort} onChange={setSort} />
        <div className="flex items-center gap-3">
          {data?.scrapedAt && <span className="text-xs text-muted">Cập nhật {fmtTime(data.scrapedAt)}</span>}
          <button className="btn-ghost btn-sm" onClick={refresh} disabled={refreshing}>
            {refreshing ? <Spinner /> : <IconRefresh size={15} />} Đồng bộ video
          </button>
        </div>
      </div>

      {data === null ? (
        <TableSkeleton rows={6} cols={5} />
      ) : data.videos.length === 0 ? (
        <EmptyState icon={<IconFilm />} title="Chưa có video"
          hint='Bấm "Đồng bộ video" để tải danh sách video công khai của kênh về tool.'
          action={<button className="btn-primary" onClick={refresh}>{refreshing ? <Spinner /> : <IconRefresh size={16} />} Đồng bộ video</button>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Video</th>
                <th className="text-right">Lượt xem</th>
                <th className="text-right">Thích</th>
                <th className="text-right">Bình luận</th>
                <th>Đăng</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="stagger-in">
              {data.videos.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-20 aspect-video rounded-md bg-page overflow-hidden shrink-0">
                        {v.thumbnailUrl && <img src={v.thumbnailUrl} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover" />}
                        {v.duration && <span className="absolute bottom-0.5 right-0.5 text-[9px] bg-black/75 text-white px-1 rounded">{v.duration}</span>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate max-w-[280px]" title={v.title || ''}>{v.title || '—'}</div>
                        <div className="text-[11px] text-muted">{v.privacy || 'public'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right tabular-nums font-medium">{fmtCompact(v.views)}</td>
                  <td className="text-right tabular-nums">{fmtCompact(v.likes)}</td>
                  <td className="text-right tabular-nums">{fmtCompact(v.comments)}</td>
                  <td className="text-xs text-muted whitespace-nowrap">{v.publishedText || (v.publishedAt ? fmtTime(v.publishedAt) : '—')}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      {v.url && (
                        <a href={v.url} target="_blank" rel="noreferrer" className="btn-ghost btn-icon" title="Mở video"><IconExternal size={15} /></a>
                      )}
                      <a href={`/api/accounts/${account.id}/videos/${v.externalId}/download`} className="btn-ghost btn-icon" title="Tải xuống"><IconDownload size={15} /></a>
                      <button className="btn-ghost btn-icon text-neg" title="Xóa video" onClick={() => setDelTarget(v)}><IconTrash size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!delTarget}
        title="Xóa video?"
        message={<>Xóa vĩnh viễn video <b>"{delTarget?.title}"</b> khỏi kênh trên YouTube. Hành động này không thể hoàn tác.</>}
        confirmLabel="Xóa vĩnh viễn"
        danger
        busy={deleting}
        onConfirm={doDelete}
        onClose={() => setDelTarget(null)}
      />
    </div>
  );
}
