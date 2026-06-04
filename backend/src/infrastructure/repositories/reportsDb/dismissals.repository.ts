import { IDataQualityIssue } from '@domain/_interfaces/dataQuality.interface';
import sqlService from '@services/sql.service';

export function dismissalKey(assetId: string, issue: string): string {
  return `${assetId}:${issue}`;
}

interface DismissParams {
  assetId: string;
  issue: IDataQualityIssue;
  signature: string;
  dismissedByUserId: string | null;
}

/**
 * Idempotently record (or refresh) a dismissal for an (asset, issue) pair. Re-dismissing
 * an already-dismissed pair updates the stored signature so the row stays hidden against
 * its current state rather than a stale one.
 */
export async function dismiss(params: DismissParams): Promise<void> {
  await sqlService
    .myDb('data_quality_dismissal')
    .insert({
      asset_id: params.assetId,
      issue: params.issue,
      signature: params.signature,
      dismissed_by_user_id: params.dismissedByUserId,
    })
    .onConflict(['asset_id', 'issue'])
    .merge({
      signature: params.signature,
      dismissed_by_user_id: params.dismissedByUserId,
      date_created: new Date().toISOString(),
    });
}

/** Undo a dismissal. No-op if none exists. */
export async function restore(assetId: string, issue: IDataQualityIssue): Promise<void> {
  await sqlService
    .myDb('data_quality_dismissal')
    .where({ asset_id: assetId, issue })
    .del();
}

/** Map of `${assetId}:${issue}` → stored signature, for filtering computed alert rows. */
export async function getDismissedMap(): Promise<Map<string, string>> {
  const rows = await sqlService
    .myDb('data_quality_dismissal')
    .select<{ asset_id: string; issue: string; signature: string }[]>(
      'asset_id',
      'issue',
      'signature',
    );
  return new Map(rows.map((r) => [dismissalKey(r.asset_id, r.issue), r.signature]));
}
