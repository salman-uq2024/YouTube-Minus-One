import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Player } from '@/components/Player';
import { VideoCard } from '@/components/VideoCard';
import { ErrorState } from '@/components/ErrorState';
import { StatsBadge, formatCompactNumber } from '@/components/StatsBadge';
import { SafeImage } from '@/components/SafeImage';
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
  const viewsLabel = formatCompactNumber(video.viewCount);
  const likesLabel = video.likeCount != null ? formatCompactNumber(video.likeCount) : '—';
  const publishedAgo = formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true });
  const channelInitial = video.channelTitle.charAt(0).toUpperCase();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10">
      <section className="space-y-4">
        <Player videoId={video.id} />
        <div className="space-y-4 rounded-2xl bg-surface/60 p-6">
          <h1 className="text-2xl font-semibold" title={video.title}>
            {video.title}
          </h1>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-full bg-white/10">
                {video.channelAvatarUrl ? (
                  <SafeImage
                    src={video.channelAvatarUrl}
                    alt={`${video.channelTitle} avatar`}
                    width={48}
                    height={48}
                    className="h-12 w-12 object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-semibold uppercase text-white/70">
                    {channelInitial}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-medium text-white" title={video.channelTitle}>
                  {video.channelTitle}
                </p>
                <p className="text-sm text-white/50" title={`Published ${publishedAgo}`}>
                  {publishedAgo}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatsBadge label="Views" value={viewsLabel} icon="eye" />
              <StatsBadge label="Likes" value={likesLabel} icon="heart" muted={likesLabel === '—'} />
            </div>
          </div>
          <p className="whitespace-pre-line rounded-lg bg-white/5 p-4 text-sm text-white/70">
            {video.description.slice(0, 1500)}
            {video.description.length > 1500 ? '…' : ''}
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
