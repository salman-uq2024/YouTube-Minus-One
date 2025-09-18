import { Suspense } from 'react';
import { VideoGrid } from '@/components/VideoGrid';
import { CACHE_TTL_SECONDS, getCached, getMostPopularVideos } from '@/lib/youtube';

export const revalidate = 3600;

async function PopularSection() {
  const { items } = await getCached('explore:popular:US', () => getMostPopularVideos('US'), CACHE_TTL_SECONDS);
  return <VideoGrid videos={items.slice(0, 12)} />;
}

export default function ExplorePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Explore</h1>
        <p className="text-sm text-white/60">
          A curated look at the most popular long-form videos on YouTube right now.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-white/60">Loading popular videos…</p>}>
        <PopularSection />
      </Suspense>
    </div>
  );
}
