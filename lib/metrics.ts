type CounterMap = Map<string, number>;

interface MetricsState {
  dataApiCalls: CounterMap;
  cache: {
    hits: number;
    misses: number;
    stores: number;
    joins: number;
    errors: number;
  };
  rateLimit: {
    requests: number;
    hits: number;
    bypasses: number;
  };
  quota: {
    coolingEvents: number;
  };
  lastReset: number;
}

const state: MetricsState = {
  dataApiCalls: new Map(),
  cache: {
    hits: 0,
    misses: 0,
    stores: 0,
    joins: 0,
    errors: 0
  },
  rateLimit: {
    requests: 0,
    hits: 0,
    bypasses: 0
  },
  quota: {
    coolingEvents: 0
  },
  lastReset: Date.now()
};

function increment(map: CounterMap, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function recordDataApiCall(endpoint: string) {
  increment(state.dataApiCalls, endpoint);
}

export function recordCacheHit() {
  state.cache.hits += 1;
}

export function recordCacheMiss() {
  state.cache.misses += 1;
}

export function recordCacheStore() {
  state.cache.stores += 1;
}

export function recordCacheJoin() {
  state.cache.joins += 1;
}

export function recordCacheError() {
  state.cache.errors += 1;
}

export function recordRateLimitRequest() {
  state.rateLimit.requests += 1;
}

export function recordRateLimitHit() {
  state.rateLimit.hits += 1;
}

export function recordRateLimitBypass() {
  state.rateLimit.bypasses += 1;
}

export function recordQuotaCoolingEvent() {
  state.quota.coolingEvents += 1;
}

export function resetMetrics() {
  state.dataApiCalls.clear();
  state.cache = { hits: 0, misses: 0, stores: 0, joins: 0, errors: 0 };
  state.rateLimit = { requests: 0, hits: 0, bypasses: 0 };
  state.quota = { coolingEvents: 0 };
  state.lastReset = Date.now();
}

export function getMetricsSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    lastReset: new Date(state.lastReset).toISOString(),
    dataApiCalls: Object.fromEntries(state.dataApiCalls.entries()),
    cache: { ...state.cache },
    rateLimit: { ...state.rateLimit },
    quota: { ...state.quota }
  };
}
