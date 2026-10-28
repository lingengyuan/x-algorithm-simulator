interface ScoreBarProps {
  label: string;
  value: number;
  maxValue?: number;
  type?: 'positive' | 'negative';
  showPercentage?: boolean;
  compact?: boolean;
}
export function ScoreBar({ label, value, maxValue = 1, type = 'positive', showPercentage = true }: ScoreBarProps) {
  const percentage = Math.min(Math.max(value / maxValue * 100, 0), 100);
  return <div className="score-row">
    <div className="score-row-label"><span>{label}</span><span className="score-row-value">{showPercentage ? `${Math.round(value * 100)}%` : value.toFixed(3)}</span></div>
    <div className="score-track" aria-hidden="true"><div className="score-fill" data-negative={type === 'negative'} style={{ width: `${percentage}%` }} /></div>
  </div>;
}
interface ScoreGridProps { scores: { label: string; value: number; type?: 'positive' | 'negative' }[]; columns?: 1 | 2; compact?: boolean; }
export function ScoreGrid({ scores, columns = 1, compact }: ScoreGridProps) {
  return <div className={columns === 2 ? 'output-probabilities' : ''}>{scores.map((score) => <ScoreBar key={score.label} {...score} compact={compact} />)}</div>;
}
