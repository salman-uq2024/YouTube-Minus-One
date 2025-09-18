'use client';

interface PaginatorProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading?: boolean;
}

export function Paginator({ onLoadMore, hasMore, isLoading = false }: PaginatorProps) {
  if (!hasMore) return null;
  return (
    <div className="mt-8 flex justify-center">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={isLoading}
        className="rounded-full bg-surface px-6 py-2 text-sm font-semibold text-white shadow transition hover:bg-surface/80 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
