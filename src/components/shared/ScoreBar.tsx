interface ScoreBarProps {
  label: string;
  value: number;
  maxValue?: number;
  type?: 'positive' | 'negative';
  showPercentage?: boolean;
}
export function ScoreBar({ label, value, maxValue = 1, type = 'positive', showPercentage = true }: ScoreBarProps) {
  const percentage = Math.min(Math.max(value / maxValue * 100, 0), 100);
  return <div className="score-row">
    <div className="score-row-label"><span>{label}</span><span className="score-row-value">{showPercentage ? `${Math.round(value * 100)}%` : value.toFixed(3)}</span></div>
    <div className="score-track" aria-hidden="true"><div className="score-fill" data-negative={type === 'negative'} style={{ width: `${percentage}%` }} /></div>
  </div>;
}
