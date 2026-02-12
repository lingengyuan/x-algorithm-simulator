import { PhoenixScores } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScoreBar } from '@/components/shared/ScoreBar';
import { SCORE_LABELS } from '@/utils/scoring';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface ScoreRadarProps {
  scores: PhoenixScores;
  compareScores?: PhoenixScores;
}

export function ScoreRadar({ scores, compareScores }: ScoreRadarProps) {
  const { t, isZh } = useTranslation();

  // Prepare radar data (positive signals only for radar)
  const positiveKeys = (Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[]).filter(
    (key) => SCORE_LABELS[key].type === 'positive'
  );

  const radarData = positiveKeys.map((key) => ({
    subject: isZh ? SCORE_LABELS[key].nameZh : SCORE_LABELS[key].name,
    A: Math.round(scores[key] * 100),
    B: compareScores ? Math.round(compareScores[key] * 100) : undefined,
    fullMark: 100,
  }));

  // Separate positive and negative scores
  const positiveScores = positiveKeys.map((key) => ({
    label: isZh ? SCORE_LABELS[key].nameZh : SCORE_LABELS[key].name,
    value: scores[key],
    type: 'positive' as const,
  }));

  const negativeKeys = (Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[]).filter(
    (key) => SCORE_LABELS[key].type === 'negative'
  );

  const negativeScores = negativeKeys.map((key) => ({
    label: isZh ? SCORE_LABELS[key].nameZh : SCORE_LABELS[key].name,
    value: scores[key],
    type: 'negative' as const,
  }));

  return (
    <div className="space-y-4">
      {/* Radar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('analyzer.behaviorPredictions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#cbd5e1" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: '#475569', fontSize: 10 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                <Radar
                  name={compareScores ? 'Tweet A' : 'Score'}
                  dataKey="A"
                  stroke="#0f172a"
                  fill="#0ea5e9"
                  fillOpacity={0.4}
                />
                {compareScores && (
                  <Radar
                    name="Tweet B"
                    dataKey="B"
                    stroke="#22C55E"
                    fill="#22C55E"
                    fillOpacity={0.3}
                  />
                )}
                {compareScores && <Legend />}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Score Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Positive Signals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-green-500" />
              {t('analyzer.positiveSignals')}
              <Badge variant="positive">{positiveScores.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {positiveScores.map((score, index) => (
                <ScoreBar
                  key={index}
                  label={score.label}
                  value={score.value}
                  type="positive"
                  compact
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Negative Signals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ThumbsDown className="w-4 h-4 text-red-500" />
              {t('analyzer.negativeSignals')}
              <Badge variant="negative">{negativeScores.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {negativeScores.map((score, index) => (
                <ScoreBar
                  key={index}
                  label={score.label}
                  value={score.value}
                  type="negative"
                  compact
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
