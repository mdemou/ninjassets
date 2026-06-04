import config from '@config/config';
import { ICreateTransaction, ITransactionAction } from '@domain/_interfaces/transaction.interface';
import eventBus from './eventBus';
import { EventType } from './eventCatalog';

/**
 * Maps audit-log actions to catalog events (SPEC-WEBHOOK-001 §9.1). Only the
 * subset exposed as webhook events is listed; fine-grained `*_CHANGED` actions
 * stay in the audit log only and are intentionally absent.
 */
const TRANSACTION_EVENT_MAP: Partial<Record<ITransactionAction, EventType>> = {
  [ITransactionAction.CREATED]: 'asset.created',
  [ITransactionAction.ASSIGNED]: 'asset.assigned',
  [ITransactionAction.UNASSIGNED]: 'asset.unassigned',
  [ITransactionAction.STATUS_CHANGED]: 'asset.status_changed',
  [ITransactionAction.SITE_CHANGED]: 'asset.site_changed',
  [ITransactionAction.DELETED]: 'asset.deleted',
  [ITransactionAction.HANDOVER_CREATED]: 'handover.created',
  [ITransactionAction.HANDOVER_CANCELLED]: 'handover.cancelled',
  [ITransactionAction.CUSTODY_ACCEPTED]: 'custody.accepted',
  [ITransactionAction.CUSTODY_COMPLETED_ON_BEHALF]: 'custody.completed_on_behalf',
};

/**
 * Publish a domain event derived from an audit-log row, when the action maps to
 * a catalog event. No-op for actions outside the webhook catalog. Never throws.
 */
export function publishEventFromTransaction(event: ICreateTransaction): void {
  const type = TRANSACTION_EVENT_MAP[event.action];
  if (!type) return;

  const hasTarget = event.targetUserId !== null || event.targetName !== null;
  eventBus.publish({
    type,
    occurredAt: new Date().toISOString(),
    actor: { id: event.actorUserId, name: event.actorName },
    subject: { kind: 'asset', id: event.assetId, name: event.assetName },
    target: hasTarget ? { id: event.targetUserId, name: event.targetName } : null,
    detail: event.detail ?? null,
    link: event.assetId ? `${config.frontendUrl}/admin/assets/${event.assetId}` : null,
  });
}
