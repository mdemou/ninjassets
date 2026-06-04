import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRequireAuth } from '~/hooks/useRequireAuth';
import { pageMeta } from '~/utils/pageTitle';
import { DataQualityAssigneeCell } from '~/components/DataQualityAssigneeCell';
import { TableSkeleton } from '~/components/LoadingSkeleton';
import { PageContent } from '~/components/PageContent';
import { Pagination } from '~/components/Pagination';
import { Panel } from '~/components/Panel';
import { SearchInput } from '~/components/SearchInput';
import { SearchSelect } from '~/components/SearchSelect';
import { SeverityBadge } from '~/components/SeverityBadge';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableHeaderRow, TableRow } from '~/components/Table';
import { TableCellText } from '~/components/TableCellText';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import type { ApiResponse, DataQualityIssue, DataQualityRow, ListDataQualityData } from '~/types';
import { api } from '~/utils/api';
import type { TranslationKey } from '~/utils/translations';

const ISSUE_OPTIONS: DataQualityIssue[] = [
  'RETURN_OVERDUE',
  'INACTIVE_USER_ASSIGNED',
  'ASSIGNED_WITHOUT_USER',
  'WARRANTY_EXPIRED',
  'RETURN_DUE_SOON',
  'WARRANTY_EXPIRING_SOON',
];

const ISSUE_LABEL_KEYS: Record<DataQualityIssue, TranslationKey> = {
  INACTIVE_USER_ASSIGNED: 'issues.INACTIVE_USER_ASSIGNED',
  ASSIGNED_WITHOUT_USER: 'issues.ASSIGNED_WITHOUT_USER',
  WARRANTY_EXPIRED: 'issues.WARRANTY_EXPIRED',
  WARRANTY_EXPIRING_SOON: 'issues.WARRANTY_EXPIRING_SOON',
  RETURN_OVERDUE: 'issues.RETURN_OVERDUE',
  RETURN_DUE_SOON: 'issues.RETURN_DUE_SOON',
};

export const meta = pageMeta('reports.title');

export default function AdminReports() {
  usePageTitle('reports.title');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isReady: isAuthReady } = useRequireAuth();
  const { user, userLoading } = useSession();
  const { addToast } = useError();
  const { t } = useLanguage();

  const isAdmin = isAuthReady && !userLoading && user?.roleName === 'ADMIN';
  const filterIssue = (searchParams.get('issue') as DataQualityIssue | null) ?? '';

  const [rows, setRows] = useState<DataQualityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(
    async (opts: { search: string; page: number; issue: string }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (opts.search) params.set('search', opts.search);
        params.set('page', String(opts.page));
        if (opts.issue) params.set('issue', opts.issue);
        const res = await api.get<ListDataQualityData>(`/api/p/reports/data-quality?${params.toString()}`);
        setRows(res.data?.rows ?? []);
        setTotal(res.data?.total ?? 0);
        if (res.data?.pageSize) setPageSize(res.data.pageSize);
      } catch (err) {
        const error = err as ApiResponse;
        addToast({ type: 'error', title: t('common.error'), message: error.message || t('common.error') });
      } finally {
        setLoading(false);
      }
    },
    [addToast, t],
  );

  useEffect(() => {
    if (!userLoading && user && user.roleName !== 'ADMIN') {
      void navigate('/', { replace: true });
    }
  }, [userLoading, user, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const handle = setTimeout(() => {
      void fetchReport({ search, page, issue: filterIssue });
    }, 300);
    return () => clearTimeout(handle);
  }, [isAdmin, search, page, filterIssue, fetchReport]);

  const issueFilterOptions = useMemo(
    () => ISSUE_OPTIONS.map((code) => ({ label: t(ISSUE_LABEL_KEYS[code]), value: code })),
    [t],
  );

  const setIssueFilter = (issue: string) => {
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (issue) next.set('issue', issue);
    else next.delete('issue');
    setSearchParams(next);
  };

  if (!isAdmin) return null;

  return (
    <PageContent size="wide">
      <h1 className="text-3xl font-semibold mb-6">{t('reports.title')}</h1>

      <div className="mb-4 flex flex-row flex-wrap items-center gap-3">
        <SearchInput
          className="mb-0! h-10 min-w-0 flex-1 basis-full sm:basis-auto"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={t('assets.searchPlaceholder')}
        />
        <SearchSelect
          name="issueFilter"
          ariaLabel={t('reports.filterIssue')}
          value={filterIssue}
          onChange={setIssueFilter}
          options={issueFilterOptions}
          emptyOption={{ label: t('reports.allIssues'), value: '' }}
          hideSearch
          className="mb-0! w-56 shrink-0"
        />
      </div>

      <Panel>
        {loading ? (
          <TableSkeleton columns={5} rows={5} />
        ) : rows.length === 0 ? (
          <p className="text-muted text-sm py-6 text-center">{t('dashboard.attentionEmpty')}</p>
        ) : (
          <Table>
            <TableHead>
              <TableHeaderRow>
                <TableHeaderCell>{t('reports.issue')}</TableHeaderCell>
                <TableHeaderCell>{t('reports.severity')}</TableHeaderCell>
                <TableHeaderCell>{t('reports.asset')}</TableHeaderCell>
                <TableHeaderCell>{t('reports.serial')}</TableHeaderCell>
                <TableHeaderCell last>{t('reports.assignee')}</TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={`${row.issue}-${row.assetId}`}
                  striped
                  data-testid={`report-row-${row.assetId}`}
                >
                  <TableCell>
                    <TableCellText value={t(ISSUE_LABEL_KEYS[row.issue])} />
                  </TableCell>
                  <TableCell>
                    <SeverityBadge severity={row.severity} />
                  </TableCell>
                  <TableCell>
                    <Link to={`/admin/assets/${row.assetId}`} className="text-primary hover:underline">
                      <TableCellText value={row.assetName} />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <TableCellText value={row.serialNumber} />
                  </TableCell>
                  <TableCell last>
                    <DataQualityAssigneeCell
                      userId={row.assignedUserId}
                      name={row.assignedUserName}
                      email={row.assignedUserEmail}
                      avatarFilename={row.assignedUserAvatarFilename}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} total={total} resultsPerPage={pageSize} onPageChange={setPage} />
      </Panel>
    </PageContent>
  );
}
