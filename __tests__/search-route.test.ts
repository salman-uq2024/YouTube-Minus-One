import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockSearchVideos = vi.fn();
const mockGetCached = vi.fn();

vi.mock('@/lib/youtube', () => ({
  getCached: (key: string, loader: () => Promise<unknown>) => mockGetCached(key, loader),
  searchVideos: (...args: unknown[]) => mockSearchVideos(...args),
  CACHE_TTL_SECONDS: 10
}));

vi.mock('@/lib/rateLimit', () => ({
  applyRateLimit: vi.fn(async () => ({ allowed: true, remaining: 10, reset: Date.now() }))
}));

import { POST } from '@/app/api/search/route';

describe('search api route', () => {
  beforeEach(() => {
    mockGetCached.mockImplementation(async (_key: string, loader: () => Promise<unknown>) => loader());
    mockSearchVideos.mockResolvedValue({
      items: [
        {
          id: 'abc',
          title: 'Example',
          description: 'Demo',
          thumbnails: {},
          durationSec: 120,
          channelTitle: 'Channel',
          publishedAt: new Date().toISOString(),
          viewCount: 100
        }
      ],
      nextPageToken: null
    });
  });

  it('returns search results when provided with query', async () => {
    const req = new Request('http://localhost/api/search', {
      method: 'POST',
      body: JSON.stringify({ query: 'jazz' }),
      headers: { 'Content-Type': 'application/json' }
    }) as NextRequest;

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { items: Array<{ id: string }> };
    expect(data.items).toHaveLength(1);
    expect(mockSearchVideos).toHaveBeenCalledWith('jazz', { pageToken: undefined, regionCode: undefined });
  });
});
