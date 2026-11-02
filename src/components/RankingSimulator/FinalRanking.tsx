import type { FeedItem } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TweetCard } from '@/components/shared/TweetCard';

interface FinalRankingProps { feedItems: FeedItem[]; }

export function FinalRanking({ feedItems }: FinalRankingProps) {
  const { t, isZh } = useTranslation();

  return <Card data-testid="final-timeline">
    <CardHeader><CardTitle>{t('simulator.finalRanking')} <span className="text-sm font-normal text-slate-600">{feedItems.length}</span></CardTitle></CardHeader>
    <CardContent>
      <div className="post-list">
        {feedItems.map((item, index) => <div key={item.id} className="timeline-row">
          <span className="timeline-rank">{index + 1}.</span>
          {item.type === 'post' && item.tweet
            ? <TweetCard tweet={item.tweet} showScores />
            : <div className="feed-module" data-source={item.source}>
                <Badge variant="secondary">{isZh ? item.labelZh : item.label}</Badge>
                <h3>{isZh ? item.titleZh : item.title}</h3>
                <p>{isZh ? item.descriptionZh : item.description}</p>
              </div>}
        </div>)}
        {!feedItems.length && <p className="pipeline-empty">{isZh ? '当前请求没有返回信息流内容。' : 'This request returned no feed content.'}</p>}
      </div>
    </CardContent>
  </Card>;
}
