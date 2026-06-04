import type { Server } from '@hapi/hapi';
import sqlService from '@services/sql.service';
import redisService from '@services/redis.service';
import queueConsumer from '@proceses/queueConsumer';
import importExportWorker from '@proceses/importExportWorker';
import scheduler from '@proceses/scheduler';

export function registerLifecycle(server: Server) {
  server.ext('onPreStop', () => {
    console.log('Server is stopping...');
  });

  const shutdown = async () => {
    console.log('Graceful shutdown initiated');
    // Stop the scheduler ticker and both consumer loops, then release all Redis
    // clients (incl. the blocking BLPOP connections) before stopping the server.
    // process.exit remains the backstop.
    scheduler.stop();
    queueConsumer.stopConsumer();
    importExportWorker.stop();
    await sqlService.terminate();
    await redisService.terminate();
    await server.stop({ timeout: 10_000 });
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}
