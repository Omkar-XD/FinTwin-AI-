import { Redis, type RedisOptions } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import { env } from './env.js';

function buildRedisOptions(): RedisOptions {
  const options: RedisOptions = {
    maxRetriesPerRequest: null,
  };

  if (env.redisUrl.startsWith('rediss://')) {
    options.tls = {};
  }

  return options;
}

let sharedConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!sharedConnection) {
    sharedConnection = new Redis(env.redisUrl, buildRedisOptions());
  }
  return sharedConnection;
}

export function getBullMqConnectionOptions(): ConnectionOptions {
  return {
    ...buildRedisOptions(),
    url: env.redisUrl,
  };
}
