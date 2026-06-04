import webhooksDomainFactory from '@domain/webhooks/webhooks.domain';
import webhookDestinationDbRepository from '@infrastructure/repositories/webhookDestinationDb/webhookDestinationDb.repository';
import emailService from '@services/email/email.service';
import { NotificationEnvelope } from '@services/notifications/notification.types';
import { resolveEmail } from './notificationResolvers';

/**
 * Routes a notification job to its handler by `kind` — like an HTTP route → its
 * controller (SPEC-WEBHOOK-001 §7). Called by the queue consumer for each popped
 * envelope. A throw here means the job is NOT acked and the reaper will retry
 * (at-least-once). An email resolver returning null is a terminal no-op (acked).
 */
const webhooksDomain = webhooksDomainFactory({
  webhookDestinationRepository: webhookDestinationDbRepository,
});

export async function dispatchNotification(envelope: NotificationEnvelope): Promise<void> {
  if (envelope.kind === 'webhook') {
    await webhooksDomain.deliverEvent(envelope.payload);
    return;
  }
  // email
  const mail = await resolveEmail(envelope.payload.notificationType, envelope.payload.refs);
  if (!mail) return; // user/token gone — nothing to send
  await emailService.sendMail(mail);
}
