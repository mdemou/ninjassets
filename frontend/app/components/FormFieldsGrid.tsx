import type { ReactNode } from 'react';

interface FormFieldsGridProps {
  children: ReactNode;
  className?: string;
}

/** Responsive two-column layout for modal / admin forms on medium+ viewports. */
export function FormFieldsGrid({ children, className = '' }: FormFieldsGridProps) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 gap-x-4 [&>div]:mb-3 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/** Full-width field or block within {@link FormFieldsGrid}. */
export function FormFieldSpan({ children, className = '' }: FormFieldsGridProps) {
  return (
    <div className={`md:col-span-2 space-y-3 [&_.mb-4]:!mb-0 ${className}`.trim()}>
      {children}
    </div>
  );
}
