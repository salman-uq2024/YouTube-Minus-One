'use server';

interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

const memoryStore = new Map<string, { value: unknown; expiresAt: number }>();

function pruneMemoryStore() {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}

class MemoryCache implements CacheAdapter {
  async get<T>(key: string): Promise<T | null> {
    pruneMemoryStore();
    const entry = memoryStore.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      memoryStore.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    memoryStore.delete(key);
  }
}

class UpstashCache implements CacheAdapter {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  async get<T>(key: string): Promise<T | null> {
    const res = await fetch(`${this.baseUrl}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      cache: 'no-store'
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { result: string | null };
    if (!data.result) {
      return null;
    }
    return JSON.parse(data.result) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await fetch(`${this.baseUrl}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: JSON.stringify(value), ex: ttlSeconds })
    });
  }

  async del(key: string): Promise<void> {
    await fetch(`${this.baseUrl}/del/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` }
    });
  }
}

let adapter: CacheAdapter | null = null;

export function getCache(): CacheAdapter {
  if (adapter) {
    return adapter;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    adapter = new UpstashCache(url, token);
  } else {
    adapter = new MemoryCache();
  }
  return adapter;
}
