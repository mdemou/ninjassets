import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

/** Alternating row backgrounds for data tables. */
export const stripedTableRowClass =
  'odd:bg-neutral-2 even:bg-surface-alt border-b border-border last:border-0 transition-colors cursor-pointer hover:bg-sidebar-hover';

export const tableClass = 'w-full text-sm text-left';
export const tableHeaderRowClass = 'text-muted border-b border-border';
export const tableHeaderCellClass = 'py-3 pr-4 font-medium';
export const tableBodyCellClass = 'py-2 pr-4';

function mergeClasses(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode;
  /** When false, children render without the horizontal scroll wrapper. */
  scroll?: boolean;
}

export function Table({ children, className, scroll = true, ...props }: TableProps) {
  const table = (
    <table
      className={mergeClasses(tableClass, className)}
      {...props}
    >
      {children}
    </table>
  );

  if (!scroll) return table;
  return <div className="overflow-x-auto">{table}</div>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

interface TableHeaderRowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode;
}

export function TableHeaderRow({ children, className, ...props }: TableHeaderRowProps) {
  return (
    <tr
      className={mergeClasses(tableHeaderRowClass, className)}
      {...props}
    >
      {children}
    </tr>
  );
}

interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
  /** Drop trailing horizontal padding (last column). */
  last?: boolean;
}

export function TableHeaderCell({ children, className, last, ...props }: TableHeaderCellProps) {
  return (
    <th
      className={mergeClasses(tableHeaderCellClass, last && 'pr-0', className)}
      {...props}
    >
      {children}
    </th>
  );
}

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode;
  striped?: boolean;
}

export function TableRow({ children, className, striped, ...props }: TableRowProps) {
  return (
    <tr
      className={mergeClasses(striped && stripedTableRowClass, className)}
      {...props}
    >
      {children}
    </tr>
  );
}

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
  /** Drop trailing horizontal padding (last column). */
  last?: boolean;
}

export function TableCell({ children, className, last, ...props }: TableCellProps) {
  return (
    <td
      className={mergeClasses(tableBodyCellClass, last && 'pr-0', className)}
      {...props}
    >
      {children}
    </td>
  );
}
