import { NextRequest } from 'next/server';
import { applyRateLimit } from '@/lib/rateLimit';
import { recordQuotaCoolingEvent } from '@/lib/metrics';
import {
  CACHE_TTL_SECONDS,
  DEFAULT_PAGE_SIZE,
  getCached,
  getCuratedEducationVideos,
  getGlobalMostPopular,
  getMostPopularVideos,
  getVideoCategoryIdByTitle
} from '@/lib/youtube';
import { debugLog } from '@/lib/debug';

const CACHE_PREFIX = 'popular:';

export async function GET(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.ip || (process.env.NODE_ENV !== 'production' ? 'local-dev' : 'unknown');
  debugLog('POPULAR', { event: 'REQUEST_START', ip, url: req.url });
  const rate = await applyRateLimit(ip);
  if (!rate.allowed) {
    debugLog('POPULAR', { event: 'RL_BLOCKED', ip });
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { searchParams } = new URL(req.url);
  const regionCode = (searchParams.get('regionCode') ?? 'US').toUpperCase();
  const pageToken = searchParams.get('pageToken') ?? undefined;
  const targetSize = Math.max(1, Math.min(50, Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE));
  const minDurationSeconds = Math.max(60, Number(searchParams.get('minDurationSeconds')) || 60);
  const videoCategoryIdParam = searchParams.get('videoCategoryId') ?? undefined;
  const categoryTitleParam = searchParams.get('categoryTitle')?.trim() || undefined;
  const categoryKey = searchParams.get('categoryKey') ?? undefined;
  const normalizedToken = pageToken ?? 'root';
  const isGlobalRegion = regionCode === 'GLOBAL';

  debugLog('CATEGORY', {
    event: 'REQUEST',
    regionCode,
    categoryKey,
    categoryTitle: categoryTitleParam,
    videoCategoryId: videoCategoryIdParam
  });

  let resolvedCategoryId = videoCategoryIdParam ?? undefined;

  if (!isGlobalRegion && categoryTitleParam && !resolvedCategoryId) {
    const resolved = await getVideoCategoryIdByTitle(regionCode, categoryTitleParam);
    if (!resolved) {
      debugLog('CATEGORY', {
        event: 'FALLBACK_REGION',
        regionCode,
        categoryTitle: categoryTitleParam
      });
    }
    resolvedCategoryId = resolved ?? undefined;
  }

  if (!resolvedCategoryId && categoryTitleParam) {
    debugLog('CATEGORY', {
      event: 'FALLBACK_GLOBAL',
      regionCode,
      categoryTitle: categoryTitleParam
    });
  }

  const categorySegment = resolvedCategoryId
    ? `id:${resolvedCategoryId}`
    : categoryTitleParam
    ? `title:${slugify(categoryTitleParam)}`
    : 'all';

  const cacheKey = `${CACHE_PREFIX}${regionCode}:${categorySegment}:${minDurationSeconds}:${targetSize}:${normalizedToken}`;

  let categoryFallbackUsed = Boolean(categoryTitleParam && !resolvedCategoryId);
  let categoryFallbackReason: string | null = categoryFallbackUsed ? 'category_unavailable' : null;

  const meta = {
    categoryFallback: categoryFallbackUsed,
    categoryFallbackReason,
    categoryTitle: categoryTitleParam ?? null,
    categoryId: resolvedCategoryId ?? null,
    regionCode,
    source: 'category' as 'category' | 'curated'
  };

  try {
    const data = await getCached(
      cacheKey,
      () =>
        (async () => {
          try {
            return isGlobalRegion
              ? await getGlobalMostPopular({
                  targetSize,
                  minDurationSeconds,
                  categoryTitle: categoryTitleParam,
                  categoryId: resolvedCategoryId ?? undefined
                })
              : await getMostPopularVideos(regionCode, {
                  pageToken,
                  targetSize,
                  minDurationSeconds,
                  categoryId: resolvedCategoryId
                });
          } catch (error) {
            if (categoryTitleParam || resolvedCategoryId) {
              categoryFallbackUsed = true;
              categoryFallbackReason = error instanceof Error ? error.message : String(error);
              meta.categoryFallback = true;
              meta.categoryFallbackReason = categoryFallbackReason;
              debugLog('POPULAR', {
                event: 'CATEGORY_ERROR_FALLBACK',
                regionCode,
                categoryTitle: categoryTitleParam,
                categoryId: resolvedCategoryId,
                message: categoryFallbackReason
              });

              meta.source = 'curated';
              const curated = await getCuratedEducationVideos({
                pageToken,
                targetSize,
                minDurationSeconds
              });
              return curated;
            }

            throw error;
          }
        })(),
      CACHE_TTL_SECONDS
    );
    meta.categoryFallback = categoryFallbackUsed;
    meta.categoryFallbackReason = categoryFallbackReason;
    debugLog('POPULAR', {
      event: 'RESPONSE_SUCCESS',
      ip,
      regionCode,
      pageToken: normalizedToken,
      category: categorySegment,
      itemCount: data.items.length,
      categoryFallback: meta.categoryFallback,
      categoryFallbackReason,
      categoryId: meta.categoryId
    });
    return new Response(JSON.stringify({ ...data, meta }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate`
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'quota_exceeded') {
      debugLog('POPULAR', {
        event: 'QUOTA_COOLING',
        ip,
        regionCode
      });
      recordQuotaCoolingEvent();
      return new Response(JSON.stringify({ error: 'quota_exceeded' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    debugLog('POPULAR', {
      event: 'SERVER_ERROR',
      ip,
      regionCode,
      error: error instanceof Error ? error.message : error
    });
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
