import Image from 'next/image';
import Link from 'next/link';
import { NormalizedVideo } from '@/lib/youtube';
import { formatDistanceToNow } from 'date-fns';
import classNames from 'classnames';

interface VideoCardProps {
  video: NormalizedVideo;
  compact?: boolean;
}

export function VideoCard({ video, compact = false }: VideoCardProps) {
  const thumbnail = video.thumbnails.high ?? video.thumbnails.medium ?? video.thumbnails.default;
  const publishedAgo = formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true });

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
          <Image
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
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold text-white group-hover:text-accent">{video.title}</h3>
        <p className="text-sm text-white/60">{video.channelTitle}</p>
        <p className="line-clamp-2 text-sm text-white/50">{video.description}</p>
        <p className="mt-auto text-xs text-white/40">{publishedAgo}</p>
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
