import type { PhoenixScores } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScoreBar } from '@/components/shared/ScoreBar';
import { CONTINUOUS_OUTPUT_LABELS, SCORE_LABELS } from '@/utils/scoring';

interface ScoreRadarProps { scores: PhoenixScores; compareScores?: PhoenixScores; }
export function ScoreRadar({ scores, compareScores }: ScoreRadarProps) {
  const { t, isZh } = useTranslation();
  const keys = Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[];
  const continuous = Object.keys(CONTINUOUS_OUTPUT_LABELS) as (keyof typeof CONTINUOUS_OUTPUT_LABELS)[];
  return <div className="output-groups output-distribution">
    <div className="output-probabilities">
      {(['positive', 'negative'] as const).map((type) => <Card key={type} className={`probability-panel probability-${type}`}>
        <CardHeader><CardTitle>{t(type === 'positive' ? 'analyzer.positiveSignals' : 'analyzer.negativeSignals')}</CardTitle><p className="field-note">{isZh ? '预测概率 · 0–100%' : 'Predicted probability · 0–100%'}</p></CardHeader>
        <CardContent className={type === 'positive' ? 'probability-list' : undefined}>{keys.filter((key) => SCORE_LABELS[key].type === type).map((key) => <div key={key}>
          <ScoreBar label={isZh ? SCORE_LABELS[key].nameZh : SCORE_LABELS[key].name} value={scores[key] ?? 0} type={type} />
          {compareScores && <ScoreBar label="B" value={compareScores[key] ?? 0} type={type} />}
        </div>)}</CardContent>
      </Card>)}
    </div>
    <Card className="continuous-panel" data-testid="continuous-phoenix-outputs">
      <CardHeader><CardTitle>{isZh ? '连续输出' : 'Continuous outputs'}</CardTitle></CardHeader>
      <CardContent><div className="continuous-grid">{continuous.map((key) => {
        const label = CONTINUOUS_OUTPUT_LABELS[key];
        return <div key={key}><div className="continuous-label">{isZh ? label.nameZh : label.name}</div>
          <div className="continuous-value">{scores[key] === undefined ? '—' : `${scores[key].toFixed(3)} ${isZh ? '秒' : label.unit}`}</div>
          {compareScores && <div className="field-note">B: {compareScores[key] === undefined ? '—' : `${compareScores[key].toFixed(3)} ${label.unit}`}</div>}
        </div>;
      })}</div><p className="field-note">— {isZh ? '未启用 / 未返回' : 'Disabled / not returned'}</p></CardContent>
    </Card>
  </div>;
}
