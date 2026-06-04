import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  /** Tailwind classes for the icon chip background/text, e.g. "bg-primary/15 text-primary". */
  accent?: string;
}

/** Compact KPI tile for the dashboard. */
export function StatCard({ label, value, icon, accent = 'bg-primary/15 text-primary' }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 bg-surface border border-border rounded-lg p-5 shadow-sm">
      {icon && (
        <div className={`flex items-center justify-center w-11 h-11 rounded-lg shrink-0 ${accent}`}>{icon}</div>
      )}
      <div className="min-w-0">
        <div className="text-2xl font-semibold leading-tight">{value}</div>
        <div className="text-sm text-muted truncate">{label}</div>
      </div>
    </div>
  );
}
