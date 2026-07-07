import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './icons';
import { Spinner } from './bits';

/** Modal dùng chung: portal, đóng bằng Esc / nền, animation nhẹ. */
export function Modal({ open, onClose, children, size = 'md', className = '' }: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-5xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center p-4 animate-overlay" style={{ background: 'rgba(0,0,0,0.5)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`animate-dialog w-full ${width} bg-surface rounded-xl border border-hairline overflow-hidden shadow-[var(--shadow-modal)] ${className}`}>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ModalHeader({ title, onClose, subtitle }: { title: string; subtitle?: string; onClose?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-hairline">
      <div>
        <div className="font-semibold text-sm">{title}</div>
        {subtitle && <div className="text-[11px] text-muted mt-0.5">{subtitle}</div>}
      </div>
      {onClose && (
        <button className="text-muted hover:text-ink" onClick={onClose} aria-label="Đóng"><IconClose size={17} /></button>
      )}
    </div>
  );
}

/** Hộp thoại xác nhận (thay cho confirm() gốc). */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Xác nhận', danger = false, busy = false, onConfirm, onClose }: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="px-5 py-5">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-ink-2 mt-2">{message}</div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy && <Spinner />} {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
