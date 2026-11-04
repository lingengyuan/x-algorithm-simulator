import type { TweetCandidate } from '@/core/types';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useI18n';
import { formatRelativeTime } from '@/utils/snowflake';
import { contributionLabel } from '@/utils/scoring';
import { Image, Video, ShieldAlert } from 'lucide-react';

interface TweetCardProps {
  tweet: TweetCandidate;
  showScores?: boolean;
  showFiltered?: boolean;
  highlighted?: boolean;
  rank?: number;
  onClick?: () => void;
}

export function TweetCard({ tweet, showScores = false, showFiltered = false, highlighted = false, rank, onClick }: TweetCardProps) {
  const { t, isZh } = useTranslation();
  const followers = tweet.authorFollowers;
  const initials = tweet.authorName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('');
  return <article className="post-card" data-testid="tweet-card" data-selected={highlighted} onClick={onClick}>
    <div className="post-identity">
      <span className="author-initials" aria-hidden="true">{initials}</span>
      <div>
        <div className="post-author-line">
          {rank !== undefined && <span className="post-time">{rank}.</span>}
          <span className="post-author-name">{tweet.authorName}</span>
          <time className="post-time">{formatRelativeTime(tweet.id, isZh ? 'zh' : 'en')}</time>
        </div>
        <div className="post-metadata">
          <span>{followers === undefined ? '—' : Intl.NumberFormat(isZh ? 'zh-CN' : 'en', { notation: 'compact', maximumFractionDigits: 1 }).format(followers)} {isZh ? '关注者' : 'followers'}</span>
          <span>{tweet.inNetwork === true ? t('simulator.inNetwork') : tweet.inNetwork === false ? t('simulator.outOfNetwork') : t('simulator.networkUnknown')}</span>
        </div>
      </div>
    </div>
    <p className="post-content">{tweet.content}</p>
    {(tweet.hasImage || tweet.hasVideo) && <div className="post-media">
      {tweet.hasImage && <span><Image size={12} />{isZh ? '图片' : 'Image'}</span>}
      {tweet.hasVideo && <span><Video size={12} />{isZh ? '视频' : 'Video'}</span>}
    </div>}
    {tweet.visibilityAction === 'interstitial' && <div data-testid="visibility-interstitial" className="feed-module">
      <Badge variant="negative"><ShieldAlert size={13} />{isZh ? '敏感内容警示' : 'Sensitive content'}</Badge>
      <p>{tweet.visibilityDecidedBy || tweet.visibilityReason}</p>
    </div>}
    {showScores && tweet.finalScore !== undefined && <dl className="post-scores">
      {tweet.weightedScore !== undefined && <><dt>{t('simulator.weightedScore')}</dt><dd>{tweet.weightedScore.toFixed(3)}</dd></>}
      {tweet.diversityAdjustedScore !== undefined && <><dt>{t('simulator.diversityScore')}</dt><dd>{tweet.diversityAdjustedScore.toFixed(3)}</dd></>}
      <dt className="final-score">{t('simulator.finalScore')}</dt><dd className="final-score">{tweet.finalScore.toFixed(3)}</dd>
    </dl>}
    {showScores && Boolean(tweet.topHeads?.length) && <details className="mt-3 text-xs" data-testid="score-contributions">
      <summary>{isZh ? '主要评分贡献' : 'Main score contributions'}</summary>
      <p className="field-note">{isZh ? '加权项贡献及其绝对值占比，不含多样性与关注外系数。' : 'Weighted contributions and absolute shares, before diversity and OON factors.'}</p>
      <dl className="post-scores">
        {tweet.topHeads!.map(({ head, contribution, share }) => {
          const label = contributionLabel(head);
          return <div key={head} className="contents" data-head={head}>
            <dt>{isZh ? label.nameZh : label.name}</dt>
            <dd>{contribution > 0 ? '+' : ''}{contribution.toFixed(3)} · {(share * 100).toFixed(1)}%</dd>
          </div>;
        })}
      </dl>
    </details>}
    {showFiltered && tweet.filtered && <p className="field-note">{t('simulator.filtered')}: {tweet.filterReason}</p>}
  </article>;
}
