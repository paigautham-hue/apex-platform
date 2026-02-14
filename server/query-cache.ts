/**
 * Query caching service for Ask interface
 * Implements 4-hour TTL caching to reduce redundant AI calls
 */

interface CachedQuery {
  query: string;
  response: any;
  timestamp: number;
  tenantId: number;
  personId: number;
}

// In-memory cache (in production, use Redis)
const queryCache = new Map<string, CachedQuery>();

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Generate cache key from query and context
 */
function getCacheKey(query: string, tenantId: number, personId: number): string {
  return `${tenantId}:${personId}:${query.toLowerCase().trim()}`;
}

/**
 * Check if cached query is still valid
 */
function isCacheValid(cached: CachedQuery): boolean {
  const age = Date.now() - cached.timestamp;
  return age < CACHE_TTL_MS;
}

/**
 * Get cached query response if available and valid
 */
export function getCachedQuery(
  query: string,
  tenantId: number,
  personId: number
): any | null {
  const key = getCacheKey(query, tenantId, personId);
  const cached = queryCache.get(key);

  if (!cached) return null;

  if (!isCacheValid(cached)) {
    queryCache.delete(key);
    return null;
  }

  return cached.response;
}

/**
 * Cache query response
 */
export function cacheQuery(
  query: string,
  response: any,
  tenantId: number,
  personId: number
): void {
  const key = getCacheKey(query, tenantId, personId);
  queryCache.set(key, {
    query,
    response,
    timestamp: Date.now(),
    tenantId,
    personId,
  });
}

/**
 * Invalidate cache for a specific person (when new evidence is added)
 */
export function invalidatePersonCache(tenantId: number, personId: number): void {
  const keysToDelete: string[] = [];
  
  queryCache.forEach((value, key) => {
    if (value.tenantId === tenantId && value.personId === personId) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => queryCache.delete(key));
}

/**
 * Clear all expired cache entries (run periodically)
 */
export function cleanExpiredCache(): void {
  const keysToDelete: string[] = [];

  queryCache.forEach((value, key) => {
    if (!isCacheValid(value)) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => queryCache.delete(key));
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    totalEntries: queryCache.size,
    validEntries: Array.from(queryCache.values()).filter(isCacheValid).length,
    expiredEntries: Array.from(queryCache.values()).filter(v => !isCacheValid(v)).length,
  };
}

// Clean expired cache every hour
setInterval(cleanExpiredCache, 60 * 60 * 1000);
