import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Player } from '@/components/Player';
import { VideoCard } from '@/components/VideoCard';
import { ErrorState } from '@/components/ErrorState';
import { CACHE_TTL_SECONDS, getCached, getRelatedVideos, getVideoById } from '@/lib/youtube';
import { formatDistanceToNow } from 'date-fns';

interface WatchPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: WatchPageProps): Promise<Metadata> {
  const video = await getCached(`video:${params.id}`, () => getVideoById(params.id), CACHE_TTL_SECONDS);
  if (!video) {
    return { title: 'Video not found' };
  }
  return {
    title: `${video.title} – YouTube Minus One`,
    description: video.description.slice(0, 160)
  };
}

export default async function WatchPage({ params }: WatchPageProps) {
  const video = await getCached(`video:${params.id}`, () => getVideoById(params.id), CACHE_TTL_SECONDS);
  if (!video) {
    notFound();
  }
  const related = await getCached(`related:${params.id}`, () => getRelatedVideos(params.id), CACHE_TTL_SECONDS);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10">
      <section className="space-y-4">
        <Player videoId={video.id} />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{video.title}</h1>
          <p className="text-sm text-white/60">
            {video.channelTitle} • {formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}
          </p>
          <p className="whitespace-pre-line rounded-lg bg-surface/60 p-4 text-sm text-white/70">
            {video.description.slice(0, 1000)}
          </p>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Related videos</h2>
        {related.items.length === 0 ? (
          <ErrorState
            title="No related videos"
            description="We couldn\'t find longer related videos right now. Try another video."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {related.items.slice(0, 6).map((item) => (
              <VideoCard key={item.id} video={item} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
