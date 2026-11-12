import { X } from 'lucide-react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

/**
 * Diálogo modal sobre el <dialog> nativo: foco atrapado, Escape y fondo inerte los da el navegador.
 */
function Dialog({ open, onClose, title, description, size = 'md', children }: DialogProps) {
  const { t } = useTranslation();
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        'm-auto max-h-[92svh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-[#0b1626]/55 backdrop:backdrop-blur-[2px]',
        size === 'md' && 'max-w-lg',
        size === 'lg' && 'max-w-3xl',
        size === 'xl' && 'max-w-5xl',
      )}
    >
      {open && (
        <div className="grid gap-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <h2 id="dialog-title" className="text-lg font-semibold">
                {title}
              </h2>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export { Dialog };
