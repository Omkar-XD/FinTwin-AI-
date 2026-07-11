import { getRedis } from '../lib/redis.js';

const r = getRedis();
r.ping()
  .then((result) => {
    console.log('Redis PING result:', result);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Redis PING failed:', err);
    process.exit(1);
  });