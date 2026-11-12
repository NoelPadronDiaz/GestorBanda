import * as React from 'react';
import { cn } from '@/lib/utils';

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-left text-sm', className)} {...props} />
    </div>
  );
}

function Th({ className, numeric, ...props }: React.ComponentProps<'th'> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        'border-b px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-muted-foreground',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  );
}

function Td({ className, numeric, ...props }: React.ComponentProps<'td'> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'border-b border-border/70 px-3 py-2.5 align-middle',
        numeric && 'tabular text-right whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

/** Fila de «sin datos» o «cargando» que ocupa todo el ancho. */
function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

export { Table, Th, Td, EmptyRow };
