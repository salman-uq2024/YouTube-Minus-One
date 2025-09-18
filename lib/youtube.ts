'use server';

import { getCache } from './cache';
import { filterOutShorts, parseISO8601DurationToSeconds } from './duration';

export interface NormalizedVideo {
  id: string;
  title: string;
  description: string;
  thumbnails: Record<string, { url: string; width?: number; height?: number }>;
  durationSec: number;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
}

interface YouTubeErrorResponse {
  error: {
    code: number;
    message: string;
    errors?: Array<{ reason?: string }>;
  };
}

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const CACHE_TTL_SECONDS = 60 * 60 * 6; // 6 hours

function getApiKey(): string {
  const key = process.env.YT_API_KEY;
  if (!key) {
    throw new Error('YT_API_KEY is not configured');
  }
  return key;
}

async function fetchWithBackoff<T>(input: string, init: RequestInit, attempt = 1): Promise<T> {
  const res = await fetch(input, init);
  if (res.ok) {
    return (await res.json()) as T;
  }
  const data = (await res.json().catch(() => undefined)) as YouTubeErrorResponse | undefined;
  const quotaExceeded = data?.error?.errors?.some((err) => err.reason === 'quotaExceeded');
  if (quotaExceeded) {
    throw new Error('quota_exceeded');
  }
  if (res.status >= 500 && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    return fetchWithBackoff<T>(input, init, attempt + 1);
  }
  throw new Error(data?.error?.message ?? `YouTube API error: ${res.status}`);
}

async function youtubeFetch<T>(endpoint: string, params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  params.set('key', getApiKey());
  const url = `${API_BASE}/${endpoint}?${params.toString()}`;
  return fetchWithBackoff<T>(url, { signal, headers: { Accept: 'application/json' } });
}

function mapVideo(item: any): NormalizedVideo {
  const durationSec = parseISO8601DurationToSeconds(item.contentDetails.duration);
  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnails: item.snippet.thumbnails ?? {},
    durationSec,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    viewCount: Number(item.statistics?.viewCount ?? 0)
  };
}

async function getVideosByIds(ids: string[]): Promise<NormalizedVideo[]> {
  if (ids.length === 0) {
    return [];
  }
  const params = new URLSearchParams({
    part: 'contentDetails,snippet,statistics',
    id: ids.join(','),
    maxResults: '50'
  });
  const data = await youtubeFetch<any>('videos', params);
  return data.items.map(mapVideo);
}

export async function getVideoById(id: string): Promise<NormalizedVideo | null> {
  const videos = await getVideosByIds([id]);
  return videos[0] ?? null;
}

export async function searchVideos(query: string, options: { pageToken?: string; regionCode?: string; maxResults?: number } = {}) {
  const maxResults = options.maxResults ?? 25;
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: String(maxResults),
    videoEmbeddable: 'true',
    safeSearch: 'none'
  });
  if (options.pageToken) params.set('pageToken', options.pageToken);
  if (options.regionCode) params.set('regionCode', options.regionCode);

  const searchData = await youtubeFetch<any>('search', params);
  const videoIds = searchData.items.map((item: any) => item.id.videoId).filter(Boolean);
  const videos = await getVideosByIds(videoIds);
  const filtered = filterOutShorts(videos);
  return {
    items: filtered,
    nextPageToken: searchData.nextPageToken ?? null
  };
}

export async function getMostPopularVideos(regionCode = 'US', pageToken?: string) {
  const params = new URLSearchParams({
    part: 'contentDetails,snippet,statistics',
    chart: 'mostPopular',
    maxResults: '25',
    regionCode
  });
  if (pageToken) params.set('pageToken', pageToken);
  const data = await youtubeFetch<any>('videos', params);
  const mapped = data.items.map(mapVideo);
  const filtered = filterOutShorts(mapped);
  return {
    items: filtered,
    nextPageToken: data.nextPageToken ?? null
  };
}

export async function getRelatedVideos(videoId: string, pageToken?: string) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    relatedToVideoId: videoId,
    maxResults: '25',
    videoEmbeddable: 'true'
  });
  if (pageToken) params.set('pageToken', pageToken);
  const searchData = await youtubeFetch<any>('search', params);
  const videoIds = searchData.items.map((item: any) => item.id.videoId).filter(Boolean);
  const videos = await getVideosByIds(videoIds);
  const filtered = filterOutShorts(videos);
  return {
    items: filtered,
    nextPageToken: searchData.nextPageToken ?? null
  };
}

export async function getCached<T>(key: string, loader: () => Promise<T>, ttlSeconds = CACHE_TTL_SECONDS): Promise<T> {
  const cache = getCache();
  const cached = await cache.get<T>(key);
  if (cached) {
    return cached;
  }
  const result = await loader();
  await cache.set(key, result, ttlSeconds);
  return result;
}

export { CACHE_TTL_SECONDS };
