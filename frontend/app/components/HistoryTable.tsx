import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AssetImage } from '~/components/AssetImage';
import { Avatar } from '~/components/Avatar';
import { Badge, type BadgeVariant } from '~/components/Badge';
import { HistoryTableSkeleton } from '~/components/LoadingSkeleton';
import { Pagination } from '~/components/Pagination';
import { SearchInput } from '~/components/SearchInput';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from '~/components/Table';
import { useLanguage } from '~/providers/LanguageProvider';
import type { MyTransactionListItem, Transaction, TransactionAction } from '~/types';
import { TableCellText } from '~/components/TableCellText';
import type { TranslationKey } from '~/utils/translations';
import { isTruncatedText, truncateText } from '~/utils/truncateText';

const ACTION_LABEL_KEYS: Record<TransactionAction, TranslationKey> = {
  CREATED: 'history.created',
  UPDATED: 'history.updated',
  ASSIGNED: 'history.assigned',
  UNASSIGNED: 'history.unassigned',
  STATUS_CHANGED: 'history.statusChanged',
  SITE_CHANGED: 'history.siteChanged',
  MANUFACTURER_CHANGED: 'history.manufacturerChanged',
  VENDOR_CHANGED: 'history.vendorChanged',
  PARENT_CHANGED: 'history.parentChanged',
  CATEGORY_CHANGED: 'history.categoryChanged',
  CUSTOM_FIELDS_CHANGED: 'history.customFieldsChanged',
  WARRANTY_CHANGED: 'history.warrantyChanged',
  RETURN_DATE_CHANGED: 'history.returnDateChanged',
  DELETED: 'history.deleted',
};

const THUMB_SIZE = 24;

const ACTION_BADGE_VARIANT: Record<TransactionAction, BadgeVariant> = {
  CREATED: 'success',
  UPDATED: 'info',
  ASSIGNED: 'primary',
  UNASSIGNED: 'muted',
  STATUS_CHANGED: 'warning',
  SITE_CHANGED: 'secondary',
  MANUFACTURER_CHANGED: 'secondary',
  VENDOR_CHANGED: 'secondary',
  PARENT_CHANGED: 'secondary',
  CATEGORY_CHANGED: 'secondary',
  CUSTOM_FIELDS_CHANGED: 'info',
  WARRANTY_CHANGED: 'info',
  RETURN_DATE_CHANGED: 'info',
  DELETED: 'danger',
};

type HistoryTableTransaction = Transaction | MyTransactionListItem;

interface HistoryTableProps {
  transactions: HistoryTableTransaction[];
  loading: boolean;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** When provided, renders a search box wired to these handlers (admin view). */
  search?: { value: string; onChange: (value: string) => void };
  /** Show the "By" (actor) column — admin view. */
  showActor?: boolean;
  /** Show the target "User" column — admin view. */
  showUser?: boolean;
  /** Link asset / actor / user cells to admin detail pages when IDs are present. */
  linkToDetails?: boolean;
}

function DetailLink({
  to,
  children,
}: {
  to: string | null | undefined;
  children: ReactNode;
}) {
  if (!to) return <>{children}</>;
  return (
    <Link to={to} className="text-primary hover:underline">
      {children}
    </Link>
  );
}

function HistoryEntityCell({
  linkTo,
  thumbnail,
  label,
  muted = false,
}: {
  linkTo: string | null | undefined;
  thumbnail?: ReactNode;
  label: ReactNode;
  muted?: boolean;
}) {
  if (label === '—' && !thumbnail) {
    return <span className={muted ? 'text-muted' : undefined}>—</span>;
  }

  const displayLabel = typeof label === 'string' ? truncateText(label) : label;
  const labelTitle = typeof label === 'string' && isTruncatedText(label) ? label : undefined;

  return (
    <div className={`flex items-center gap-2 min-w-0 ${muted ? 'text-muted' : ''}`}>
      {thumbnail}
      <DetailLink to={linkTo}>
        <span title={labelTitle}>{displayLabel}</span>
      </DetailLink>
    </div>
  );
}

export function HistoryTable({
  transactions,
  loading,
  page,
  total,
  pageSize,
  onPageChange,
  search,
  showActor = false,
  showUser = false,
  linkToDetails = false,
}: HistoryTableProps) {
  const { t } = useLanguage();

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  return (
    <div>
      {search && (
        <SearchInput
          value={search.value}
          onChange={search.onChange}
          placeholder={t('history.searchPlaceholder')}
        />
      )}

      {loading ? (
        <HistoryTableSkeleton showSearch={!!search} showActor={showActor} showUser={showUser} />
      ) : (
        <>
        <Table>
          <TableHead>
            <TableHeaderRow>
              <TableHeaderCell className="whitespace-nowrap">{t('history.date')}</TableHeaderCell>
              <TableHeaderCell>{t('history.action')}</TableHeaderCell>
              <TableHeaderCell>{t('history.asset')}</TableHeaderCell>
              {showActor && <TableHeaderCell>{t('history.actor')}</TableHeaderCell>}
              {showUser && <TableHeaderCell>{t('history.user')}</TableHeaderCell>}
              <TableHeaderCell last>{t('history.detail')}</TableHeaderCell>
            </TableHeaderRow>
          </TableHead>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id} striped>
                <TableCell className="whitespace-nowrap text-muted">{formatDate(tx.dateCreated)}</TableCell>
                <TableCell>
                  <Badge variant={ACTION_BADGE_VARIANT[tx.action]}>
                    {t(ACTION_LABEL_KEYS[tx.action])}
                  </Badge>
                </TableCell>
                <TableCell>
                  <HistoryEntityCell
                    linkTo={linkToDetails && tx.assetId ? `/admin/assets/${tx.assetId}` : null}
                    label={tx.assetName}
                    thumbnail={
                      tx.assetId ? (
                        <AssetImage
                          assetId={tx.assetId}
                          name={tx.assetName}
                          hasImage={tx.assetImageFilename}
                          size={THUMB_SIZE}
                        />
                      ) : undefined
                    }
                  />
                </TableCell>
                {showActor && (
                  <TableCell>
                    <HistoryEntityCell
                      linkTo={
                        linkToDetails && 'actorUserId' in tx && tx.actorUserId
                          ? `/admin/users/${tx.actorUserId}`
                          : null
                      }
                      label={'actorName' in tx ? (tx.actorName ?? '—') : '—'}
                      muted
                      thumbnail={
                        'actorUserId' in tx && tx.actorUserId ? (
                          <Avatar
                            userId={tx.actorUserId}
                            name={'actorName' in tx ? (tx.actorName ?? '?') : '?'}
                            hasAvatar={'actorAvatarFilename' in tx ? tx.actorAvatarFilename : false}
                            size={THUMB_SIZE}
                          />
                        ) : undefined
                      }
                    />
                  </TableCell>
                )}
                {showUser && (
                  <TableCell>
                    <HistoryEntityCell
                      linkTo={
                        linkToDetails && 'targetUserId' in tx && tx.targetUserId
                          ? `/admin/users/${tx.targetUserId}`
                          : null
                      }
                      label={'targetName' in tx ? (tx.targetName ?? '—') : '—'}
                      thumbnail={
                        'targetUserId' in tx && tx.targetUserId ? (
                          <Avatar
                            userId={tx.targetUserId}
                            name={'targetName' in tx ? (tx.targetName ?? '?') : '?'}
                            hasAvatar={'targetAvatarFilename' in tx ? tx.targetAvatarFilename : false}
                            size={THUMB_SIZE}
                          />
                        ) : undefined
                      }
                    />
                  </TableCell>
                )}
                <TableCell last className="text-muted">
                  <TableCellText value={tx.detail} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {transactions.length === 0 && <p className="py-8 text-center text-muted">{t('history.empty')}</p>}
        <Pagination
          page={page}
          total={total}
          resultsPerPage={pageSize}
          onPageChange={onPageChange}
          disabled={loading}
        />
        </>
      )}
    </div>
  );
}
