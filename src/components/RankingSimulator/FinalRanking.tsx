import type { FeedItem, TweetCandidate } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TweetCard } from '@/components/shared/TweetCard';

interface FinalRankingProps {
  candidates: TweetCandidate[];
  feedItems?: FeedItem[];
  topK?: number;
}

export function FinalRanking({ candidates, feedItems, topK = 10 }: FinalRankingProps) {
  const { t, isZh } = useTranslation();
  const hasFeedItems = feedItems !== undefined;

  const rankedCandidates = [...candidates]
    .filter((c) => !c.filtered && c.finalScore !== undefined)
    .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
    .slice(0, topK);
  const timelineItems: FeedItem[] = hasFeedItems
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
      sourceZh: '帖子排序来源',
    }));

  return <Card data-testid="final-timeline">
    <CardHeader><CardTitle>{t('simulator.finalRanking')} <span className="text-sm font-normal text-slate-600">{timelineItems.length}</span></CardTitle></CardHeader>
    <CardContent>
      <div className="post-list">
        {timelineItems.map((item, index) => <div key={item.id} className="timeline-row">
          <span className="timeline-rank">{index + 1}.</span>
          {item.type === 'post' && item.tweet
            ? <TweetCard tweet={item.tweet} showScores compact />
            : <div className="feed-module" data-source={item.source}>
                <Badge variant="secondary">{isZh ? item.labelZh : item.label}</Badge>
                <h3>{isZh ? item.titleZh : item.title}</h3>
                <p>{isZh ? item.descriptionZh : item.description}</p>
              </div>}
        </div>)}
        {!timelineItems.length && <p className="pipeline-empty">{isZh ? '当前请求没有返回信息流内容。' : 'This request returned no feed content.'}</p>}
      </div>
    </CardContent>
  </Card>;
}
