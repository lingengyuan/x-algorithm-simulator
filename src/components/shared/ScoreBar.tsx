import { cn } from '@/utils/cn';

interface ScoreBarProps {
  label: string;
  value: number;
  maxValue?: number;
  type?: 'positive' | 'negative';
  showPercentage?: boolean;
  compact?: boolean;
}

export function ScoreBar({
  label,
  value,
  maxValue = 1,
  type = 'positive',
  showPercentage = true,
  compact = false,
}: ScoreBarProps) {
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);
  const displayValue = showPercentage
    ? `${Math.round(value * 100)}%`
    : value.toFixed(3);

  return (
    <div className={cn('flex items-center gap-2', compact ? 'text-xs' : 'text-sm')}>
      <span className={cn('text-slate-600 flex-shrink-0', compact ? 'w-20' : 'w-28')}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full border border-slate-900/10 bg-slate-200/70">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            type === 'positive' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-rose-600 to-rose-400'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span
        className={cn(
          'font-mono flex-shrink-0 text-right',
          compact ? 'w-12' : 'w-16',
          type === 'positive' ? 'text-green-600' : 'text-red-600'
        )}
      >
        {displayValue}
      </span>
    </div>
  );
}

interface ScoreGridProps {
  scores: { label: string; value: number; type?: 'positive' | 'negative' }[];
  columns?: 1 | 2;
  compact?: boolean;
}

export function ScoreGrid({ scores, columns = 1, compact = false }: ScoreGridProps) {
  return (
    <div
      className={cn(
        'grid gap-2',
        columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
      )}
    >
      {scores.map((score, index) => (
        <ScoreBar
          key={index}
          label={score.label}
          value={score.value}
          type={score.type}
          compact={compact}
        />
      ))}
    </div>
  );
}
