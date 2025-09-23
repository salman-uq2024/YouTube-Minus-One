import { getCache } from './cache';
import { parseISO8601DurationToSeconds } from './duration';
import { debugLog } from './debug';
import {
  recordCacheError,
  recordCacheHit,
  recordCacheJoin,
  recordCacheMiss,
  recordCacheStore,
  recordDataApiCall,
  recordQuotaCoolingEvent
} from './metrics';
import EDUCATION_CHANNEL_IDS from '@/config/educationChannels';

export interface NormalizedVideo {
  id: string;
  title: string;
  description: string;
  thumbnails: Record<string, { url: string; width?: number; height?: number }>;
  durationSec: number;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number | null;
  channelId: string;
  channelAvatarUrl?: string;
}

interface YouTubeErrorResponse {
  error: {
    code: number;
    message: string;
    errors?: Array<{ reason?: string }>;
  };
}

interface YouTubeThumbnail {
  url: string;
  width?: number;
  height?: number;
}

interface YouTubeVideoListItem {
  id: string;
  contentDetails: {
    duration: string;
  };
  snippet: {
    title: string;
    description: string;
    thumbnails?: Record<string, YouTubeThumbnail>;
    channelTitle: string;
    publishedAt: string;
    channelId: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
  };
}

interface YouTubeVideoListResponse {
  items?: YouTubeVideoListItem[];
  nextPageToken?: string;
}

interface YouTubeSearchItem {
  id?: {
    videoId?: string;
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
  nextPageToken?: string;
}

interface YouTubeChannelListItem {
  id: string;
  snippet: {
    title: string;
    thumbnails?: Record<string, YouTubeThumbnail>;
  };
}

interface YouTubeChannelListResponse {
  items?: YouTubeChannelListItem[];
}

interface YouTubeChannelContentDetailsResponse {
  items?: Array<{
    id: string;
    contentDetails?: {
      relatedPlaylists?: {
        uploads?: string;
      };
    };
  }>;
}

interface YouTubePlaylistItemsResponse {
  items?: Array<{
    contentDetails?: {
      videoId?: string;
    };
  }>;
}

interface YouTubeVideoCategoryListResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      assignable?: boolean;
    };
  }>;
}

interface YouTubeI18nRegionsResponse {
  items?: Array<{
    id: string;
    snippet?: {
      name?: string;
    };
  }>;
}

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const CACHE_TTL_SECONDS = 60 * 60 * 12; // 12 hours
const RAW_CACHE_TTL_SECONDS = 60 * 60 * 12;
const RAW_CACHE_PREFIX = 'yt:raw:';
const VIDEO_CACHE_PREFIX = 'yt:video:';
const VIDEO_CACHE_TTL_SECONDS = CACHE_TTL_SECONDS;
const CHANNEL_CACHE_PREFIX = 'yt:channel:';
const CHANNEL_CACHE_TTL_SECONDS = 60 * 60 * 24;
const CATEGORY_CACHE_PREFIX = 'yt:category:';
const CATEGORY_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
const CATEGORY_CACHE_NONE = '__none__';
const REGIONS_CACHE_KEY = 'yt:i18nRegions';
const REGIONS_CACHE_TTL_SECONDS = 60 * 60 * 24 * 60;
const EDUCATION_CURATED_CACHE_KEY = 'education:curated:v1';
const EDUCATION_CURATED_TTL_SECONDS = 60 * 60 * 12;
const EDUCATION_UPLOADS_CACHE_KEY = 'education:uploads:v1';
const EDUCATION_UPLOADS_TTL_SECONDS = 60 * 60 * 24;
export const DEFAULT_PAGE_SIZE = 24;
const MAX_API_PAGE_FETCHES = 5;
const MAX_SEARCH_RESULTS_PER_CALL = 50;
const MAX_VIDEO_IDS_PER_REQUEST = 50;
const MIN_SHORTS_THRESHOLD = 60;
const MAX_CHANNEL_IDS_PER_REQUEST = 50;
const GLOBAL_SOURCE_REGIONS = ['US', 'GB', 'IN', 'JP', 'DE', 'BR', 'AU'];

function getApiKey(): string {
  const key = process.env.YT_API_KEY;
  if (!key) {
    throw new Error('YT_API_KEY is not configured');
  }
  return key;
}

interface FetchMeta {
  endpoint: string;
  query: string;
}

interface YoutubeFetchOptions {
  signal?: AbortSignal;
  etagKey?: string;
  skipConditional?: boolean;
}

async function fetchWithBackoff(input: string, init: RequestInit, meta: FetchMeta, attempt = 1): Promise<Response> {
  const res = await fetch(input, init);
  if (res.ok || res.status === 304) {
    return res;
  }

  const data = (await res.json().catch(() => undefined)) as YouTubeErrorResponse | undefined;
  console.error('[youtube] request failed', {
    endpoint: meta.endpoint,
    params: meta.query,
    status: res.status,
    message: data?.error?.message
  });

  const quotaExceeded = data?.error?.errors?.some((err) => err.reason === 'quotaExceeded');
  if (quotaExceeded) {
    throw new Error('quota_exceeded');
  }

  if (res.status >= 500 && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    return fetchWithBackoff(input, init, meta, attempt + 1);
  }

  throw new Error(data?.error?.message ?? `YouTube API error: ${res.status}`);
}

interface RawCacheEntry<T> {
  data: T;
  etag?: string;
}

async function youtubeFetch<T>(endpoint: string, params: URLSearchParams, options: YoutubeFetchOptions = {}): Promise<T> {
  const { signal, etagKey, skipConditional = false } = options;
  const paramsWithKey = new URLSearchParams(params);
  paramsWithKey.set('key', getApiKey());
  const logParams = new URLSearchParams(paramsWithKey);
  logParams.delete('key');
  const url = `${API_BASE}/${endpoint}?${paramsWithKey.toString()}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const cache = etagKey ? getCache() : null;
  const rawCacheKey = etagKey ? `${RAW_CACHE_PREFIX}${etagKey}` : null;
  let cachedEntry: RawCacheEntry<T> | null = null;

  if (cache && rawCacheKey && !skipConditional) {
    cachedEntry = await cache.get<RawCacheEntry<T>>(rawCacheKey);
    if (cachedEntry?.etag) {
      headers['If-None-Match'] = cachedEntry.etag;
    }
  }

  recordDataApiCall(endpoint);
  const res = await fetchWithBackoff(url, { signal, headers }, { endpoint, query: logParams.toString() });

  if (res.status === 304) {
    if (cachedEntry?.data) {
      return cachedEntry.data;
    }
    if (cache && rawCacheKey && !skipConditional) {
      await cache.del(rawCacheKey);
      return youtubeFetch(endpoint, params, { signal, etagKey, skipConditional: true });
    }
    throw new Error('Received 304 response without cached payload');
  }

  const data = (await res.json()) as T;

  if (cache && rawCacheKey) {
    const entry: RawCacheEntry<T> = {
      data,
      etag: res.headers.get('etag') ?? undefined
    };
    await cache.set(rawCacheKey, entry, RAW_CACHE_TTL_SECONDS);
  }

  return data;
}

function mapVideo(item: YouTubeVideoListItem): NormalizedVideo {
  const durationSec = parseISO8601DurationToSeconds(item.contentDetails.duration);
  const thumbnails = item.snippet.thumbnails ?? {};
  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnails,
    durationSec,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    viewCount: Number(item.statistics?.viewCount ?? 0),
    likeCount: item.statistics?.likeCount ? Number(item.statistics.likeCount) : null,
    channelId: item.snippet.channelId,
    channelAvatarUrl: undefined
  };
}

function chunkArray<T>(input: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < input.length; index += chunkSize) {
    chunks.push(input.slice(index, index + chunkSize));
  }
  return chunks;
}

async function getVideosByIds(ids: string[]): Promise<NormalizedVideo[]> {
  if (ids.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(new Set(ids));
  const cache = getCache();
  const results: Map<string, NormalizedVideo> = new Map();
  const missing: string[] = [];

  for (const id of uniqueIds) {
    const cached = await cache.get<NormalizedVideo>(`${VIDEO_CACHE_PREFIX}${id}`);
    if (cached) {
      results.set(id, cached);
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    for (const chunk of chunkArray(missing, MAX_VIDEO_IDS_PER_REQUEST)) {
      const params = new URLSearchParams({
        part: 'contentDetails,snippet,statistics',
        id: chunk.join(',')
      });
      const etagKey = `videos:${chunk.slice().sort().join(',')}`;
      const data = await youtubeFetch<YouTubeVideoListResponse>('videos', params, { etagKey });
      for (const item of data.items ?? []) {
        const mapped = mapVideo(item);
        results.set(mapped.id, mapped);
        await cache.set(`${VIDEO_CACHE_PREFIX}${mapped.id}`, mapped, VIDEO_CACHE_TTL_SECONDS);
      }
    }
  }

  const videos = uniqueIds
    .map((id) => results.get(id))
    .filter((video): video is NormalizedVideo => Boolean(video));

  await populateChannelAvatars(videos);

  return videos;
}

interface ChannelInfo {
  id: string;
  title: string;
  thumbnailUrl?: string;
}

async function getChannelInfos(ids: string[]): Promise<Map<string, ChannelInfo>> {
  const cache = getCache();
  const uniqueIds = Array.from(new Set(ids));
  const results = new Map<string, ChannelInfo>();
  const missing: string[] = [];

  for (const id of uniqueIds) {
    const cached = await cache.get<ChannelInfo>(`${CHANNEL_CACHE_PREFIX}${id}`);
    if (cached) {
      results.set(id, cached);
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    for (const chunk of chunkArray(missing, MAX_CHANNEL_IDS_PER_REQUEST)) {
      const params = new URLSearchParams({
        part: 'snippet',
        id: chunk.join(',')
      });
      const etagKey = `channels:${chunk.slice().sort().join(',')}`;
      const data = await youtubeFetch<YouTubeChannelListResponse>('channels', params, { etagKey });
      for (const item of data.items ?? []) {
        const thumbnail = item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url;
        const info: ChannelInfo = {
          id: item.id,
          title: item.snippet.title,
          thumbnailUrl: thumbnail
        };
        results.set(item.id, info);
        await cache.set(`${CHANNEL_CACHE_PREFIX}${item.id}`, info, CHANNEL_CACHE_TTL_SECONDS);
      }
    }
  }

  return results;
}

async function populateChannelAvatars(videos: NormalizedVideo[]): Promise<void> {
  const channelIds = Array.from(new Set(videos.map((video) => video.channelId)));
  if (channelIds.length === 0) {
    return;
  }
  const channelInfos = await getChannelInfos(channelIds);
  for (const video of videos) {
    const channel = channelInfos.get(video.channelId);
    if (channel?.thumbnailUrl) {
      video.channelAvatarUrl = channel.thumbnailUrl;
    }
  }
}

async function getChannelUploadsPlaylists(channelIds: string[]): Promise<Map<string, string>> {
  const sorted = Array.from(new Set(channelIds)).sort();
  const cacheKey = `${EDUCATION_UPLOADS_CACHE_KEY}:${sorted.join(',')}`;
  const cache = getCache();
  const cached = await cache.get<Record<string, string>>(cacheKey);
  if (cached) {
    return new Map(Object.entries(cached));
  }

  const uploadsMap = new Map<string, string>();
  for (const chunk of chunkArray(channelIds, MAX_CHANNEL_IDS_PER_REQUEST)) {
    const params = new URLSearchParams({
      part: 'contentDetails',
      id: chunk.join(',')
    });
    const data = await youtubeFetch<YouTubeChannelContentDetailsResponse>('channels', params, {
      etagKey: `channels:contentDetails:${chunk.slice().sort().join(',')}`
    });

    for (const item of data.items ?? []) {
      const uploads = item.contentDetails?.relatedPlaylists?.uploads;
      if (uploads) {
        uploadsMap.set(item.id, uploads);
      }
    }
  }

  await cache.set(cacheKey, Object.fromEntries(uploadsMap.entries()), EDUCATION_UPLOADS_TTL_SECONDS);
  return uploadsMap;
}

async function fetchPlaylistVideoIds(playlistId: string, limit: number): Promise<string[]> {
  const params = new URLSearchParams({
    part: 'contentDetails',
    playlistId,
    maxResults: String(Math.min(limit, 50))
  });
  const data = await youtubeFetch<YouTubePlaylistItemsResponse>('playlistItems', params, {
    etagKey: `playlist:${playlistId}:first`,
    skipConditional: false
  });
  const ids: string[] = [];
  for (const item of data.items ?? []) {
    const videoId = item.contentDetails?.videoId;
    if (videoId) {
      ids.push(videoId);
      if (ids.length >= limit) {
        break;
      }
    }
  }
  return ids;
}

async function buildCuratedEducationCatalog(): Promise<NormalizedVideo[]> {
  const channelIds = Array.from(new Set(EDUCATION_CHANNEL_IDS)).filter(Boolean);
  if (channelIds.length === 0) {
    return [];
  }

  const uploadsMap = await getChannelUploadsPlaylists(channelIds);
  const videoIdSet = new Set<string>();

  for (const playlistId of uploadsMap.values()) {
    try {
      const playlistVideoIds = await fetchPlaylistVideoIds(playlistId, 15);
      for (const id of playlistVideoIds) {
        videoIdSet.add(id);
        if (videoIdSet.size >= 500) {
          break;
        }
      }
      if (videoIdSet.size >= 500) {
        break;
      }
    } catch (error) {
      debugLog('EDUCATION', {
        event: 'PLAYLIST_FETCH_ERROR',
        playlistId,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  if (videoIdSet.size === 0) {
    return [];
  }

  const videos = await getVideosByIds(Array.from(videoIdSet));
  await populateChannelAvatars(videos);
  videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return videos;
}

function decodeCursor(token?: string | null): number {
  if (!token) return 0;
  const parsed = Number(token);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function encodeCursor(offset: number): string {
  return String(offset);
}

interface CuratedEducationOptions {
  pageToken?: string;
  targetSize: number;
  minDurationSeconds: number;
}

export async function getCuratedEducationVideos(options: CuratedEducationOptions) {
  const catalog = await getCached(
    EDUCATION_CURATED_CACHE_KEY,
    async () => {
      try {
        return await buildCuratedEducationCatalog();
      } catch (error) {
        debugLog('EDUCATION', {
          event: 'CATALOG_ERROR',
          error: error instanceof Error ? error.message : error
        });
        throw error;
      }
    },
    EDUCATION_CURATED_TTL_SECONDS
  );

  const filtered = catalog
    .filter((video) => video.durationSec > Math.max(MIN_SHORTS_THRESHOLD, options.minDurationSeconds))
    .filter((video, index, array) => array.findIndex((item) => item.id === video.id) === index);

  const start = decodeCursor(options.pageToken);
  const end = Math.min(filtered.length, start + options.targetSize);
  const items = filtered.slice(start, end);
  const nextPageToken = end < filtered.length ? encodeCursor(end) : null;

  return {
    items,
    nextPageToken,
    totalAvailable: filtered.length
  };
}

export async function getVideoById(id: string): Promise<NormalizedVideo | null> {
  const videos = await getVideosByIds([id]);
  return videos[0] ?? null;
}

interface SearchOptions {
  pageToken?: string;
  regionCode?: string;
  targetSize?: number;
  minDurationSeconds?: number;
}

export async function searchVideos(query: string, options: SearchOptions = {}) {
  const targetSize = Math.max(1, options.targetSize ?? DEFAULT_PAGE_SIZE);
  const threshold = Math.max(MIN_SHORTS_THRESHOLD, options.minDurationSeconds ?? MIN_SHORTS_THRESHOLD);
  const aggregated: NormalizedVideo[] = [];
  const seen = new Set<string>();
  let pageToken = options.pageToken;
  let nextTokenForReturn: string | null = null;

  for (let iteration = 0; iteration < MAX_API_PAGE_FETCHES && aggregated.length < targetSize; iteration += 1) {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      q: query,
      maxResults: String(MAX_SEARCH_RESULTS_PER_CALL),
      videoEmbeddable: 'true',
      safeSearch: 'none'
    });
    if (pageToken) params.set('pageToken', pageToken);
    if (options.regionCode) params.set('regionCode', options.regionCode);

    const etagKey = `search:${params.toString()}`;
    const searchData = await youtubeFetch<YouTubeSearchResponse>('search', params, { etagKey });
    const videoIds = (searchData.items ?? [])
      .map((item) => item.id?.videoId as string | undefined)
      .filter((value): value is string => Boolean(value));

    const videos = await getVideosByIds(videoIds);
    const videoMap = new Map(videos.map((video) => [video.id, video]));

    for (const videoId of videoIds) {
      if (aggregated.length >= targetSize) {
        break;
      }
      const video = videoMap.get(videoId);
      if (!video) continue;
      if (video.durationSec < threshold) continue;
      if (seen.has(video.id)) continue;
      aggregated.push(video);
      seen.add(video.id);
    }

    nextTokenForReturn = searchData.nextPageToken ?? null;
    pageToken = nextTokenForReturn ?? undefined;
    if (!nextTokenForReturn) {
      break;
    }
  }

  return {
    items: aggregated.slice(0, targetSize),
    nextPageToken: nextTokenForReturn
  };
}

interface PopularOptions {
  pageToken?: string;
  targetSize?: number;
  minDurationSeconds?: number;
  categoryId?: string;
}

export async function getMostPopularVideos(regionCode = 'US', options: PopularOptions = {}) {
  const targetSize = Math.max(1, options.targetSize ?? DEFAULT_PAGE_SIZE);
  const threshold = Math.max(MIN_SHORTS_THRESHOLD, options.minDurationSeconds ?? MIN_SHORTS_THRESHOLD);
  const aggregated: NormalizedVideo[] = [];
  const seen = new Set<string>();
  let pageToken = options.pageToken;
  let nextTokenForReturn: string | null = null;

  for (let iteration = 0; iteration < MAX_API_PAGE_FETCHES && aggregated.length < targetSize; iteration += 1) {
    const params = new URLSearchParams({
      part: 'contentDetails,snippet,statistics',
      chart: 'mostPopular',
      maxResults: String(MAX_SEARCH_RESULTS_PER_CALL),
      regionCode
    });
    if (pageToken) params.set('pageToken', pageToken);
    if (options.categoryId) params.set('videoCategoryId', options.categoryId);

    const etagKey = `popular:${regionCode}:${options.categoryId ?? 'all'}:${params.get('pageToken') ?? ''}`;
    const data = await youtubeFetch<YouTubeVideoListResponse>('videos', params, { etagKey });

    for (const item of data.items ?? []) {
      if (aggregated.length >= targetSize) {
        break;
      }
      const video = mapVideo(item);
      if (video.durationSec < threshold) continue;
      if (seen.has(video.id)) continue;
      aggregated.push(video);
      seen.add(video.id);
    }

    nextTokenForReturn = data.nextPageToken ?? null;
    pageToken = nextTokenForReturn ?? undefined;
    if (!nextTokenForReturn) {
      break;
    }
  }

  if (aggregated.length < targetSize && options.categoryId) {
    debugLog('POPULAR', {
      event: 'CATEGORY_FALLBACK_REGION',
      regionCode,
      categoryId: options.categoryId,
      collected: aggregated.length,
      targetSize
    });
    const fallback = await getMostPopularVideos(regionCode, {
      targetSize,
      minDurationSeconds: options.minDurationSeconds,
      pageToken: undefined
    });
    for (const video of fallback.items) {
      if (seen.has(video.id)) continue;
      aggregated.push(video);
      seen.add(video.id);
      if (aggregated.length >= targetSize) break;
    }
  }

  await populateChannelAvatars(aggregated);

  return {
    items: aggregated.slice(0, targetSize),
    nextPageToken: nextTokenForReturn
  };
}

export async function getGlobalMostPopular(options: {
  targetSize: number;
  minDurationSeconds: number;
  categoryTitle?: string;
  categoryId?: string;
}) {
  const targetSize = Math.max(1, options.targetSize);
  const aggregated: NormalizedVideo[] = [];
  const seen = new Set<string>();

  for (const region of GLOBAL_SOURCE_REGIONS) {
    let categoryId = options.categoryId;
    if (!categoryId && options.categoryTitle) {
      const resolved = await getVideoCategoryIdByTitle(region, options.categoryTitle);
      if (!resolved) {
        debugLog('CATEGORY', {
          event: 'MISSING_FOR_REGION',
          regionCode: region,
          categoryTitle: options.categoryTitle
        });
      } else {
        categoryId = resolved;
      }
    }

    const response = await getMostPopularVideos(region, {
      targetSize,
      minDurationSeconds: options.minDurationSeconds,
      categoryId
    });

    for (const video of response.items) {
      if (seen.has(video.id)) {
        continue;
      }
      aggregated.push(video);
      seen.add(video.id);
      if (aggregated.length >= targetSize) {
        return {
          items: aggregated.slice(0, targetSize),
          nextPageToken: null
        };
      }
    }
  }

  if (aggregated.length < targetSize && (options.categoryId || options.categoryTitle)) {
    debugLog('POPULAR', {
      event: 'GLOBAL_FALLBACK_ALL',
      requestedCategory: options.categoryTitle ?? options.categoryId,
      collected: aggregated.length
    });
    const fallback = await getGlobalMostPopular({
      targetSize,
      minDurationSeconds: options.minDurationSeconds
    });
    for (const video of fallback.items) {
      if (seen.has(video.id)) continue;
      aggregated.push(video);
      seen.add(video.id);
      if (aggregated.length >= targetSize) break;
    }
  }

  return {
    items: aggregated.slice(0, targetSize),
    nextPageToken: null
  };
}

interface RelatedOptions {
  pageToken?: string;
  targetSize?: number;
  minDurationSeconds?: number;
}

export async function getRelatedVideos(videoId: string, options: RelatedOptions = {}) {
  if (!videoId) {
    return { items: [], nextPageToken: null };
  }

  const targetSize = Math.max(1, options.targetSize ?? DEFAULT_PAGE_SIZE);
  const threshold = Math.max(MIN_SHORTS_THRESHOLD, options.minDurationSeconds ?? MIN_SHORTS_THRESHOLD);
  const aggregated: NormalizedVideo[] = [];
  const seen = new Set<string>();
  let pageToken = options.pageToken;
  let nextTokenForReturn: string | null = null;

  try {
    for (let iteration = 0; iteration < MAX_API_PAGE_FETCHES && aggregated.length < targetSize; iteration += 1) {
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        relatedToVideoId: videoId,
        maxResults: String(MAX_SEARCH_RESULTS_PER_CALL),
        videoEmbeddable: 'true'
      });
      if (pageToken) params.set('pageToken', pageToken);

      const etagKey = `related:${videoId}:${params.get('pageToken') ?? ''}`;
      const searchData = await youtubeFetch<YouTubeSearchResponse>('search', params, { etagKey });
      const videoIds = (searchData.items ?? [])
        .map((item) => item.id?.videoId as string | undefined)
        .filter((value): value is string => Boolean(value));

      const videos = await getVideosByIds(videoIds);
      const videoMap = new Map(videos.map((video) => [video.id, video]));

      for (const candidateId of videoIds) {
        if (aggregated.length >= targetSize) {
          break;
        }
        const video = videoMap.get(candidateId);
        if (!video) continue;
        if (video.durationSec < threshold) continue;
        if (seen.has(video.id)) continue;
        aggregated.push(video);
        seen.add(video.id);
      }

      nextTokenForReturn = searchData.nextPageToken ?? null;
      pageToken = nextTokenForReturn ?? undefined;
      if (!nextTokenForReturn) {
        break;
      }
    }
  } catch (error) {
    console.error('[youtube] falling back to most popular', {
      videoId,
      pageToken,
      error: error instanceof Error ? error.message : error
    });
    recordQuotaCoolingEvent();
    try {
      const fallback = await getMostPopularVideos('US', { targetSize });
      return { items: fallback.items, nextPageToken: fallback.nextPageToken };
    } catch (fallbackError) {
      console.error('[youtube] fallback failed', fallbackError);
      return { items: [], nextPageToken: null };
    }
  }

  return {
    items: aggregated.slice(0, targetSize),
    nextPageToken: nextTokenForReturn
  };
}

const inflightCache = new Map<string, Promise<unknown>>();

export async function getCached<T>(key: string, loader: () => Promise<T>, ttlSeconds = CACHE_TTL_SECONDS): Promise<T> {
  const cache = getCache();
  const cached = await cache.get<T>(key);
  if (cached) {
    recordCacheHit();
    debugLog('CACHE', { event: 'HIT', key });
    return cached;
  }

  recordCacheMiss();
  debugLog('CACHE', { event: 'MISS', key });

  const pending = inflightCache.get(key) as Promise<T> | undefined;
  if (pending) {
    recordCacheJoin();
    debugLog('CACHE', { event: 'JOIN', key });
    return pending;
  }

  const task = (async () => {
    try {
      const result = await loader();
      await cache.set(key, result, ttlSeconds);
      recordCacheStore();
      debugLog('CACHE', { event: 'STORE', key });
      return result;
    } catch (error) {
      recordCacheError();
      debugLog('CACHE', {
        event: 'ERROR',
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      inflightCache.delete(key);
    }
  })();

  inflightCache.set(key, task);
  return task;
}

function slugifyCategoryTitle(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export async function getVideoCategoryIdByTitle(regionCode: string, title: string): Promise<string | null> {
  if (!title) {
    return null;
  }
  const normalizedRegion = regionCode.toUpperCase();
  const slug = slugifyCategoryTitle(title);
  const cacheKey = `${CATEGORY_CACHE_PREFIX}${normalizedRegion}:${slug}`;
  const cache = getCache();

  const cached = await cache.get<string | null>(cacheKey);
  if (cached === CATEGORY_CACHE_NONE) {
    return null;
  }
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    part: 'snippet',
    regionCode: normalizedRegion
  });

  const data = await youtubeFetch<YouTubeVideoCategoryListResponse>('videoCategories', params, {
    etagKey: `categories:${normalizedRegion}`
  });

  const normalizedTitle = title.trim().toLowerCase();
  const match = data.items?.find(
    (item) =>
      item.snippet?.title?.toLowerCase() === normalizedTitle && (item.snippet?.assignable ?? true)
  );
  const result = match?.id ?? null;

  await cache.set(cacheKey, result ?? CATEGORY_CACHE_NONE, CATEGORY_CACHE_TTL_SECONDS);

  if (result) {
    debugLog('CATEGORY', {
      event: 'RESOLVED',
      regionCode: normalizedRegion,
      categoryTitle: title,
      categoryId: result
    });
  } else {
    debugLog('CATEGORY', {
      event: 'NOT_FOUND',
      regionCode: normalizedRegion,
      categoryTitle: title
    });
  }

  return result;
}

export interface RegionInfo {
  code: string;
  name: string;
}

export async function getI18nRegions(): Promise<RegionInfo[]> {
  const cache = getCache();
  const cached = await cache.get<RegionInfo[]>(REGIONS_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    part: 'snippet'
  });

  const data = await youtubeFetch<YouTubeI18nRegionsResponse>('i18nRegions', params, { etagKey: 'i18nRegions' });
  const regions = (data.items ?? [])
    .map((item) => ({ code: item.id, name: item.snippet?.name ?? item.id }))
    .filter((item): item is RegionInfo => Boolean(item.code))
    .sort((a, b) => a.name.localeCompare(b.name));

  await cache.set(REGIONS_CACHE_KEY, regions, REGIONS_CACHE_TTL_SECONDS);
  return regions;
}

export { CACHE_TTL_SECONDS };
