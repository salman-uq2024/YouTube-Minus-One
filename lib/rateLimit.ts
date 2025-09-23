import { recordRateLimitBypass, recordRateLimitHit, recordRateLimitRequest } from './metrics';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

const SHORT_WINDOW_SECONDS = 60;
const SHORT_MAX_REQUESTS = 5;
const DAILY_WINDOW_SECONDS = 60 * 60 * 24;
const DAILY_MAX_REQUESTS = 100;

interface CounterWindow {
  count: number;
  resetAt: number;
}

const memoryShortWindow = new Map<string, CounterWindow>();
const memoryDailyWindow = new Map<string, CounterWindow>();

function touchWindow(map: Map<string, CounterWindow>, identifier: string, windowSeconds: number): CounterWindow {
  const now = Date.now();
  const current = map.get(identifier);
  if (!current || current.resetAt <= now) {
    const next: CounterWindow = {
      count: 0,
      resetAt: now + windowSeconds * 1000
    };
    map.set(identifier, next);
    return next;
  }
  return current;
}

function consumeFromWindow(map: Map<string, CounterWindow>, identifier: string, windowSeconds: number) {
  const window = touchWindow(map, identifier, windowSeconds);
  window.count += 1;
  map.set(identifier, window);
  return window;
}

export async function applyRateLimit(identifier: string): Promise<RateLimitResult> {
  recordRateLimitRequest();
  const isDev = process.env.NODE_ENV !== 'production';
  const bypass = process.env.DISABLE_RATE_LIMIT === '1';
  if (isDev || bypass) {
    recordRateLimitBypass();
    return {
      allowed: true,
      remaining: Number.POSITIVE_INFINITY,
      reset: Date.now() + SHORT_WINDOW_SECONDS * 1000
    };
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const nowMs = Date.now();
    const shortKey = `ratelimit:1m:${identifier}`;
    const dailyKey = `ratelimit:1d:${identifier}`;
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ['INCR', shortKey],
        ['EXPIRE', shortKey, SHORT_WINDOW_SECONDS],
        ['INCR', dailyKey],
        ['EXPIRE', dailyKey, DAILY_WINDOW_SECONDS]
      ])
    });

    if (!res.ok) {
      recordRateLimitBypass();
      return {
        allowed: true,
        remaining: SHORT_MAX_REQUESTS,
        reset: nowMs + SHORT_WINDOW_SECONDS * 1000
      };
    }

    const data = (await res.json()) as { result: Array<{ result: number }> };
    const shortCount = data.result?.[0]?.result ?? 0;
    const dailyCount = data.result?.[2]?.result ?? 0;
    const shortRemaining = Math.max(0, SHORT_MAX_REQUESTS - shortCount);
    const dailyRemaining = Math.max(0, DAILY_MAX_REQUESTS - dailyCount);
    const allowed = shortCount <= SHORT_MAX_REQUESTS && dailyCount <= DAILY_MAX_REQUESTS;
    const reset = allowed
      ? nowMs + Math.min(SHORT_WINDOW_SECONDS * 1000, DAILY_WINDOW_SECONDS * 1000)
      : dailyRemaining === 0
      ? nowMs + DAILY_WINDOW_SECONDS * 1000
      : nowMs + SHORT_WINDOW_SECONDS * 1000;

    if (!allowed) {
      recordRateLimitHit();
      console.info('[YM1][RATE_LIMIT]', {
        event: 'RL_HIT_REMOTE',
        identifier,
        shortCount,
        dailyCount
      });
    }

    return {
      allowed,
      remaining: Math.min(shortRemaining, dailyRemaining),
      reset
    };
  }

  const shortWindow = consumeFromWindow(memoryShortWindow, identifier, SHORT_WINDOW_SECONDS);
  const dailyWindow = consumeFromWindow(memoryDailyWindow, identifier, DAILY_WINDOW_SECONDS);

  const allowed = shortWindow.count <= SHORT_MAX_REQUESTS && dailyWindow.count <= DAILY_MAX_REQUESTS;
  const shortRemaining = Math.max(0, SHORT_MAX_REQUESTS - shortWindow.count);
  const dailyRemaining = Math.max(0, DAILY_MAX_REQUESTS - dailyWindow.count);
  const reset = allowed
    ? Math.min(shortWindow.resetAt, dailyWindow.resetAt)
    : dailyRemaining === 0
    ? dailyWindow.resetAt
    : shortWindow.resetAt;

  if (!allowed) {
    recordRateLimitHit();
    console.info('[YM1][RATE_LIMIT]', {
      event: 'RL_HIT_MEMORY',
      identifier,
      shortCount: shortWindow.count,
      dailyCount: dailyWindow.count
    });
    return {
      allowed: false,
      remaining: 0,
      reset
    };
  }

  return {
    allowed: true,
    remaining: Math.min(shortRemaining, dailyRemaining),
    reset
  };
}
