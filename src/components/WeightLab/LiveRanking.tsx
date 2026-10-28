import { useMemo } from 'react';
import { TweetCandidate, WeightConfig } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { runAllScorers } from '@/core/scorers';
import { getDefaultFilterContext } from '@/data/mockTweets';

interface LiveRankingProps {
  candidates: TweetCandidate[];
  weights: WeightConfig;
  previousWeights?: WeightConfig;
}

interface RankedCandidate extends TweetCandidate {
  newScore: number;
  previousScore?: number;
  previousRank?: number;
  rankChange?: number;
  scoreChange?: number;
}

export function LiveRanking({ candidates, weights, previousWeights }: LiveRankingProps) {
  const { t, isZh } = useTranslation();

  const rankedCandidates = useMemo((): RankedCandidate[] => {
    const scoreCandidates = (weightConfig: WeightConfig) => {
      const context = getDefaultFilterContext(candidates);
      const { finalCandidates } = runAllScorers(candidates, weightConfig, context);
      return finalCandidates.map((candidate) => ({
        ...candidate,
        newScore: candidate.finalScore || 0,
      }));
    };

    const sorted = scoreCandidates(weights);

    if (previousWeights) {
      const previousScores = scoreCandidates(previousWeights).map((candidate) => ({
        id: candidate.id,
        score: candidate.newScore,
      }));
      const previousSorted = [...previousScores].sort((a, b) => b.score - a.score);

      return sorted.map((c, newRank) => {
        const previousIndex = previousSorted.findIndex((p) => p.id === c.id);
        const previousScore = previousScores.find((p) => p.id === c.id)?.score;

        return {
          ...c,
          previousScore,
          previousRank: previousIndex,
          rankChange: previousIndex !== -1 ? previousIndex - newRank : 0,
          scoreChange: previousScore !== undefined ? c.newScore - previousScore : 0,
        };
      });
    }

    return sorted.map((c) => ({
      ...c,
      rankChange: 0,
      scoreChange: 0,
    }));
  }, [candidates, weights, previousWeights]);

  const topCandidates = rankedCandidates.slice(0, 15);

  return <Card>
    <CardHeader><CardTitle>{t('weightLab.liveRanking')}</CardTitle><p className="field-note">{isZh ? '前 15 条 · 分数变化相对上次调整前' : 'Top 15 · score changes relative to the previous adjustment'}</p></CardHeader>
    <CardContent><div className="post-list">{topCandidates.map((candidate, index) => <div key={candidate.id} className="live-rank-row" data-testid="live-rank-row">
      <span className="text-xs text-slate-600">{index + 1}.</span>
      <div><div className="live-rank-name">{candidate.authorName}</div><p className="live-rank-preview">{candidate.content}</p></div>
      <div><div className="live-rank-score">{candidate.newScore.toFixed(3)}</div>
        {candidate.scoreChange !== undefined && Math.abs(candidate.scoreChange) > 0.001 && <div className="live-rank-delta">{candidate.scoreChange > 0 ? '+' : ''}{candidate.scoreChange.toFixed(3)}</div>}
        {Boolean(candidate.rankChange) && <div className="live-rank-delta">{candidate.rankChange! > 0 ? '↑' : '↓'} {Math.abs(candidate.rankChange!)}</div>}
      </div>
    </div>)}</div></CardContent>
  </Card>;
}
