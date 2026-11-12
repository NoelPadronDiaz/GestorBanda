import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ToastContext, type ToastApi, type ToastTone } from './toast-context';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

let nextId = 1;

/** Mensajes breves de confirmación o error, anunciados a lectores de pantalla. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback<ToastApi['show']>((message, tone = 'success') => {
    const id = nextId++;
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
    setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      tone === 'error' ? 7000 : 3500,
    );
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
      >
        {toasts.map((toast) => {
          const Icon =
            toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? XCircle : Info;
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg',
                'bg-[#142841] text-[#f4f0e6]',
                toast.tone === 'error' && 'border-destructive/50',
              )}
            >
              <Icon
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  toast.tone === 'success' && 'text-[#d5b16a]',
                  toast.tone === 'error' && 'text-[#f07b88]',
                )}
                aria-hidden
              />
              {toast.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
