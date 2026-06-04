import Redis, { RedisOptions } from 'ioredis';
import config from '../config/config';
import logger from './logger.service';

interface IRedisClient extends Redis {
  isInitialConnection: boolean;
  readyCallbacks: (() => Promise<void>)[];
}

interface IRedisConfig extends RedisOptions {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest?: number;
  retryStrategy?: (times: number) => number;
  reconnectOnError?: (err: Error) => boolean;
  enableOfflineQueue?: boolean;
  connectTimeout?: number;
}

const redisConfig: IRedisConfig = {
  host: config.db.redis.host,
  port: Number(config.db.redis.port),
  // Empty string would send AUTH with a blank password; coerce to undefined so a
  // password-less local redis is not rejected.
  password: config.db.redis.password || undefined,
  db: Number(config.db.redis.db),
  maxRetriesPerRequest: 5,
  retryStrategy: (times: number) => {
    const delay = Math.min(100 * Math.pow(2, times - 1), 15000);
    logger.debug(__filename, 'redis', `Retrying connection, attempt ${times}, delay ${delay}ms`, {});
    return delay;
  },
  reconnectOnError: (err: Error) => {
    const targetErrors = ['READONLY', 'CLUSTERDOWN'];
    if (targetErrors.some((target) => err.message.includes(target))) {
      logger.warn(__filename, 'redis', `Triggering reconnect due to error: ${err.message}`, {});
      return true;
    }
    return false;
  },
  enableOfflineQueue: true,
  connectTimeout: 10000,
};

const nonBlockingClient = new Redis(redisConfig) as IRedisClient;
nonBlockingClient.isInitialConnection = true;
nonBlockingClient.readyCallbacks = [];

const blockingClient = new Redis(redisConfig) as IRedisClient;
blockingClient.isInitialConnection = true;
blockingClient.readyCallbacks = [];

// Dedicated blocking connection for the import/export worker. A separate connection
// (not the shared blockingClient) is required because ioredis serializes commands on
// one connection: a long BLPOP here would otherwise stall the notification consumer's
// BRPOPLPUSH and vice versa.
const importBlockingClient = new Redis(redisConfig) as IRedisClient;
importBlockingClient.isInitialConnection = true;
importBlockingClient.readyCallbacks = [];

const redisService = {
  isReady: async (): Promise<void> => {
    try {
      const pong = await nonBlockingClient.ping();
      if (pong !== 'PONG') {
        throw new Error('Unexpected PING response');
      }
    } catch (error) {
      logger.error(__filename, 'redis', 'Connection test failed', error);
      throw new Error('Error testing Redis connection');
    }
  },

  blpop: async (keys: string[], timeout: number): Promise<string[] | null> => {
    try {
      const result = await blockingClient.blpop(...keys, timeout);
      return result;
    } catch (error) {
      logger.error(__filename, 'redis', 'BLPOP error', error);
      throw new Error('Error executing BLPOP');
    }
  },

  /** BLPOP on the dedicated import/export connection so it never contends with the
   *  notification consumer. Returns [key, value] or null on timeout. */
  blpopImportExport: async (key: string, timeout: number): Promise<string[] | null> => {
    try {
      return await importBlockingClient.blpop(key, timeout);
    } catch (error) {
      logger.error(__filename, 'redis', 'BLPOP (import/export) error', error);
      throw new Error('Error executing BLPOP (import/export)');
    }
  },

  /** Atomic blocking move tail(source) → head(destination). Returns the value or null on timeout. */
  brpoplpush: async (source: string, destination: string, timeout: number): Promise<string | null> => {
    try {
      // Uses the blocking client so it never stalls other commands; released on terminate().
      return await blockingClient.brpoplpush(source, destination, timeout);
    } catch (error) {
      logger.error(__filename, 'redis', 'BRPOPLPUSH error', error);
      throw new Error('Error executing BRPOPLPUSH');
    }
  },

  rpush: async (key: string, message: string, expirationTimeInSeconds?: number): Promise<number> => {
    try {
      const result = await nonBlockingClient.rpush(key, message);
      if (expirationTimeInSeconds !== undefined) {
        await nonBlockingClient.expire(key, expirationTimeInSeconds);
      }
      return result;
    } catch (error) {
      logger.error(__filename, 'redis', 'RPUSH error', error);
      throw new Error('Error executing RPUSH');
    }
  },

  llen: async (key: string): Promise<number> => {
    try {
      return await nonBlockingClient.llen(key);
    } catch (error) {
      logger.error(__filename, 'redis', 'LLEN error', error);
      throw new Error('Error executing LLEN');
    }
  },

  /** SET key value NX EX ttl — atomic "set if absent". Returns true if the key was set. */
  setNx: async (key: string, value: string, ttlSeconds: number): Promise<boolean> => {
    try {
      const result = await nonBlockingClient.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      logger.error(__filename, 'redis', 'SET NX error', error);
      throw new Error('Error executing SET NX');
    }
  },

  terminate: async (): Promise<void> => {
    // Quit all clients independently so a pending BLPOP on a blocking client is
    // released on shutdown and one failing quit does not block the others.
    await Promise.allSettled([
      nonBlockingClient.quit(),
      blockingClient.quit(),
      importBlockingClient.quit(),
    ]).then((results) => {
      for (const result of results) {
        if (result.status === 'rejected') {
          logger.error(__filename, 'redis', 'Shutdown error', result.reason);
        }
      }
    });
  },

  zadd: async (key: string, score: number, member: string): Promise<number> => {
    try {
      const result = await nonBlockingClient.zadd(key, score, member);
      return result;
    } catch (error) {
      logger.error(__filename, 'redis', 'ZADD error', error);
      throw new Error('Error executing ZADD');
    }
  },

  zcount: async (key: string, min: number | string, max: number | string): Promise<number> => {
    try {
      const result = await nonBlockingClient.zcount(key, min, max);
      return result;
    } catch (error) {
      logger.error(__filename, 'redis', 'ZCOUNT error', error);
      throw new Error('Error executing ZCOUNT');
    }
  },

  zrangebyscore: async (key: string, min: number | string, max: number | string): Promise<string[]> => {
    try {
      const result = await nonBlockingClient.zrangebyscore(key, min, max);
      return result;
    } catch (error) {
      logger.error(__filename, 'redis', 'ZRANGEBYSCORE error', error);
      throw new Error('Error executing ZRANGEBYSCORE');
    }
  },

  zrem: async (key: string, member: string): Promise<number> => {
    try {
      const result = await nonBlockingClient.zrem(key, member);
      return result;
    } catch (error) {
      logger.error(__filename, 'redis', 'ZREM error', error);
      throw new Error('Error executing ZREM');
    }
  },

  lrange: async (key: string, start: number, stop: number): Promise<string[]> => {
    try {
      const result = await nonBlockingClient.lrange(key, start, stop);
      return result;
    } catch (error) {
      logger.error(__filename, 'redis', 'LRANGE error', error);
      throw new Error('Error executing LRANGE');
    }
  },

  lrem: async (key: string, count: number, value: string): Promise<number> => {
    try {
      const result = await nonBlockingClient.lrem(key, count, value);
      return result;
    } catch (error) {
      logger.error(__filename, 'redis', 'LREM error', error);
      throw new Error('Error executing LREM');
    }
  },

  get: async (key: string): Promise<string | null> => {
    try {
      const result = await nonBlockingClient.get(key);
      return result;
    } catch (error) {
      logger.error(__filename, 'redis', 'GET error', error);
      throw new Error('Error executing GET');
    }
  },

  set: async (key: string, value: string, expirationSeconds?: number): Promise<string> => {
    try {
      if (expirationSeconds) {
        const result = await nonBlockingClient.set(key, value, 'EX', expirationSeconds);
        return result;
      } else {
        const result = await nonBlockingClient.set(key, value);
        return result;
      }
    } catch (error) {
      logger.error(__filename, 'redis', 'SET error', error);
      throw new Error('Error executing SET');
    }
  },

  scan: async (pattern: string): Promise<string[]> => {
    try {
      const keys: string[] = [];
      let cursor = '0';

      do {
        const [newCursor, foundKeys] = await nonBlockingClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        keys.push(...foundKeys);
      } while (cursor !== '0');

      return keys;
    } catch (error) {
      logger.error(__filename, 'redis', 'SCAN error', error);
      throw new Error('Error executing SCAN');
    }
  },

  zremrangebyscore: async (key: string, min: string | number, max: string | number): Promise<number> => {
    try {
      const result = await nonBlockingClient.zremrangebyscore(key, min, max);
      return result;
    } catch (error) {
      logger.error(__filename, 'redis', 'ZREMRANGEBYSCORE error', error);
      throw new Error('Error executing ZREMRANGEBYSCORE');
    }
  },

  del: async (key: string): Promise<number> => {
    try {
      const result = await nonBlockingClient.del(key);
      return result;
    } catch (error) {
      logger.error(__filename, 'redis', 'DEL error', error);
      throw new Error('Error executing DEL');
    }
  },

  registerOnReady: (callback: () => Promise<void>): void => {
    nonBlockingClient.readyCallbacks.push(callback);
  },
};

nonBlockingClient.on('error', (error: Error) => {
  logger.error(__filename, 'redis', 'Client error', error);
});

importBlockingClient.on('error', (error: Error) => {
  logger.error(__filename, 'redis', 'Import blocking client error', error);
});

nonBlockingClient.on('ready', () => {
  void (async () => {
    logger.info(
      __filename,
      'redis',
      'Redis ready event fired',
      `isInitialConnection: ${nonBlockingClient.isInitialConnection}`,
    );

    if (nonBlockingClient.isInitialConnection) {
      nonBlockingClient.isInitialConnection = false;
      return;
    }

    for (const callback of nonBlockingClient.readyCallbacks) {
      try {
        await callback();
      } catch (error) {
        logger.error(__filename, 'redis', 'Ready callback failed', error);
      }
    }
  })();
});

export default redisService;
