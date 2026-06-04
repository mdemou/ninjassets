import type { PropsWithChildren } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import {
  tableBodyCellClass,
  tableClass,
  tableHeaderCellClass,
  tableHeaderRowClass,
} from '~/components/Table';
import { useLanguage } from '~/providers/LanguageProvider';

const SKELETON_BASE = 'var(--color-border)';
const SKELETON_HIGHLIGHT = 'var(--color-surface-alt)';

const panelClass = 'w-full bg-surface border border-border rounded-lg p-6 shadow-sm';
const statCardClass =
  'flex items-center gap-4 bg-surface border border-border rounded-lg p-5 shadow-sm';

function LoadingStatus({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  const { t } = useLanguage();
  return (
    <div
      className={className}
      role="status"
      aria-busy="true"
      aria-label={t('common.loading')}
    >
      {children}
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

export function AppSkeletonTheme({ children }: PropsWithChildren) {
  return (
    <SkeletonTheme baseColor={SKELETON_BASE} highlightColor={SKELETON_HIGHLIGHT} borderRadius={6}>
      {children}
    </SkeletonTheme>
  );
}

function FieldSkeleton({ labelWidth = '35%' }: { labelWidth?: string | number }) {
  return (
    <div>
      <Skeleton height={12} width={labelWidth} />
      <Skeleton height={18} width="75%" className="mt-2" />
    </div>
  );
}

interface TableSkeletonProps {
  columns: number;
  rows?: number;
  /** Last column is narrow (row actions). */
  actionsColumn?: boolean;
  className?: string;
}

function TableSkeletonBody({ columns, rows = 8, actionsColumn = false }: TableSkeletonProps) {
  const headerWidths = Array.from({ length: columns }, (_, i) => {
    if (actionsColumn && i === columns - 1) return 72;
    return `${55 + (i % 3) * 12}%`;
  });

  return (
    <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className={tableHeaderRowClass}>
              {headerWidths.map((width, i) => (
                <th key={i} className={tableHeaderCellClass}>
                  <Skeleton height={14} width={width} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              <tr key={row} className="border-b border-border last:border-0">
                {headerWidths.map((width, col) => (
                  <td key={col} className={tableBodyCellClass}>
                    {actionsColumn && col === columns - 1 ? (
                      <div className="flex gap-2 justify-end">
                        <Skeleton width={32} height={32} borderRadius={6} />
                        <Skeleton width={32} height={32} borderRadius={6} />
                      </div>
                    ) : (
                      <Skeleton height={16} width={col === 0 ? '85%' : width} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  );
}

export function TableSkeleton({ className = '', ...props }: TableSkeletonProps) {
  return (
    <LoadingStatus className={className}>
      <TableSkeletonBody {...props} />
    </LoadingStatus>
  );
}

interface HistoryTableSkeletonProps {
  showSearch?: boolean;
  showActor?: boolean;
  showUser?: boolean;
  rows?: number;
  className?: string;
}

export function HistoryTableSkeleton({
  showSearch = false,
  showActor = false,
  showUser = false,
  rows = 6,
  className = '',
}: HistoryTableSkeletonProps) {
  const columns = 3 + (showActor ? 1 : 0) + (showUser ? 1 : 0) + 1;

  return (
    <LoadingStatus className={className}>
      {showSearch && (
        <div className="mb-4">
          <Skeleton height={42} borderRadius={6} />
        </div>
      )}
      <TableSkeletonBody columns={columns} rows={rows} />
      <div className="mt-4 flex justify-center gap-2">
        <Skeleton width={32} height={32} borderRadius={6} />
        <Skeleton width={32} height={32} borderRadius={6} />
        <Skeleton width={32} height={32} borderRadius={6} />
      </div>
    </LoadingStatus>
  );
}

function StatCardSkeleton() {
  return (
    <div className={statCardClass}>
      <Skeleton circle width={44} height={44} />
      <div className="min-w-0 flex-1">
        <Skeleton width={56} height={28} />
        <Skeleton width={96} height={14} className="mt-2" />
      </div>
    </div>
  );
}

function ChartPanelSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className={panelClass}>
      <Skeleton height={24} width={160} className="mb-4" />
      <Skeleton height={tall ? 220 : 180} borderRadius={8} />
    </div>
  );
}

/** Personal `/dashboard`: stat row + history panel placeholder. */
export function PersonalDashboardSkeleton({ className = '' }: { className?: string }) {
  return (
    <LoadingStatus className={className}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className={panelClass}>
        <Skeleton height={24} width={160} className="mb-4" />
        <HistoryTableSkeleton rows={5} />
      </div>
    </LoadingStatus>
  );
}

export function DashboardOverviewSkeleton({ className = '' }: { className?: string }) {
  return (
    <LoadingStatus className={className}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <ChartPanelSkeleton />
        <div className="lg:col-span-2">
          <ChartPanelSkeleton tall />
        </div>
      </div>
      <div className={panelClass}>
        <Skeleton height={24} width={200} className="mb-4" />
        <HistoryTableSkeleton showSearch showActor showUser rows={5} />
      </div>
    </LoadingStatus>
  );
}

interface DetailPanelSkeletonProps {
  className?: string;
  /** Site detail: map below fields. */
  withMap?: boolean;
}

export function DetailPanelSkeleton({ className = '', withMap = false }: DetailPanelSkeletonProps) {
  return (
    <LoadingStatus className={className}>
      <div className={panelClass}>
        <Skeleton height={28} width={200} className="mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mb-6">
          {Array.from({ length: withMap ? 6 : 8 }, (_, i) => (
            <FieldSkeleton key={i} labelWidth={i % 2 === 0 ? '40%' : '32%'} />
          ))}
        </div>
        {withMap && <Skeleton height={256} borderRadius={8} />}
      </div>
    </LoadingStatus>
  );
}

export function UserDetailPanelSkeleton({ className = '' }: { className?: string }) {
  return (
    <LoadingStatus className={className}>
      <div className={panelClass}>
        <Skeleton height={28} width={200} className="mb-6" />
        <div className="flex items-center gap-4 mb-6">
          <Skeleton circle width={72} height={72} />
          <div className="flex gap-2">
            <Skeleton width={120} height={38} borderRadius={6} />
            <Skeleton width={100} height={38} borderRadius={6} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <FieldSkeleton key={i} />
          ))}
        </div>
      </div>
    </LoadingStatus>
  );
}
