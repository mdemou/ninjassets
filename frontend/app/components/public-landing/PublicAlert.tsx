import type { ReactNode } from 'react';

type PublicAlertVariant = 'success' | 'error' | 'info';

const variantClasses: Record<PublicAlertVariant, string> = {
  success:
    'border-[var(--color-success)]/25 bg-[var(--color-primary-2x-light)]/80 text-[var(--color-primary-x-dark)]',
  error:
    'border-[var(--color-danger)]/25 bg-[var(--color-status-maintenance-light)]/50 text-[var(--color-status-maintenance-dark)]',
  info: 'border-[var(--color-info)]/25 bg-[var(--color-primary-2x-light)]/50 text-[var(--color-primary-x-dark)]',
};

interface PublicAlertProps {
  variant: PublicAlertVariant;
  children: ReactNode;
  className?: string;
}

export function PublicAlert({ variant, children, className = '' }: PublicAlertProps) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-center text-[0.9375rem] leading-relaxed ${variantClasses[variant]} ${className}`.trim()}
      role="status"
    >
      {children}
    </div>
  );
}
