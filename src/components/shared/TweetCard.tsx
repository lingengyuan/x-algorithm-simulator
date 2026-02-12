import { TweetCandidate } from '@/core/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useI18n';
import { formatRelativeTime } from '@/utils/snowflake';
import { cn } from '@/utils/cn';
import { Image, Video, CheckCircle, XCircle, Users } from 'lucide-react';

interface TweetCardProps {
  tweet: TweetCandidate;
  showScores?: boolean;
  showFiltered?: boolean;
  compact?: boolean;
  highlighted?: boolean;
  rank?: number;
  onClick?: () => void;
}

export function TweetCard({
  tweet,
  showScores = false,
  showFiltered = false,
  compact = false,
  highlighted = false,
  rank,
  onClick,
}: TweetCardProps) {
  const { t, language } = useTranslation();

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-[0_14px_30px_rgba(15,23,42,0.16)]',
        highlighted && 'ring-2 ring-sky-500',
        tweet.filtered && 'opacity-50',
        compact ? 'p-2' : ''
      )}
      onClick={onClick}
    >
      <CardContent className={cn(compact ? 'p-2' : 'p-4')}>
        {/* Header */}
        <div className="flex items-start gap-3">
          {rank !== undefined && (
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
              {rank}
            </div>
          )}

          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-900/10 bg-slate-100 text-lg">
            {tweet.authorAvatar || '👤'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-slate-900">
                {tweet.authorName}
              </span>
              {tweet.authorVerified && (
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-sky-600" />
              )}
              <span className="text-sm text-slate-500">
                {formatRelativeTime(tweet.id, language === 'zh' ? 'zh' : 'en')}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Users className="w-3 h-3" />
              <span>
                {tweet.authorFollowers >= 1000000
                  ? `${(tweet.authorFollowers / 1000000).toFixed(1)}M`
                  : tweet.authorFollowers >= 1000
                  ? `${(tweet.authorFollowers / 1000).toFixed(1)}K`
                  : tweet.authorFollowers}
              </span>
              {tweet.inNetwork ? (
                <Badge variant="positive" className="text-[10px] py-0">
                  {t('simulator.inNetwork')}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] py-0">
                  {t('simulator.outOfNetwork')}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={cn('mt-3', compact && 'text-sm')}>
          <p className="line-clamp-3 text-slate-800">{tweet.content}</p>
        </div>

        {/* Media indicators */}
        {(tweet.hasImage || tweet.hasVideo) && (
          <div className="mt-2 flex gap-2">
            {tweet.hasImage && (
              <Badge variant="secondary" className="gap-1">
                <Image className="w-3 h-3" />
                Image
              </Badge>
            )}
            {tweet.hasVideo && (
              <Badge variant="secondary" className="gap-1">
                <Video className="w-3 h-3" />
                Video
              </Badge>
            )}
          </div>
        )}

        {/* Scores */}
        {showScores && tweet.finalScore !== undefined && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {tweet.weightedScore !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('simulator.weightedScore')}:</span>
                  <span className="font-mono font-medium">
                    {tweet.weightedScore.toFixed(3)}
                  </span>
                </div>
              )}
              {tweet.diversityAdjustedScore !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('simulator.diversityScore')}:</span>
                  <span className="font-mono font-medium">
                    {tweet.diversityAdjustedScore.toFixed(3)}
                  </span>
                </div>
              )}
              <div className="flex justify-between col-span-2">
                <span className="font-semibold text-slate-500">
                  {t('simulator.finalScore')}:
                </span>
                <span className="font-mono font-bold text-sky-700">
                  {tweet.finalScore.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Filtered status */}
        {showFiltered && tweet.filtered && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <XCircle className="w-4 h-4" />
              <span>
                {t('simulator.filtered')}: {tweet.filterReason}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
