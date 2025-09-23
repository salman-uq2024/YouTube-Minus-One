import { NextRequest } from 'next/server';
import { applyRateLimit } from '@/lib/rateLimit';
import { getCache } from '@/lib/cache';
import { recordQuotaCoolingEvent } from '@/lib/metrics';
import { debugLog } from '@/lib/debug';
import { CACHE_TTL_SECONDS, DEFAULT_PAGE_SIZE, getCached, searchVideos } from '@/lib/youtube';
import type { NormalizedVideo } from '@/lib/youtube';

const CACHE_PREFIX = 'search:';

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.ip || (process.env.NODE_ENV !== 'production' ? 'local-dev' : 'unknown');
  debugLog('SEARCH', { event: 'REQUEST_START', ip });
  const rate = await applyRateLimit(ip);
  if (!rate.allowed) {
    debugLog('SEARCH', { event: 'RL_BLOCKED', ip });
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const body = await req.json().catch(() => null) as {
    query?: string;
    pageToken?: string;
    regionCode?: string;
    minDurationSeconds?: number;
    pageSize?: number;
  } | null;

  if (!body?.query) {
    return new Response(JSON.stringify({ error: 'missing_query' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { query, pageToken, regionCode } = body;
  const targetSize = Math.max(1, Math.min(50, body.pageSize ?? DEFAULT_PAGE_SIZE));
  const minDurationSeconds = Math.max(60, body.minDurationSeconds ?? 60);
  const cacheKey = `${CACHE_PREFIX}${query}:${pageToken ?? ''}:${regionCode ?? ''}:${targetSize}:${minDurationSeconds}`;

  try {
    const data = await getCached(
      cacheKey,
      async () =>
        searchVideos(query, {
          pageToken,
          regionCode,
          targetSize,
          minDurationSeconds
        }),
      CACHE_TTL_SECONDS
    );
    debugLog('SEARCH', {
      event: 'RESPONSE_SUCCESS',
      ip,
      query,
      itemCount: data.items.length
    });
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate`
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'quota_exceeded') {
      const cache = getCache();
      const fallbackRegion = regionCode ?? 'US';
      const fallbackKey = `popular:${fallbackRegion}:all:${minDurationSeconds}:${targetSize}:root`;
      const cachedPopular = await cache.get<{ items: NormalizedVideo[]; nextPageToken: string | null }>(fallbackKey);
      if (cachedPopular) {
        const filteredItems = cachedPopular.items
          .filter((item) => item.durationSec >= minDurationSeconds)
          .slice(0, targetSize);
        recordQuotaCoolingEvent();
        debugLog('SEARCH', {
          event: 'QUOTA_COOLING_FALLBACK',
          ip,
          query,
          regionCode: fallbackRegion,
          fromCache: true,
          itemCount: filteredItems.length
        });
        return new Response(
          JSON.stringify({ items: filteredItems, nextPageToken: cachedPopular.nextPageToken, error: 'quota_exceeded' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      recordQuotaCoolingEvent();
      debugLog('SEARCH', { event: 'QUOTA_COOLING_NO_FALLBACK', ip, query });
      return new Response(JSON.stringify({ error: 'quota_exceeded' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    debugLog('SEARCH', {
      event: 'SERVER_ERROR',
      ip,
      query,
      error: error instanceof Error ? error.message : error
    });
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
