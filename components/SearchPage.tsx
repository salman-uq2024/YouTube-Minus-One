'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
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
}

const DEFAULT_SETTINGS: SettingsState = {
  region: 'US',
  language: 'en',
  minDurationMinutes: 1
};

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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [popularRegion, setPopularRegion] = useState(DEFAULT_SETTINGS.region);

  const { data: popularData, mutate: mutatePopular } = useSWR<SearchResponse>(
    `/api/mostPopular?regionCode=${popularRegion}`,
    (url) => fetcher(url),
    { revalidateOnFocus: false }
  );

  const filteredPopular = useMemo(() => {
    const thresholdSeconds = settings.minDurationMinutes * 60;
    if (!popularData?.items) return [];
    return popularData.items.filter((item) => item.durationSec >= thresholdSeconds);
  }, [popularData, settings.minDurationMinutes]);

  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem('ym1-settings');
      if (storedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) });
      }
      const storedSearches = localStorage.getItem('ym1-recent');
      if (storedSearches) {
        setRecentSearches(JSON.parse(storedSearches));
      }
    } catch (err) {
      console.error('Failed to read local settings', err);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ym1-settings', JSON.stringify(settings));
    setPopularRegion(settings.region);
    mutatePopular();
  }, [mutatePopular, settings]);

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
      setVideos([]);
      setNextPageToken(null);
      updateRecentSearches(term);
      const body = JSON.stringify({ query: term, regionCode: settings.region });
      const response = await fetcher('/api/search', {
        method: 'POST',
        body
      });
      if (response.error) {
        setError(response.error);
        return;
      }
      setVideos(filterBySettings(response.items, settings.minDurationMinutes));
      setNextPageToken(response.nextPageToken);
    },
    [settings.minDurationMinutes, settings.region]
  );

  const handleLoadMore = useCallback(async () => {
    if (!nextPageToken || !query) return;
    setIsLoadingMore(true);
    const response = await fetcher('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query, pageToken: nextPageToken, regionCode: settings.region })
    });
    setIsLoadingMore(false);
    if (response.error) {
      setError(response.error);
      return;
    }
    setVideos((prev) => [...prev, ...filterBySettings(response.items, settings.minDurationMinutes)]);
    setNextPageToken(response.nextPageToken);
  }, [nextPageToken, query, settings.minDurationMinutes, settings.region]);

  const handleRetry = () => {
    if (query) {
      void handleSearch(query);
    } else {
      setError(null);
    }
  };

  const quotaMessage =
    error === 'quota_exceeded'
      ? 'YouTube Data API quota has been exhausted for now. Please try again later.'
      : error === 'rate_limited'
      ? 'Too many requests from this network. Wait a moment and retry.'
      : 'Something went wrong. Please retry.';

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SearchBar onSearch={handleSearch} />
        <SettingsDrawer
          value={settings}
          onChange={(next) => {
            setSettings(next);
          }}
        />
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

      {popularData?.error ? (
        <ErrorState title="Unable to load popular videos" description={quotaMessage} onRetry={() => mutatePopular()} />
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Explore popular in {popularRegion}</h2>
          </div>
          <VideoGrid videos={filteredPopular.slice(0, 6)} isLoading={!popularData} loadingCount={6} />
        </section>
      )}

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
