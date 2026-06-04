import type { ReactNode } from 'react';

interface PageContentProps {
  children: ReactNode;
  className?: string;
  /** `default` for app sections; `wide` for data-heavy admin tables; `form` for centered auth-style pages */
  size?: 'default' | 'wide' | 'form';
}

const sizeClasses = {
  default: 'max-w-6xl',
  wide: 'max-w-none',
  form: 'max-w-3xl',
};

/** Page wrapper: full width on small screens, capped and centered on large screens. */
export function PageContent({ children, className = '', size = 'default' }: PageContentProps) {
  return (
    <div
      className={`w-full min-w-0 box-border px-6 py-8 mx-auto ${sizeClasses[size]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
