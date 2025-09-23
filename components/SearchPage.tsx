'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SearchBar } from './SearchBar';
import { VideoGrid } from './VideoGrid';
import { Paginator } from './Paginator';
import { ErrorState } from './ErrorState';
import { SettingsDrawer, type SettingsState } from './SettingsDrawer';
import type { NormalizedVideo } from '@/lib/youtube';

interface SearchResponse {
  items: NormalizedVideo[];
  nextPageToken: string | null;
  error?: string;
  meta?: {
    categoryFallback?: boolean;
    categoryFallbackReason?: string | null;
    categoryTitle?: string | null;
    categoryId?: string | null;
    regionCode?: string;
    source?: 'category' | 'curated';
    totalAvailable?: number;
  };
}

interface CategoryTab {
  id: string;
  label: string;
  videoCategoryId?: string;
  categoryTitle?: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  region: 'US',
  language: 'en',
  minDurationMinutes: 1
};

const PAGE_SIZE = 24;
const BASE_CATEGORY_TABS: CategoryTab[] = [
  { id: 'all', label: 'Top' },
  { id: 'music', label: 'Music', videoCategoryId: '10' },
  { id: 'gaming', label: 'Gaming', videoCategoryId: '20' },
  { id: 'news', label: 'News', videoCategoryId: '25' },
  { id: 'sports', label: 'Sports', videoCategoryId: '17' },
  { id: 'entertainment', label: 'Entertainment', videoCategoryId: '24' },
  { id: 'education', label: 'Education', categoryTitle: 'Education' },
  { id: 'science', label: 'Science & Tech', videoCategoryId: '28' },
  { id: 'howto', label: 'How-to & Style', videoCategoryId: '26' },
  { id: 'people', label: 'People & Blogs', videoCategoryId: '22' }
];

const EDUCATION_FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_EDUCATION !== 'false';
const CATEGORY_TABS: CategoryTab[] = EDUCATION_FEATURE_ENABLED
  ? BASE_CATEGORY_TABS
  : BASE_CATEGORY_TABS.filter((tab) => tab.id !== 'education');

interface PopularCacheEntry {
  videos: NormalizedVideo[];
  nextToken: string | null;
  error: string | null;
  meta?: SearchResponse['meta'];
  timestamp: number;
}

const CLIENT_CACHE_STALE_MS = 10 * 60 * 1000;

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function getCategorySignature(tab: CategoryTab): string {
  if (tab.videoCategoryId) {
    return `id:${tab.videoCategoryId}`;
  }
  if (tab.categoryTitle) {
    return `title:${slugify(tab.categoryTitle)}`;
  }
  return 'all';
}

function getCategoryTab(tabId: string): CategoryTab {
  return CATEGORY_TABS.find((item) => item.id === tabId) ?? CATEGORY_TABS[0];
}

function formatRegionLabel(code: string): string {
  if (code.toUpperCase() === 'GLOBAL') {
    return 'Global (beta)';
  }
  return code.toUpperCase();
}

const fetcher = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {})
    }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { error: data.error ?? 'server_error', items: [], nextPageToken: null } satisfies SearchResponse;
  }
  return (await res.json()) as SearchResponse;
};

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [videos, setVideos] = useState<NormalizedVideo[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isBootstrapped, setIsBootstrapped] = useState(false);

  const [popularVideos, setPopularVideos] = useState<NormalizedVideo[]>([]);
  const [popularNextToken, setPopularNextToken] = useState<string | null>(null);
  const [popularError, setPopularError] = useState<string | null>(null);
  const [popularNotice, setPopularNotice] = useState<string | null>(null);
  const [popularMeta, setPopularMeta] = useState<SearchResponse['meta'] | undefined>();
  const [isPopularLoading, setIsPopularLoading] = useState(true);
  const [isPopularLoadingMore, setIsPopularLoadingMore] = useState(false);
  const popularRequestRef = useRef(0);
  const loadSignatureRef = useRef<string | null>(null);
  const popularCacheRef = useRef<Map<string, PopularCacheEntry>>(new Map());
  const [activeCategoryId, setActiveCategoryId] = useState<string>(CATEGORY_TABS[0].id);

  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem('ym1-settings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings) as SettingsState;
        const region = parsed.region ? String(parsed.region).toUpperCase() : DEFAULT_SETTINGS.region;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed, region });
      }
      const storedSearches = localStorage.getItem('ym1-recent');
      if (storedSearches) {
        setRecentSearches(JSON.parse(storedSearches));
      }
    } catch (err) {
      console.error('Failed to read local settings', err);
    } finally {
      setIsBootstrapped(true);
    }
  }, []);

  useEffect(() => {
    if (!isBootstrapped) return;
    try {
      localStorage.setItem('ym1-settings', JSON.stringify(settings));
    } catch (err) {
      console.error('Failed to persist settings', err);
    }
  }, [isBootstrapped, settings]);

  const minDurationSeconds = useMemo(
    () => Math.max(60, settings.minDurationMinutes * 60),
    [settings.minDurationMinutes]
  );

  const createSignature = useCallback(
    (categorySignature: string) => `${settings.region}:${minDurationSeconds}:${categorySignature}`,
    [settings.region, minDurationSeconds]
  );

  const applyPopularEntry = useCallback(
    (entry: PopularCacheEntry | undefined) => {
      if (!entry) return;
      setPopularVideos(entry.videos);
      setPopularNextToken(entry.nextToken);
      setPopularError(entry.error);
      setPopularMeta(entry.meta);

      if (entry.meta?.source === 'curated') {
        setPopularNotice('Curated education picks from trusted channels.');
      } else if (entry.meta?.categoryFallback) {
        const regionLabel = formatRegionLabel(entry.meta.regionCode ?? settings.region);
        const title = entry.meta.categoryTitle ?? 'this category';
        setPopularNotice(`Showing top videos because ${title} is unavailable in ${regionLabel}.`);
      } else {
        setPopularNotice(null);
      }
    },
    [settings.region]
  );

  const loadPopular = useCallback(
    async (mode: 'reset' | 'append', categoryId: string) => {
      const tab = getCategoryTab(categoryId);
      const categorySignature = getCategorySignature(tab);
      const signature = createSignature(categorySignature);
      const currentEntry = popularCacheRef.current.get(signature);

      if (mode === 'append') {
        if (!currentEntry?.nextToken) {
          setIsPopularLoadingMore(false);
          return;
        }
      }

      if (mode === 'reset') {
        if (currentEntry) {
          applyPopularEntry(currentEntry);
          setIsPopularLoading(false);
          setIsPopularLoadingMore(false);
          if (Date.now() - currentEntry.timestamp < CLIENT_CACHE_STALE_MS) {
            return;
          }
        } else {
          setIsPopularLoading(true);
          setPopularVideos([]);
          setPopularNextToken(null);
          setPopularError(null);
          setPopularNotice(null);
          setPopularMeta(undefined);
        }
      } else {
        setIsPopularLoadingMore(true);
      }

      const params = new URLSearchParams({
        pageSize: String(PAGE_SIZE),
        minDurationSeconds: String(minDurationSeconds)
      });

      const pageToken = mode === 'append' ? currentEntry?.nextToken ?? null : null;
      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      let endpoint = '/api/mostPopular';
      params.set('regionCode', settings.region);

      if (tab.id === 'education') {
        endpoint = '/api/education';
      } else {
        if (tab.videoCategoryId) {
          params.set('videoCategoryId', tab.videoCategoryId);
        }
        if (tab.categoryTitle) {
          params.set('categoryTitle', tab.categoryTitle);
        }
        params.set('categoryKey', tab.id);
      }

      const requestId = (popularRequestRef.current += 1);

      try {
        const response = await fetcher(`${endpoint}?${params.toString()}`);
        if (requestId !== popularRequestRef.current) {
          return;
        }

        setIsPopularLoading(false);
        setIsPopularLoadingMore(false);

        if (response.error && response.items.length === 0) {
          setPopularError(response.error);
          setPopularMeta(response.meta);
          return;
        }

        const filtered = filterBySettings(response.items, settings.minDurationMinutes);
        const baseVideos = mode === 'append' ? currentEntry?.videos ?? [] : [];
        const combined = mergeVideos(baseVideos, filtered, mode === 'append');

        const entry: PopularCacheEntry = {
          videos: combined,
          nextToken: response.nextPageToken,
          error: response.error ?? null,
          meta: response.meta,
          timestamp: Date.now()
        };
        popularCacheRef.current.set(signature, entry);
        applyPopularEntry(entry);
      } catch (err) {
        if (requestId !== popularRequestRef.current) {
          return;
        }
        console.error('Failed to load popular videos', err);
        setIsPopularLoading(false);
        setIsPopularLoadingMore(false);
        setPopularError('server_error');
        setPopularMeta(undefined);
        setPopularNotice(null);
        loadSignatureRef.current = null;
      }
    },
    [applyPopularEntry, createSignature, minDurationSeconds, settings.region, settings.minDurationMinutes]
  );

  useEffect(() => {
    if (!isBootstrapped) return;
    const tab = CATEGORY_TABS.find((item) => item.id === activeCategoryId) ?? CATEGORY_TABS[0];
    const categorySignature = getCategorySignature(tab);
    const signature = createSignature(categorySignature);
    const cached = popularCacheRef.current.get(signature);
    if (cached) {
      applyPopularEntry(cached);
      setIsPopularLoading(false);
      setIsPopularLoadingMore(false);
    }
    const isFresh = cached ? Date.now() - cached.timestamp < CLIENT_CACHE_STALE_MS : false;
    if (loadSignatureRef.current === signature && isFresh) {
      return;
    }
    loadSignatureRef.current = signature;
    void loadPopular('reset', tab.id);
  }, [activeCategoryId, applyPopularEntry, createSignature, isBootstrapped, loadPopular, settings.region]);

  const updateRecentSearches = (term: string) => {
    setRecentSearches((prev) => {
      const next = [term, ...prev.filter((item) => item !== term)].slice(0, 6);
      localStorage.setItem('ym1-recent', JSON.stringify(next));
      return next;
    });
  };

  const handleSearch = useCallback(
    async (term: string) => {
      setQuery(term);
      setError(null);
      setWarning(null);
      setVideos([]);
      setNextPageToken(null);
      updateRecentSearches(term);
      const body = JSON.stringify({
        query: term,
        regionCode: settings.region,
        pageSize: PAGE_SIZE,
        minDurationSeconds
      });
      const response = await fetcher('/api/search', {
        method: 'POST',
        body
      });
      if (response.error) {
        if (response.error === 'quota_exceeded' && response.items.length > 0) {
          setWarning(response.error);
          setVideos(filterBySettings(response.items, settings.minDurationMinutes));
          setNextPageToken(response.nextPageToken);
          return;
        }
        setError(response.error);
        return;
      }
      setVideos(filterBySettings(response.items, settings.minDurationMinutes));
      setNextPageToken(response.nextPageToken);
    },
    [minDurationSeconds, settings.minDurationMinutes, settings.region]
  );

  const handleLoadMore = useCallback(async () => {
    if (!nextPageToken || !query) return;
    setIsLoadingMore(true);
    setWarning(null);
    const response = await fetcher('/api/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        pageToken: nextPageToken,
        regionCode: settings.region,
        pageSize: PAGE_SIZE,
        minDurationSeconds
      })
    });
    setIsLoadingMore(false);
    if (response.error) {
      if (response.error === 'quota_exceeded' && response.items.length > 0) {
        setWarning(response.error);
        setVideos((prev) => mergeVideos(prev, filterBySettings(response.items, settings.minDurationMinutes), true));
        setNextPageToken(response.nextPageToken);
        return;
      }
      setError(response.error);
      return;
    }
    setVideos((prev) => mergeVideos(prev, filterBySettings(response.items, settings.minDurationMinutes), true));
    setNextPageToken(response.nextPageToken);
  }, [minDurationSeconds, nextPageToken, query, settings.minDurationMinutes, settings.region]);

  const handleRetry = () => {
    if (query) {
      void handleSearch(query);
    } else {
      setError(null);
    }
  };

  const quotaMessage = getMessage(error);
  const warningMessage = getMessage(warning);
  const popularMessage = getMessage(popularError);
  const showPopularErrorState = Boolean(popularError) && popularVideos.length === 0;
  const activeCategory = CATEGORY_TABS.find((item) => item.id === activeCategoryId) ?? CATEGORY_TABS[0];
  const baseRegionLabel = formatRegionLabel(settings.region);
  const isCuratedFeed = activeCategory.id === 'education' && popularMeta?.source === 'curated';
  const displayRegionLabel = isCuratedFeed ? 'Global (beta)' : baseRegionLabel;
  const headingCategoryLabel = isCuratedFeed ? `${activeCategory.label} (Curated)` : activeCategory.label;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10">
      <section className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-lg md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/20">
            <Image src="/logo.svg" alt="YouTube Minus One logo" width={48} height={48} priority />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold sm:text-3xl">Long-form YouTube, minus the Shorts.</h1>
            <p className="text-sm text-white/70">
              Curated through the official YouTube Data API with strict duration filters and smart caching.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SearchBar onSearch={handleSearch} />
        <SettingsDrawer
          value={settings}
          onChange={(next) => {
            setSettings(next);
          }}
        />
      </div>

      <div className="sticky top-16 z-10 -mx-4 bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto">
          {CATEGORY_TABS.map((tab) => {
            const isActive = tab.id === activeCategoryId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveCategoryId(tab.id);
                  const categorySignature = getCategorySignature(tab);
                  const signature = createSignature(categorySignature);
                  const cached = popularCacheRef.current.get(signature);
                  if (cached) {
                    applyPopularEntry(cached);
                    setIsPopularLoading(false);
                  } else {
                    setPopularVideos([]);
                    setPopularNextToken(null);
                    setPopularError(null);
                    setPopularNotice(null);
                    setPopularMeta(undefined);
                    setIsPopularLoading(true);
                  }
                  setIsPopularLoadingMore(false);
                  loadSignatureRef.current = cached ? signature : null;
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-white text-black shadow' : 'bg-surface/70 text-white/70 hover:bg-surface'
                }`}
                aria-pressed={isActive}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {recentSearches.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
          <span className="text-white/80">Recent:</span>
          {recentSearches.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-full border border-white/20 px-3 py-1 hover:border-white/40"
              onClick={() => void handleSearch(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className="ml-auto text-xs text-white/50 hover:text-white"
            onClick={() => {
              localStorage.removeItem('ym1-recent');
              setRecentSearches([]);
            }}
          >
            Clear recent
          </button>
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Explore {headingCategoryLabel} in {displayRegionLabel}</h2>
        </div>
        {showPopularErrorState ? (
          <ErrorState
            title="Unable to load popular videos"
            description={popularMessage}
            onRetry={() => loadPopular('reset', activeCategory.id)}
          />
        ) : (
          <div className="space-y-4">
            {popularError && popularVideos.length > 0 ? (
              <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
                {popularMessage}
              </div>
            ) : null}
            {popularNotice ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
                {popularNotice}
              </div>
            ) : null}
            <VideoGrid videos={popularVideos} isLoading={isPopularLoading} loadingCount={PAGE_SIZE} />
            <Paginator
              onLoadMore={() => void loadPopular('append', activeCategory.id)}
              hasMore={Boolean(popularNextToken)}
              isLoading={isPopularLoadingMore}
            />
          </div>
        )}
      </section>

      {warningMessage ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
          {warningMessage}
        </div>
      ) : null}

      {error ? (
        <ErrorState title="Something went wrong" description={quotaMessage} onRetry={handleRetry} />
      ) : null}

      {query && !error ? (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">Search results for “{query}”</h2>
          {videos.length === 0 && !nextPageToken ? (
            <p className="text-sm text-white/60">No results matched your filters.</p>
          ) : (
            <>
              <VideoGrid videos={videos} />
              <Paginator onLoadMore={handleLoadMore} hasMore={Boolean(nextPageToken)} isLoading={isLoadingMore} />
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function filterBySettings(items: NormalizedVideo[], minDurationMinutes: number) {
  const threshold = Math.max(1, minDurationMinutes) * 60;
  return items.filter((item) => item.durationSec >= threshold);
}

function mergeVideos(
  existing: NormalizedVideo[],
  incoming: NormalizedVideo[],
  append: boolean
): NormalizedVideo[] {
  const base = append ? existing : [];
  const seen = new Set(base.map((video) => video.id));
  const merged = [...base];
  for (const video of incoming) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    merged.push(video);
  }
  return merged;
}

function getMessage(code: string | null) {
  if (!code) return '';
  switch (code) {
    case 'quota_exceeded':
      return 'YouTube Data API quota is temporarily exhausted. Showing cached recommendations where available.';
    case 'rate_limited':
      return 'Too many requests from this network. Please slow down and try again shortly.';
    default:
      return 'Something went wrong. Please retry in a moment.';
  }
}
