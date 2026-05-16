import { FeedItem, TweetCandidate } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TweetCard } from '@/components/shared/TweetCard';
import { Megaphone, MessageSquareText, Pin, Trophy, TrendingUp, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';

interface FinalRankingProps {
  candidates: TweetCandidate[];
  feedItems?: FeedItem[];
  topK?: number;
}

export function FinalRanking({ candidates, feedItems, topK = 10 }: FinalRankingProps) {
  const { t, isZh } = useTranslation();

  const rankedCandidates = [...candidates]
    .filter((c) => !c.filtered && c.finalScore !== undefined)
    .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
    .slice(0, topK);
  const timelineItems = feedItems?.length
    ? feedItems
    : rankedCandidates.map((candidate, index) => ({
      id: `post-${candidate.id}`,
      type: 'post' as const,
      rank: index + 1,
      tweet: candidate,
      score: candidate.finalScore,
      label: 'Post',
      labelZh: '帖子',
      title: candidate.authorName,
      titleZh: candidate.authorName,
      description: candidate.content,
      descriptionZh: candidate.content,
      source: 'ScoredPostsSource',
    }));

  const moduleIcon = (type: FeedItem['type']) => {
    switch (type) {
      case 'ad':
        return <Megaphone className="h-4 w-4 text-amber-600" />;
      case 'who_to_follow':
        return <UserPlus className="h-4 w-4 text-sky-600" />;
      case 'prompt':
        return <MessageSquareText className="h-4 w-4 text-violet-600" />;
      case 'push_to_home':
        return <Pin className="h-4 w-4 text-emerald-600" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          {feedItems?.length ? t('simulator.finalTimeline') : t('simulator.finalRanking')}
          <Badge variant="default">Top {topK}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {timelineItems.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            {t('common.noData')}
          </div>
        ) : (
          <div className="space-y-3">
            {timelineItems.map((item, index) => (
              <motion.div
                key={item.id}
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
                        ? 'bg-slate-400'
                        : index === 2
                        ? 'bg-amber-600'
                        : 'bg-slate-300'
                    }`}
                  >
                    {index + 1}
                  </div>

                  <div className="flex-1">
                    {item.type === 'post' && item.tweet ? (
                      <TweetCard tweet={item.tweet} showScores compact />
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center gap-2">
                          {moduleIcon(item.type)}
                          <Badge variant="outline" className="text-[10px]">
                            {isZh ? item.labelZh : item.label}
                          </Badge>
                          <span className="truncate text-xs text-slate-500">
                            {item.source}
                          </span>
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-slate-900">
                          {isZh ? item.titleZh : item.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600">
                          {isZh ? item.descriptionZh : item.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Score Change Indicator */}
                  {item.tweet && item.tweet.weightedScore !== item.tweet.finalScore && (
                    <div className="flex-shrink-0 flex items-center text-sm">
                      {(item.tweet.finalScore || 0) > (item.tweet.weightedScore || 0) ? (
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
