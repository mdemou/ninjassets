import config from '@config/config';
import eventBus from '@services/events/eventBus';
import { listDataQualityRows } from '@infrastructure/repositories/reportsDb/dataQuality.queries';
import logger from '@services/logger.service';

/**
 * Periodic data-quality scan that publishes `alert.raised` for newly-seen
 * issues (SPEC-WEBHOOK-001 §9.3, D3). Data-quality has no persisted raise/clear
 * lifecycle, so de-duplication is a process-lifetime in-memory set keyed by
 * `issue:assetId`; standing issues are not re-sent each tick, and a restart may
 * re-publish. `alert.cleared` is deferred until alert state is persisted.
 */
const seen = new Set<string>();

export async function scanDataQualityAlerts(): Promise<void> {
  if (!config.webhooks.enabled) return;
  try {
    const { rows } = await listDataQualityRows({});
    for (const row of rows) {
      const key = `${row.issue}:${row.assetId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      eventBus.publish({
        type: 'alert.raised',
        occurredAt: new Date().toISOString(),
        actor: null,
        subject: { kind: 'alert', id: row.assetId, name: row.assetName },
        target: row.assignedUserId ? { id: row.assignedUserId, name: row.assignedUserName } : null,
        detail: row.detail ?? `${row.issue} (${row.severity})`,
        link: `${config.frontendUrl}/admin/assets/${row.assetId}`,
      });
    }
  } catch (error) {
    logger.error(__filename, 'scanDataQualityAlerts', 'error', error);
  }
}
