'use server';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 60;

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const memoryBuckets = new Map<string, TokenBucket>();

function refill(bucket: TokenBucket) {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000;
  if (elapsed > 0) {
    const tokensToAdd = elapsed * (MAX_REQUESTS / WINDOW_SECONDS);
    bucket.tokens = Math.min(MAX_REQUESTS, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
}

export async function applyRateLimit(identifier: string): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const now = Math.floor(Date.now() / 1000);
    const key = `ratelimit:${identifier}`;
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, WINDOW_SECONDS]
      ])
    });
    if (!res.ok) {
      return { allowed: true, remaining: MAX_REQUESTS, reset: now + WINDOW_SECONDS };
    }
    const data = (await res.json()) as { result: Array<{ result: number }> };
    const count = data.result?.[0]?.result ?? 0;
    const allowed = count <= MAX_REQUESTS;
    return {
      allowed,
      remaining: Math.max(0, MAX_REQUESTS - count),
      reset: now + WINDOW_SECONDS
    };
  }

  const bucket = memoryBuckets.get(identifier) ?? {
    tokens: MAX_REQUESTS,
    lastRefill: Date.now()
  };
  refill(bucket);
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    memoryBuckets.set(identifier, bucket);
    return { allowed: true, remaining: Math.floor(bucket.tokens), reset: Date.now() + WINDOW_SECONDS * 1000 };
  }
  memoryBuckets.set(identifier, bucket);
  return {
    allowed: false,
    remaining: 0,
    reset: Date.now() + WINDOW_SECONDS * 1000
  };
}
