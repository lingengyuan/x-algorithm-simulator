import { useMemo } from 'react';
import { TweetCandidate, WeightConfig } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { computeWeightedScore } from '@/utils/scoring';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils/cn';

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
    // Calculate new scores
    const withNewScores = candidates.map((c) => ({
      ...c,
      newScore: computeWeightedScore(c.phoenixScores, weights, c.videoDurationMs),
    }));

    // Sort by new score
    const sorted = [...withNewScores].sort((a, b) => b.newScore - a.newScore);

    // If we have previous weights, calculate changes
    if (previousWeights) {
      const previousScores = candidates.map((c) => ({
        id: c.id,
        score: computeWeightedScore(c.phoenixScores, previousWeights, c.videoDurationMs),
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
          scoreChange: previousScore ? c.newScore - previousScore : 0,
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

  const getRankChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#1DA1F2]" />
          {t('weightLab.liveRanking')}
          <Badge variant="secondary">Top 15</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
          <AnimatePresence mode="popLayout">
            {topCandidates.map((candidate, index) => (
              <motion.div
                key={candidate.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                  delay: index * 0.02,
                }}
              >
                <div
                  className={cn(
                    'p-3 rounded-lg border transition-colors',
                    candidate.rankChange && candidate.rankChange > 0 && 'border-green-200 bg-green-50',
                    candidate.rankChange && candidate.rankChange < 0 && 'border-red-200 bg-red-50',
                    !candidate.rankChange && 'border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <div
                      className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                        index === 0 && 'bg-yellow-500 text-white',
                        index === 1 && 'bg-gray-400 text-white',
                        index === 2 && 'bg-amber-600 text-white',
                        index > 2 && 'bg-gray-200 text-gray-600'
                      )}
                    >
                      {index + 1}
                    </div>

                    {/* Avatar */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm">
                      {candidate.authorAvatar || '👤'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {candidate.authorName}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {candidate.content}
                      </p>
                    </div>

                    {/* Score */}
                    <div className="flex-shrink-0 text-right">
                      <div className="font-mono text-sm font-bold text-[#1DA1F2]">
                        {candidate.newScore.toFixed(3)}
                      </div>
                      {candidate.scoreChange !== undefined && Math.abs(candidate.scoreChange) > 0.001 && (
                        <div
                          className={cn(
                            'text-xs font-mono',
                            candidate.scoreChange > 0 ? 'text-green-500' : 'text-red-500'
                          )}
                        >
                          {candidate.scoreChange > 0 ? '+' : ''}
                          {candidate.scoreChange.toFixed(3)}
                        </div>
                      )}
                    </div>

                    {/* Rank Change */}
                    <div className="flex-shrink-0 flex items-center gap-1 w-16 justify-end">
                      {getRankChangeIcon(candidate.rankChange || 0)}
                      {candidate.rankChange !== 0 && (
                        <span
                          className={cn(
                            'text-xs font-medium',
                            candidate.rankChange && candidate.rankChange > 0
                              ? 'text-green-500'
                              : 'text-red-500'
                          )}
                        >
                          {candidate.rankChange && candidate.rankChange > 0 ? '+' : ''}
                          {candidate.rankChange}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span>{isZh ? '排名上升' : 'Rank Up'}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-500" />
            <span>{isZh ? '排名下降' : 'Rank Down'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Minus className="w-3 h-3 text-gray-400" />
            <span>{isZh ? '无变化' : 'No Change'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
