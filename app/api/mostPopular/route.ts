import { NextRequest } from 'next/server';
import { applyRateLimit } from '@/lib/rateLimit';
import { CACHE_TTL_SECONDS, getCached, getMostPopularVideos } from '@/lib/youtube';

const CACHE_PREFIX = 'popular:';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
  const rate = await applyRateLimit(ip);
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { searchParams } = new URL(req.url);
  const regionCode = searchParams.get('regionCode') ?? 'US';
  const pageToken = searchParams.get('pageToken') ?? undefined;
  const cacheKey = `${CACHE_PREFIX}${regionCode}:${pageToken ?? ''}`;

  try {
    const data = await getCached(cacheKey, () => getMostPopularVideos(regionCode, pageToken));
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
