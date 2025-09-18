import { NextRequest } from 'next/server';
import { applyRateLimit } from '@/lib/rateLimit';
import { getCached, searchVideos } from '@/lib/youtube';
import { CACHE_TTL_SECONDS } from '@/lib/youtube';

const CACHE_PREFIX = 'search:';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
  const rate = await applyRateLimit(ip);
  if (!rate.allowed) {
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
  } | null;

  if (!body?.query) {
    return new Response(JSON.stringify({ error: 'missing_query' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { query, pageToken, regionCode } = body;
  const cacheKey = `${CACHE_PREFIX}${query}:${pageToken ?? ''}:${regionCode ?? ''}`;

  try {
    const data = await getCached(cacheKey, async () => searchVideos(query, { pageToken, regionCode }), CACHE_TTL_SECONDS);
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate`
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'quota_exceeded') {
      return new Response(JSON.stringify({ error: 'quota_exceeded' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
