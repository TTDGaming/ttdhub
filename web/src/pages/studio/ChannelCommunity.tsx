import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { ChannelComment } from '../../types';
import { Avatar, EmptyState, Spinner } from '../../components/bits';
import { TableSkeleton } from '../../components/Skeletons';
import { ConfirmDialog } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { IconRefresh, IconTrash, IconUsers } from '../../components/icons';
import { fmtCompact, fmtTime } from '../../format';
import { useStudio } from './StudioChannel';

interface CommentsResp {
  supported: boolean;
  comments: ChannelComment[];
  scrapedAt: number | null;
}

export default function ChannelCommunity() {
  const { account } = useStudio();
  const toast = useToast();
  const [data, setData] = useState<CommentsResp | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [delTarget, setDelTarget] = useState<ChannelComment | null>(null);

  const load = useCallback(() =>
    api.get<CommentsResp>(`/api/accounts/${account.id}/comments`).then(setData).catch((e) => toast.error(e.message)),
  [account.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setData(null); load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await api.post<{ count: number; supported: boolean }>(`/api/accounts/${account.id}/comments/refresh`);
      if (!r.supported) toast.info('Nền tảng này chưa hỗ trợ đồng bộ bình luận');
      else toast.success(`Đã đồng bộ ${r.count} bình luận`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const submitReply = async (c: ChannelComment) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await api.post(`/api/accounts/${account.id}/comments/${encodeURIComponent(c.externalId)}/reply`, { text: replyText.trim() });
      toast.success('Đã gửi trả lời');
      setData((d) => d && { ...d, comments: d.comments.map((x) => (x.id === c.id ? { ...x, replied: true } : x)) });
      setReplyTo(null);
      setReplyText('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const removeComment = async () => {
    if (!delTarget) return;
    const c = delTarget;
    try {
      await api.delete(`/api/accounts/${account.id}/comments/${encodeURIComponent(c.externalId)}`);
      toast.success('Đã xóa bình luận');
      setData((d) => d && { ...d, comments: d.comments.filter((x) => x.id !== c.id) });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDelTarget(null);
    }
  };

  if (data && !data.supported) {
    return <EmptyState icon={<IconUsers />} title="Chỉ hỗ trợ YouTube"
      hint="Hộp thư bình luận hiện chỉ khả dụng cho kênh YouTube." />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted">
          {data?.scrapedAt ? `Cập nhật ${fmtTime(data.scrapedAt)}` : 'Bình luận gần đây trên các video của kênh'}
        </div>
        <button className="btn-ghost btn-sm" onClick={refresh} disabled={refreshing}>
          {refreshing ? <Spinner /> : <IconRefresh size={15} />} Đồng bộ bình luận
        </button>
      </div>

      {data === null ? (
        <TableSkeleton rows={5} cols={2} />
      ) : data.comments.length === 0 ? (
        <EmptyState icon={<IconUsers />} title="Chưa có bình luận"
          hint='Bấm "Đồng bộ bình luận" để tải bình luận gần đây từ hộp thư Studio về tool.'
          action={<button className="btn-primary" onClick={refresh}>{refreshing ? <Spinner /> : <IconRefresh size={16} />} Đồng bộ bình luận</button>} />
      ) : (
        <div className="space-y-2">
          {data.comments.map((c) => (
            <div key={c.id} className="card px-4 py-3 flex gap-3 group">
              <Avatar url={c.authorAvatar} name={c.author} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{c.author || 'Ẩn danh'}</span>
                  {c.publishedText && <span className="text-[11px] text-muted">· {c.publishedText}</span>}
                  {c.replied && <span className="chip chip-good !py-0">Đã trả lời</span>}
                </div>
                <div className="text-sm text-ink-2 mt-1 whitespace-pre-wrap break-words">{c.text}</div>
                <div className="flex items-center gap-4 mt-1.5 text-[11px] text-muted">
                  {c.likes != null && <span>♥ {fmtCompact(c.likes)}</span>}
                  {c.videoTitle && <span className="truncate">trên: {c.videoTitle}</span>}
                </div>

                {replyTo === c.id ? (
                  <div className="mt-2.5">
                    <textarea
                      className="input" rows={2} autoFocus
                      placeholder={`Trả lời ${c.author || ''}…`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button className="btn-primary btn-sm" disabled={sending || !replyText.trim()} onClick={() => submitReply(c)}>
                        {sending ? <Spinner /> : null} Gửi trả lời
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => { setReplyTo(null); setReplyText(''); }}>Hủy</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button className="text-[11px] font-medium text-brand hover:underline" onClick={() => { setReplyTo(c.id); setReplyText(''); }}>
                      Trả lời
                    </button>
                    <button className="text-[11px] font-medium text-neg hover:underline inline-flex items-center gap-1" onClick={() => setDelTarget(c)}>
                      <IconTrash size={12} /> Xóa
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!delTarget}
        title="Xóa bình luận?"
        message={<>Bình luận của <b>{delTarget?.author || 'người dùng'}</b> sẽ bị xóa trên YouTube. Thao tác không thể hoàn tác.</>}
        confirmLabel="Xóa bình luận"
        danger
        onConfirm={removeComment}
        onClose={() => setDelTarget(null)}
      />
    </div>
  );
}
