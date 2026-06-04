import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted';

const BADGE_VARIANT_CLASS: Record<BadgeVariant, string> = {
  primary: 'bg-primary/15 text-primary',
  secondary: 'bg-secondary/15 text-secondary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  muted: 'bg-muted/15 text-muted',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  /** Semantic color; domain badges can omit this and pass colors via `className`. */
  variant?: BadgeVariant;
}

export function Badge({ children, variant, className = '', ...props }: BadgeProps) {
  const variantClass = variant ? BADGE_VARIANT_CLASS[variant] : '';

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${variantClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}

export function badgeVariantClass(variant: BadgeVariant): string {
  return BADGE_VARIANT_CLASS[variant];
}
