export function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl bg-surface/60">
      <div className="aspect-video w-full bg-white/10" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 rounded bg-white/10" />
        <div className="h-3 w-1/2 rounded bg-white/10" />
        <div className="h-3 w-full rounded bg-white/5" />
      </div>
    </div>
  );
}
