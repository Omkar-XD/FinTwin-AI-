import { getRedis } from './redis.js';

export const DASHBOARD_CACHE_TTL_SECONDS = 300;

export function getDashboardCacheKey(userId: string): string {
  return `dashboard:${userId}`;
}

export async function getDashboardCache(
  userId: string,
): Promise<string | null> {
  return getRedis().get(getDashboardCacheKey(userId));
}

export async function setDashboardCache(
  userId: string,
  payload: string,
): Promise<void> {
  await getRedis().setex(
    getDashboardCacheKey(userId),
    DASHBOARD_CACHE_TTL_SECONDS,
    payload,
  );
}

export async function invalidateDashboardCache(userId: string): Promise<void> {
  await getRedis().del(getDashboardCacheKey(userId));
}
