import config from '@config/config';
import logger from '@services/logger.service';
import Knex from 'knex';

interface IDbConfig {
  client: string;
  connection: {
    user: string;
    password: string;
    host: string;
    port: number;
    database: string;
  }
}

const dbConfig: IDbConfig = {
  client: 'pg',
  connection: {
    user: config.db.postgres.connection.user,
    password: config.db.postgres.connection.password,
    host: config.db.postgres.connection.host,
    port: config.db.postgres.connection.port,
    database: config.db.postgres.connection.database,
  },
};

const sqlService = {
  isReady: async (): Promise<void> => {
    try {
      await sqlService.myDb.raw('SELECT now()');
    } catch (error) {
      logger.error(__filename, 'sql', 'error', error);
      throw new Error('Error testing DDBB with Knex');
    }
  },
  terminate: async (): Promise<void> => {
    try {
      await sqlService.myDb.destroy();
    } catch (error) {
      logger.error(__filename, 'sql', 'error', error);
      throw new Error('Error closing DDBB connection');
    }
  },

  myDb: Knex(dbConfig),
};

export default sqlService;
