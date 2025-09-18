'use client';

interface ErrorStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, description, actionLabel = 'Try again', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-surface/60 p-8 text-center">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="max-w-md text-sm text-white/60">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black hover:bg-white"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
