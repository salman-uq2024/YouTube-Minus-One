export function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl bg-surface/60">
      <div className="aspect-video w-full bg-white/10" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 rounded bg-white/10" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 rounded bg-white/10" />
            <div className="h-2.5 w-1/3 rounded bg-white/10" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-white/10" />
          <div className="h-5 w-16 rounded-full bg-white/5" />
        </div>
      </div>
    </div>
  );
}
