import { NextRequest } from 'next/server';
import { applyRateLimit } from '@/lib/rateLimit';
import { getCuratedEducationVideos, DEFAULT_PAGE_SIZE } from '@/lib/youtube';
import { debugLog } from '@/lib/debug';

export async function GET(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.ip || (process.env.NODE_ENV !== 'production' ? 'local-dev' : 'unknown');
  debugLog('EDUCATION', { event: 'REQUEST_START', ip });

  const rate = await applyRateLimit(ip ?? 'unknown');
  if (!rate.allowed) {
    debugLog('EDUCATION', { event: 'RL_BLOCKED', ip });
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { searchParams } = new URL(req.url);
  const pageToken = searchParams.get('pageToken') ?? undefined;
  const targetSize = Math.max(1, Math.min(50, Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE));
  const minDurationSeconds = Math.max(60, Number(searchParams.get('minDurationSeconds')) || 60);

  try {
    const data = await getCuratedEducationVideos({
      pageToken,
      targetSize,
      minDurationSeconds
    });

    return new Response(
      JSON.stringify({
        items: data.items,
        nextPageToken: data.nextPageToken,
        meta: {
          source: 'curated',
          categoryTitle: 'Education',
          categoryFallback: false,
          totalAvailable: data.totalAvailable,
          regionCode: 'GLOBAL'
        }
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=21600, stale-while-revalidate'
        }
      }
    );
  } catch (error) {
    debugLog('EDUCATION', {
      event: 'SERVER_ERROR',
      ip,
      error: error instanceof Error ? error.message : error
    });
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
