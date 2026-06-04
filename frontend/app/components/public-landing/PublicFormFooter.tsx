import type { ReactNode } from 'react';

interface PublicFormFooterProps {
  children: ReactNode;
}

/** Secondary links below auth form cards (login, register, etc.). */
export function PublicFormFooter({ children }: PublicFormFooterProps) {
  return (
    <div className="mt-6 space-y-2 text-center text-sm text-muted [&_a]:font-medium [&_a]:text-primary [&_a]:no-underline [&_a]:transition-colors [&_a]:hover:text-[var(--color-primary-dark)] [&_a]:hover:no-underline">
      {children}
    </div>
  );
}
