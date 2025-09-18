import { NormalizedVideo } from '@/lib/youtube';
import { VideoCard } from './VideoCard';
import { SkeletonCard } from './SkeletonCard';

interface VideoGridProps {
  videos: NormalizedVideo[];
  isLoading?: boolean;
  loadingCount?: number;
}

export function VideoGrid({ videos, isLoading = false, loadingCount = 8 }: VideoGridProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
      {isLoading
        ? Array.from({ length: loadingCount }).map((_, index) => <SkeletonCard key={`skeleton-${index}`} />)
        : null}
    </div>
  );
}
