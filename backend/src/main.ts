import { initServer } from '@proceses/init';

const start = async () => {
  const server = await initServer();
  await server.start();
  console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
  console.error(err);
  process.exit(1);
});

void start();
