import config from '@config/config';
import { DomainEvent } from '@services/events/event.types';

/** A representative event used by the "send test" action (SPEC-WEBHOOK-001 US-W2). */
export function buildSampleEvent(): DomainEvent {
  return {
    type: 'asset.assigned',
    occurredAt: new Date().toISOString(),
    actor: { id: null, name: 'ninjasset' },
    subject: { kind: 'asset', id: null, name: 'Test asset' },
    target: { id: null, name: 'Test user' },
    detail: 'This is a test message from ninjasset webhooks.',
    link: `${config.frontendUrl}/admin/overview`,
  };
}
