import * as React from 'react';
import { cn } from '@/lib/utils';

const control =
  'w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm';

/** Select nativo con el mismo aspecto que Input (accesible y usable en móvil sin JS extra). */
function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return <select data-slot="select" className={cn(control, 'h-9 pr-8', className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(control, 'min-h-20 resize-y py-2', className)}
      {...props}
    />
  );
}

export { Select, Textarea };
