import type { ReactNode } from 'react';

interface PublicAuthCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  /** `md` for standard forms; `lg` for handover / detail flows */
  size?: 'md' | 'lg';
}

const sizeClasses = {
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function PublicAuthCard({ title, children, className = '', size = 'md' }: PublicAuthCardProps) {
  return (
    <div
      className={`relative w-full animate-fade-in-up ${sizeClasses[size]} ${className}`.trim()}
    >
      <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-primary/15 via-transparent to-[var(--color-status-stock)]/10 blur-2xl" />
      <div className="relative rounded-2xl border border-border/80 bg-card/95 p-8 shadow-[0_20px_60px_-12px_rgb(0_0_0/0.14)] backdrop-blur-sm">
        {title && (
          <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        )}
        {children}
      </div>
    </div>
  );
}
