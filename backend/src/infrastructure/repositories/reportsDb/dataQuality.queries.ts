import {
  IDataQualityIssue,
  IDataQualityRow,
  IDataQualitySeverity,
  IAttentionCounts,
} from '@domain/_interfaces/dataQuality.interface';
import { Knex } from 'knex';
import sqlService from '@services/sql.service';
import { dismissalKey, getDismissedMap } from './dismissals.repository';

// Per-issue fingerprint of the underlying condition. A dismissal stores this value at
// dismiss time and only keeps hiding the row while the recomputed signature matches, so
// editing the warranty/return date, reassigning, or a resolve→recur cycle resurfaces the
// alert. ASSIGNED_WITHOUT_USER has no defining value, so it uses asset.date_updated (which
// is bumped on every asset write, including the status/owner changes that re-trigger it).
const SIGNATURE_EXPR: Record<IDataQualityIssue, string> = {
  [IDataQualityIssue.INACTIVE_USER_ASSIGNED]: "coalesce(asset.assigned_user_id::text, '')",
  [IDataQualityIssue.ASSIGNED_WITHOUT_USER]: "coalesce(asset.date_updated::text, '')",
  [IDataQualityIssue.WARRANTY_EXPIRED]: "coalesce(asset.warranty_end_date::text, '')",
  [IDataQualityIssue.WARRANTY_EXPIRING_SOON]: "coalesce(asset.warranty_end_date::text, '')",
  [IDataQualityIssue.RETURN_OVERDUE]: "coalesce(asset.expected_return_date::text, '')",
  [IDataQualityIssue.RETURN_DUE_SOON]: "coalesce(asset.expected_return_date::text, '')",
};

const SEVERITY_BY_ISSUE: Record<IDataQualityIssue, IDataQualitySeverity> = {
  [IDataQualityIssue.INACTIVE_USER_ASSIGNED]: 'high',
  [IDataQualityIssue.ASSIGNED_WITHOUT_USER]: 'high',
  [IDataQualityIssue.WARRANTY_EXPIRED]: 'medium',
  [IDataQualityIssue.WARRANTY_EXPIRING_SOON]: 'low',
  [IDataQualityIssue.RETURN_OVERDUE]: 'high',
  [IDataQualityIssue.RETURN_DUE_SOON]: 'medium',
};

const SEVERITY_ORDER: Record<IDataQualitySeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

interface RawIssueRow {
  issue: string;
  asset_id: string;
  asset_name: string;
  serial_number: string;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  assigned_user_email: string | null;
  assigned_user_avatar_filename: string | null;
  detail: string | null;
  signature: string;
}

// Computed row plus its internal signature. The signature never leaves this module — it is
// stripped from every public result so the API row shape stays unchanged.
type InternalRow = IDataQualityRow & { signature: string };

function stripSignature(row: InternalRow): IDataQualityRow {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { signature, ...rest } = row;
  return rest;
}

const BASE_COLUMNS = [
  'asset.id as asset_id',
  'asset.name as asset_name',
  'asset.serial_number',
  'asset.assigned_user_id',
  'user.display_name as assigned_user_name',
  'user.email as assigned_user_email',
  'user.avatar_filename as assigned_user_avatar_filename',
];

function inactiveUserAssignedQb(db: Knex): Knex.QueryBuilder {
  return db('asset')
    .select(db.raw(`?::text as issue`, [IDataQualityIssue.INACTIVE_USER_ASSIGNED]))
    .select(BASE_COLUMNS)
    .select(db.raw(`'Assignee account is inactive' as detail`))
    .select(db.raw(`${SIGNATURE_EXPR[IDataQualityIssue.INACTIVE_USER_ASSIGNED]} as signature`))
    .join('user', 'asset.assigned_user_id', 'user.id')
    .where('asset.status', 'ASSIGNED')
    .where('user.status', 'INACTIVE');
}

function assignedWithoutUserQb(db: Knex): Knex.QueryBuilder {
  return db('asset')
    .select(db.raw(`?::text as issue`, [IDataQualityIssue.ASSIGNED_WITHOUT_USER]))
    .select(BASE_COLUMNS)
    .select(db.raw(`'Assigned status without an owner' as detail`))
    .select(db.raw(`${SIGNATURE_EXPR[IDataQualityIssue.ASSIGNED_WITHOUT_USER]} as signature`))
    .leftJoin('user', 'asset.assigned_user_id', 'user.id')
    .where('asset.status', 'ASSIGNED')
    .whereNull('asset.assigned_user_id');
}

function warrantyExpiredQb(db: Knex): Knex.QueryBuilder {
  return db('asset')
    .select(db.raw(`?::text as issue`, [IDataQualityIssue.WARRANTY_EXPIRED]))
    .select(BASE_COLUMNS)
    .select(db.raw(`'Warranty has expired' as detail`))
    .select(db.raw(`${SIGNATURE_EXPR[IDataQualityIssue.WARRANTY_EXPIRED]} as signature`))
    .leftJoin('user', 'asset.assigned_user_id', 'user.id')
    .whereNotNull('asset.warranty_end_date')
    .whereRaw('asset.warranty_end_date < CURRENT_DATE');
}

function warrantyExpiringSoonQb(db: Knex): Knex.QueryBuilder {
  return db('asset')
    .select(db.raw(`?::text as issue`, [IDataQualityIssue.WARRANTY_EXPIRING_SOON]))
    .select(BASE_COLUMNS)
    .select(db.raw(`'Warranty expires within 30 days' as detail`))
    .select(db.raw(`${SIGNATURE_EXPR[IDataQualityIssue.WARRANTY_EXPIRING_SOON]} as signature`))
    .leftJoin('user', 'asset.assigned_user_id', 'user.id')
    .whereNotNull('asset.warranty_end_date')
    .whereRaw('asset.warranty_end_date > CURRENT_DATE')
    .whereRaw("asset.warranty_end_date <= CURRENT_DATE + INTERVAL '30 days'");
}

function returnOverdueQb(db: Knex): Knex.QueryBuilder {
  return db('asset')
    .select(db.raw(`?::text as issue`, [IDataQualityIssue.RETURN_OVERDUE]))
    .select(BASE_COLUMNS)
    .select(db.raw(`'Expected return date has passed' as detail`))
    .select(db.raw(`${SIGNATURE_EXPR[IDataQualityIssue.RETURN_OVERDUE]} as signature`))
    .leftJoin('user', 'asset.assigned_user_id', 'user.id')
    .where('asset.status', 'ASSIGNED')
    .whereNotNull('asset.expected_return_date')
    .whereRaw('asset.expected_return_date < CURRENT_DATE');
}

function returnDueSoonQb(db: Knex): Knex.QueryBuilder {
  return db('asset')
    .select(db.raw(`?::text as issue`, [IDataQualityIssue.RETURN_DUE_SOON]))
    .select(BASE_COLUMNS)
    .select(db.raw(`'Return due within 7 days' as detail`))
    .select(db.raw(`${SIGNATURE_EXPR[IDataQualityIssue.RETURN_DUE_SOON]} as signature`))
    .leftJoin('user', 'asset.assigned_user_id', 'user.id')
    .where('asset.status', 'ASSIGNED')
    .whereNotNull('asset.expected_return_date')
    .whereRaw('asset.expected_return_date > CURRENT_DATE')
    .whereRaw("asset.expected_return_date <= CURRENT_DATE + INTERVAL '7 days'");
}

const ISSUE_BUILDERS: Record<IDataQualityIssue, (db: Knex) => Knex.QueryBuilder> = {
  [IDataQualityIssue.INACTIVE_USER_ASSIGNED]: inactiveUserAssignedQb,
  [IDataQualityIssue.ASSIGNED_WITHOUT_USER]: assignedWithoutUserQb,
  [IDataQualityIssue.WARRANTY_EXPIRED]: warrantyExpiredQb,
  [IDataQualityIssue.WARRANTY_EXPIRING_SOON]: warrantyExpiringSoonQb,
  [IDataQualityIssue.RETURN_OVERDUE]: returnOverdueQb,
  [IDataQualityIssue.RETURN_DUE_SOON]: returnDueSoonQb,
};

function issueBuilders(db: Knex, issue?: IDataQualityIssue): Knex.QueryBuilder[] {
  if (issue) {
    return [ISSUE_BUILDERS[issue](db)];
  }
  return Object.values(IDataQualityIssue).map((code) => ISSUE_BUILDERS[code](db));
}

function adaptRow(row: RawIssueRow): InternalRow {
  const issue = row.issue as IDataQualityIssue;
  return {
    issue,
    severity: SEVERITY_BY_ISSUE[issue],
    assetId: row.asset_id,
    assetName: row.asset_name,
    serialNumber: row.serial_number,
    assignedUserId: row.assigned_user_id,
    assignedUserName: row.assigned_user_name,
    assignedUserEmail: row.assigned_user_email,
    assignedUserAvatarFilename: row.assigned_user_avatar_filename,
    detail: row.detail,
    signature: row.signature,
  };
}

function applySearch(qb: Knex.QueryBuilder, search: string | undefined): void {
  if (!search?.trim()) return;
  const like = `%${search.trim()}%`;
  qb.where((b) => {
    b.whereILike('asset.name', like)
      .orWhereILike('asset.serial_number', like)
      .orWhereILike('user.display_name', like)
      .orWhereILike('user.email', like);
  });
}

function sortRows(rows: InternalRow[]): InternalRow[] {
  return [...rows].sort((a, b) => {
    const sd = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (sd !== 0) return sd;
    return a.assetName.localeCompare(b.assetName);
  });
}

async function fetchAllRows(issue?: IDataQualityIssue, search?: string): Promise<InternalRow[]> {
  const db = sqlService.myDb;
  const builders = issueBuilders(db, issue);

  if (builders.length === 0) return [];

  const parts = builders.map((qb) => {
    if (search) applySearch(qb, search);
    return qb;
  });

  let union = parts[0];
  for (let i = 1; i < parts.length; i++) {
    union = union.unionAll(parts[i]);
  }

  const rows = (await union) as RawIssueRow[];
  return sortRows(rows.map(adaptRow));
}

export async function listDataQualityRows(params: {
  search?: string;
  page?: number;
  pageSize?: number;
  issue?: IDataQualityIssue;
}): Promise<{ rows: IDataQualityRow[]; total: number }> {
  const all = await fetchAllRows(params.issue, params.search);
  const total = all.length;

  if (params.pageSize == null) {
    return { rows: all.map(stripSignature), total };
  }

  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * params.pageSize;
  return { rows: all.slice(start, start + params.pageSize).map(stripSignature), total };
}

/**
 * Drop rows whose (asset, issue) has a dismissal with a *matching* signature. A dismissal
 * with a stale signature (the underlying value changed, or the issue resolved and recurred)
 * does not match and the row is shown again.
 */
async function filterDismissed(rows: InternalRow[]): Promise<InternalRow[]> {
  const dismissed = await getDismissedMap();
  if (dismissed.size === 0) return rows;
  return rows.filter((r) => dismissed.get(dismissalKey(r.assetId, r.issue)) !== r.signature);
}

export async function listAlerts(params: {
  limit: number;
  issue?: IDataQualityIssue;
  excludeDismissed?: boolean;
}): Promise<{ alerts: IDataQualityRow[]; total: number }> {
  let all = await fetchAllRows(params.issue);
  if (params.excludeDismissed) {
    all = await filterDismissed(all);
  }
  return { alerts: all.slice(0, params.limit).map(stripSignature), total: all.length };
}

/**
 * Recompute the current signature for an active (asset, issue) row, or null if that issue
 * no longer applies to the asset. Used at dismiss time so the stored signature always
 * reflects live state rather than whatever the client last saw.
 */
export async function getCurrentSignature(
  assetId: string,
  issue: IDataQualityIssue,
): Promise<string | null> {
  const db = sqlService.myDb;
  const row = (await ISSUE_BUILDERS[issue](db)
    .clone()
    .where('asset.id', assetId)
    .first()) as RawIssueRow | undefined;
  return row?.signature ?? null;
}

async function countMatching(qb: Knex.QueryBuilder): Promise<number> {
  const row = await qb.clone().clearSelect().count<{ count: string }>('* as count').first();
  return Number(row?.count ?? 0);
}

export async function getAttentionCounts(): Promise<IAttentionCounts> {
  const db = sqlService.myDb;

  const [
    inactiveUserAssignedCount,
    assignedWithoutUserCount,
    warrantyExpiredCount,
    warrantyExpiring30DaysCount,
    returnOverdueCount,
    returnDueSoon7DaysCount,
  ] = await Promise.all([
    countMatching(inactiveUserAssignedQb(db)),
    countMatching(assignedWithoutUserQb(db)),
    countMatching(warrantyExpiredQb(db)),
    countMatching(warrantyExpiringSoonQb(db)),
    countMatching(returnOverdueQb(db)),
    countMatching(returnDueSoonQb(db)),
  ]);

  return {
    inactiveUserAssignedCount,
    assignedWithoutUserCount,
    warrantyExpiredCount,
    warrantyExpiring30DaysCount,
    returnOverdueCount,
    returnDueSoon7DaysCount,
  };
}
