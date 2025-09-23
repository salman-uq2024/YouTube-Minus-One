import Link from 'next/link';
import { NormalizedVideo } from '@/lib/youtube';
import { formatDistanceToNow } from 'date-fns';
import classNames from 'classnames';
import { StatsBadge, formatCompactNumber } from './StatsBadge';
import { SafeImage } from './SafeImage';

interface VideoCardProps {
  video: NormalizedVideo;
  compact?: boolean;
}

export function VideoCard({ video, compact = false }: VideoCardProps) {
  const thumbnail = video.thumbnails.high ?? video.thumbnails.medium ?? video.thumbnails.default;
  const publishedAgo = formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true });
  const viewsLabel = formatCompactNumber(video.viewCount);
  const likesLabel = video.likeCount != null ? formatCompactNumber(video.likeCount) : '—';
  const channelInitial = video.channelTitle.charAt(0).toUpperCase();

  return (
    <Link
      href={`/watch/${video.id}`}
      className={classNames(
        'group flex flex-col overflow-hidden rounded-xl bg-surface/80 transition hover:-translate-y-1 hover:bg-surface',
        {
          'md:flex-row': compact
        }
      )}
    >
      {thumbnail ? (
        <div className={classNames('relative w-full', { 'md:w-60': compact })}>
          <SafeImage
            src={thumbnail.url}
            alt={video.title}
            width={thumbnail.width ?? 320}
            height={thumbnail.height ?? 180}
            className="h-full w-full object-cover transition group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 25vw"
            priority={false}
          />
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-0.5 text-xs font-medium">
            {formatDuration(video.durationSec)}
          </span>
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 text-base font-semibold text-white group-hover:text-accent" title={video.title}>
          {video.title}
        </h3>
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 overflow-hidden rounded-full bg-white/10">
            {video.channelAvatarUrl ? (
              <SafeImage
                src={video.channelAvatarUrl}
                alt={`${video.channelTitle} avatar`}
                width={36}
                height={36}
                className="h-9 w-9 object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase text-white/70">
                {channelInitial}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white" title={video.channelTitle}>
              {video.channelTitle}
            </p>
            <p className="text-xs text-white/40" title={`Published ${publishedAgo}`}>
              {publishedAgo}
            </p>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-white/60">
          <StatsBadge label="Views" value={viewsLabel} icon="eye" />
          <StatsBadge label="Likes" value={likesLabel} icon="heart" muted={likesLabel === '—'} />
        </div>
      </div>
    </Link>
  );
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) {
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
