import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { IconAlert, IconCheck, IconClose } from './icons';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  success: (message: string, action?: Toast['action']) => void;
  error: (message: string, action?: Toast['action']) => void;
  info: (message: string, action?: Toast['action']) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast phải nằm trong <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: ToastKind, message: string, action?: Toast['action']) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, kind, message, action }]);
    setTimeout(() => remove(id), action ? 8000 : 4500);
  }, [remove]);

  const api: ToastApi = {
    success: (m, a) => push('success', m, a),
    error: (m, a) => push('error', m, a),
    info: (m, a) => push('info', m, a),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,380px)]" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-toast card flex items-start gap-3 px-4 py-3 shadow-[var(--shadow-pop)]"
          >
            <span className={`mt-0.5 shrink-0 ${t.kind === 'error' ? 'text-neg' : t.kind === 'success' ? 'text-pos' : 'text-brand'}`}>
              {t.kind === 'error' ? <IconAlert size={18} /> : <IconCheck size={18} />}
            </span>
            <div className="flex-1 text-sm text-ink">{t.message}</div>
            {t.action && (
              <button
                className="text-xs font-medium text-brand hover:underline shrink-0"
                onClick={() => { t.action!.onClick(); remove(t.id); }}
              >
                {t.action.label}
              </button>
            )}
            <button className="text-muted hover:text-ink shrink-0" onClick={() => remove(t.id)} aria-label="Đóng">
              <IconClose size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
