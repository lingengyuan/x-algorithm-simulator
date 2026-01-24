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
        'transition-all duration-200 cursor-pointer hover:shadow-md',
        highlighted && 'ring-2 ring-[#1DA1F2]',
        tweet.filtered && 'opacity-50',
        compact ? 'p-2' : ''
      )}
      onClick={onClick}
    >
      <CardContent className={cn(compact ? 'p-2' : 'p-4')}>
        {/* Header */}
        <div className="flex items-start gap-3">
          {rank !== undefined && (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1DA1F2] text-white flex items-center justify-center text-sm font-bold">
              {rank}
            </div>
          )}

          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg">
            {tweet.authorAvatar || '👤'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 truncate">
                {tweet.authorName}
              </span>
              {tweet.authorVerified && (
                <CheckCircle className="w-4 h-4 text-[#1DA1F2] flex-shrink-0" />
              )}
              <span className="text-gray-500 text-sm">
                {formatRelativeTime(tweet.id, language === 'zh' ? 'zh' : 'en')}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
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
          <p className="text-gray-800 line-clamp-3">{tweet.content}</p>
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
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {tweet.weightedScore !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('simulator.weightedScore')}:</span>
                  <span className="font-mono font-medium">
                    {tweet.weightedScore.toFixed(3)}
                  </span>
                </div>
              )}
              {tweet.diversityAdjustedScore !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('simulator.diversityScore')}:</span>
                  <span className="font-mono font-medium">
                    {tweet.diversityAdjustedScore.toFixed(3)}
                  </span>
                </div>
              )}
              <div className="flex justify-between col-span-2">
                <span className="text-gray-500 font-semibold">
                  {t('simulator.finalScore')}:
                </span>
                <span className="font-mono font-bold text-[#1DA1F2]">
                  {tweet.finalScore.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Filtered status */}
        {showFiltered && tweet.filtered && (
          <div className="mt-3 pt-3 border-t border-gray-100">
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
