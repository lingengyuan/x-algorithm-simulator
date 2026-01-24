import { TweetCandidate } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TweetCard } from '@/components/shared/TweetCard';
import { Trophy, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface FinalRankingProps {
  candidates: TweetCandidate[];
  topK?: number;
}

export function FinalRanking({ candidates, topK = 10 }: FinalRankingProps) {
  const { t } = useTranslation();

  const rankedCandidates = [...candidates]
    .filter((c) => !c.filtered && c.finalScore !== undefined)
    .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
    .slice(0, topK);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          {t('simulator.finalRanking')}
          <Badge variant="default">Top {topK}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rankedCandidates.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {t('common.noData')}
          </div>
        ) : (
          <div className="space-y-3">
            {rankedCandidates.map((candidate, index) => (
              <motion.div
                key={candidate.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="flex items-start gap-3">
                  {/* Rank Badge */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0
                        ? 'bg-yellow-500'
                        : index === 1
                        ? 'bg-gray-400'
                        : index === 2
                        ? 'bg-amber-600'
                        : 'bg-gray-300'
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* Tweet Card */}
                  <div className="flex-1">
                    <TweetCard tweet={candidate} showScores compact />
                  </div>

                  {/* Score Change Indicator */}
                  {candidate.weightedScore !== candidate.finalScore && (
                    <div className="flex-shrink-0 flex items-center text-sm">
                      {(candidate.finalScore || 0) > (candidate.weightedScore || 0) ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
