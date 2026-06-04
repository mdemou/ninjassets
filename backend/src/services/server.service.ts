import config from '@config/config';
import Hapi from '@hapi/hapi';

export function createServer() {
  return Hapi.server({
    port: config.server.port,
    host: config.server.host,
    routes: {
      cors: true
    },
  });
}
