import { NextRequest } from 'next/server';
import { applyRateLimit } from '@/lib/rateLimit';
import { recordQuotaCoolingEvent } from '@/lib/metrics';
import { debugLog } from '@/lib/debug';
import { CACHE_TTL_SECONDS, DEFAULT_PAGE_SIZE, getCached, getRelatedVideos } from '@/lib/youtube';

const CACHE_PREFIX = 'related:';

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.ip || (process.env.NODE_ENV !== 'production' ? 'local-dev' : 'unknown');
  debugLog('RELATED', { event: 'REQUEST_START', ip });
  const rate = await applyRateLimit(ip);
  if (!rate.allowed) {
    debugLog('RELATED', { event: 'RL_BLOCKED', ip });
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const body = await req.json().catch(() => null) as {
    videoId?: string;
    pageToken?: string;
    minDurationSeconds?: number;
    pageSize?: number;
  } | null;

  if (!body?.videoId) {
    return new Response(JSON.stringify({ error: 'missing_videoId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { videoId, pageToken } = body;
  const targetSize = Math.max(1, Math.min(50, body.pageSize ?? DEFAULT_PAGE_SIZE));
  const minDurationSeconds = Math.max(60, body.minDurationSeconds ?? 60);
  const normalizedToken = pageToken ?? 'root';
  const cacheKey = `${CACHE_PREFIX}${videoId}:${minDurationSeconds}:${targetSize}:${normalizedToken}`;

  try {
    const data = await getCached(cacheKey, () => getRelatedVideos(videoId, { pageToken, targetSize, minDurationSeconds }));
    debugLog('RELATED', {
      event: 'RESPONSE_SUCCESS',
      ip,
      videoId,
      pageToken: normalizedToken,
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
      debugLog('RELATED', { event: 'QUOTA_COOLING', ip, videoId });
      recordQuotaCoolingEvent();
      return new Response(JSON.stringify({ error: 'quota_exceeded' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    debugLog('RELATED', {
      event: 'SERVER_ERROR',
      ip,
      videoId,
      error: error instanceof Error ? error.message : error
    });
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
