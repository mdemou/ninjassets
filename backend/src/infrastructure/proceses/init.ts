import { createServer } from '@services/server.service';
import { plugins } from '@plugins/plugins';
import { registerStrategies } from '@strategies/strategies';
import { routes } from '@routes/routes';
import { registerLifecycle } from './lifecycle';
import sqlService from '@services/sql.service';
import logger from '@services/logger.service';
import emailVerificationTokenDbRepository from '@infrastructure/repositories/emailVerificationTokenDb/emailVerificationTokenDb.repository';
import passwordResetTokenDbRepository from '@infrastructure/repositories/passwordResetTokenDb/passwordResetTokenDb.repository';
import { purgeApiRetention, registerApiHooks } from '@infrastructure/hooks/apiHooks';
import config, { notificationsConfig } from '@config/config';
import eventBus from '@services/events/eventBus';
import notificationService from '@services/notifications/notificationService';
import { notificationReaper } from '@infrastructure/notifications/notificationReaper';
import { scanDataQualityAlerts } from '@infrastructure/webhooks/alertScan';
import queueConsumer from '@proceses/queueConsumer';
import importExportWorker from '@proceses/importExportWorker';
import scheduler from '@proceses/scheduler';
import { importFileStorage } from '@services/importExport/importFileStorage.service';

async function cleanupExpiredTokens() {
  try {
    const emailCount = await emailVerificationTokenDbRepository.deleteExpired();
    const resetCount = await passwordResetTokenDbRepository.deleteExpired();
    if (emailCount > 0 || resetCount > 0) {
      logger.info(__filename, 'cleanupExpiredTokens', `Cleaned up ${emailCount} email verification and ${resetCount} password reset expired tokens`);
    }
  } catch (error) {
    logger.error(__filename, 'cleanupExpiredTokens', 'error', error);
  }
}

export async function initServer() {
  const server = createServer();

  await server.register(plugins);
  registerStrategies(server);
  registerApiHooks(server);
  server.route(routes);
  registerLifecycle(server);

  await sqlService.isReady();
  logger.info(__filename, 'sql', '[POSTGRESQL] Connected successfully');

  // Periodic maintenance runs via the Redis-backed scheduler: each job's lastRunAt
  // is persisted in Redis (restart does not reset the clock) and a SETNX lock keeps
  // it single-runner across instances. See scheduler.ts.
  scheduler.register({
    name: 'token-cleanup',
    intervalMs: config.maintenance.tokenCleanupMs,
    handler: cleanupExpiredTokens,
  });
  scheduler.register({
    name: 'api-retention-purge',
    intervalMs: config.maintenance.apiRetentionPurgeMs,
    handler: purgeApiRetention,
  });

  // Notifications: the event bus enqueues webhook jobs (gated internally by the
  // webhooks kill-switch); domains enqueue email jobs directly. The consumer +
  // reaper run whenever the pipeline is enabled — independent of webhooks, so
  // mandatory emails are never stopped by disabling webhooks (SPEC-WEBHOOK-001 §7).
  eventBus.subscribe((event) => {
    void notificationService.webhook(event);
  });

  if (notificationsConfig.enabled) {
    void queueConsumer.consumeList();
    // Reaper is already multi-instance-safe (LREM races resolve to a no-op), so it
    // runs unlocked — every instance may reap its own stranded jobs.
    scheduler.register({
      name: 'notification-reaper',
      intervalMs: notificationsConfig.reaperIntervalMs,
      handler: () => notificationReaper.reap(),
      lock: false,
    });
  }

  // Periodic data-quality alert scan (publishes alert.raised → webhook jobs).
  if (config.webhooks.enabled) {
    scheduler.register({
      name: 'data-quality-scan',
      intervalMs: config.webhooks.alertScanIntervalMs,
      handler: scanDataQualityAlerts,
    });
  }

  // Import/export hub (SPEC-IMPORT-001): event-driven worker drains async jobs; a
  // periodic safety sweep both drains jobs missed while Redis was down and deletes
  // uploaded files/artifacts past the retention window (§13).
  importExportWorker.start();
  if (config.importExport.enabled) {
    scheduler.register({
      name: 'import-export-sweep',
      intervalMs: config.importExport.safetySweepMs,
      handler: importExportWorker.sweep,
    });
  }
  scheduler.register({
    name: 'import-artifact-purge',
    intervalMs: config.maintenance.importArtifactPurgeMs,
    handler: async () => {
      await importFileStorage.purgeExpired();
    },
  });

  scheduler.start();

  return server;
}
