// In-memory cache replacement for Redis (for development without Redis)
import { logger } from '../utils/logger';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}, 60000);

export async function getCache<T>(key: string): Promise<T | null> {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  try {
    return JSON.parse(entry.value) as T;
  } catch {
    return null;
  }
}

export async function setCache(key: string, value: any, ttlSeconds = 3600): Promise<void> {
  store.set(key, {
    value: JSON.stringify(value),
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function deleteCache(key: string): Promise<void> {
  store.delete(key);
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  for (const key of store.keys()) {
    if (regex.test(key)) {
      store.delete(key);
    }
  }
}

logger.info('Using in-memory cache (Redis not available)');
