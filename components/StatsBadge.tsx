import classNames from 'classnames';

interface StatsBadgeProps {
  label: string;
  value: string;
  icon: 'eye' | 'heart';
  muted?: boolean;
}

export function StatsBadge({ label, value, icon, muted = false }: StatsBadgeProps) {
  return (
    <span
      className={classNames(
        'flex items-center gap-1 rounded-full px-2 py-1 text-xs',
        muted ? 'bg-white/5 text-white/40' : 'bg-white/10 text-white/80'
      )}
      title={`${label}: ${value === '—' ? 'Unavailable' : value}`}
    >
      <StatsIcon icon={icon} />
      <span>{value}</span>
    </span>
  );
}

function StatsIcon({ icon }: { icon: 'eye' | 'heart' }) {
  if (icon === 'eye') {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10Z" />
    </svg>
  );
}

export function formatCompactNumber(count: number): string {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(count);
}
