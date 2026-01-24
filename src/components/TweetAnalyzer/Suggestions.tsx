import { useMemo } from 'react';
import { TweetInput, Suggestion, FilterRisk } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface SuggestionsProps {
  input: TweetInput;
}

export function Suggestions({ input }: SuggestionsProps) {
  const { t, isZh } = useTranslation();

  const suggestions = useMemo((): Suggestion[] => {
    const result: Suggestion[] = [];

    // Media suggestions
    if (input.hasMedia === 'none') {
      result.push({
        type: 'positive',
        message: 'Adding an image increases engagement by ~15%',
        messageZh: '添加图片可以增加约 15% 的互动率',
        impact: 'medium',
      });
      result.push({
        type: 'positive',
        message: 'Adding a video could boost VQV score significantly',
        messageZh: '添加视频可以显著提升 VQV 分数',
        impact: 'high',
      });
    }

    if (input.hasMedia === 'video' && input.videoDurationMs) {
      const durationSec = input.videoDurationMs / 1000;
      if (durationSec >= 30 && durationSec <= 60) {
        result.push({
          type: 'positive',
          message: 'Video duration is optimal (30-60s) for engagement',
          messageZh: '视频时长处于最佳范围（30-60秒）',
          impact: 'high',
        });
      } else if (durationSec < 30) {
        result.push({
          type: 'neutral',
          message: 'Short videos may have lower completion rates',
          messageZh: '短视频可能完播率较低',
          impact: 'low',
        });
      } else if (durationSec > 180) {
        result.push({
          type: 'negative',
          message: 'Long videos (>3 min) may have lower engagement',
          messageZh: '长视频（超过 3 分钟）可能互动率较低',
          impact: 'medium',
        });
      }
    }

    // Content suggestions
    if (input.content.length < 50) {
      result.push({
        type: 'neutral',
        message: 'Longer content may increase dwell time',
        messageZh: '更长的内容可能增加用户停留时长',
        impact: 'low',
      });
    }

    if (input.content.includes('?')) {
      result.push({
        type: 'positive',
        message: 'Questions encourage replies and engagement',
        messageZh: '问题形式可以鼓励回复和互动',
        impact: 'medium',
      });
    }

    const hashtags = input.content.match(/#\w+/g) || [];
    if (hashtags.length > 5) {
      result.push({
        type: 'negative',
        message: 'Too many hashtags may reduce reach',
        messageZh: '话题标签过多可能降低触达',
        impact: 'medium',
      });
    } else if (hashtags.length >= 1 && hashtags.length <= 3) {
      result.push({
        type: 'positive',
        message: 'Good use of hashtags for discoverability',
        messageZh: '话题标签使用合理，有助于被发现',
        impact: 'low',
      });
    }

    const mentions = input.content.match(/@\w+/g) || [];
    if (mentions.length > 5) {
      result.push({
        type: 'negative',
        message: 'Excessive mentions may trigger spam filters',
        messageZh: '过多 @ 可能触发垃圾信息过滤',
        impact: 'high',
      });
    }

    // Author suggestions
    if (input.authorType === 'normal' && input.followerCount < 1000) {
      result.push({
        type: 'neutral',
        message: 'New accounts may have limited initial reach',
        messageZh: '新账号初期触达可能有限',
        impact: 'low',
      });
    }

    if (input.authorType === 'normal') {
      result.push({
        type: 'neutral',
        message: 'Consider getting verified to boost visibility',
        messageZh: '认证大 V 身份可以提升曝光',
        impact: 'medium',
      });
    }

    return result;
  }, [input]);

  const filterRisks = useMemo((): FilterRisk[] => {
    const risks: FilterRisk[] = [];

    // Check content for potential issues
    const content = input.content.toLowerCase();

    if (content.length < 5) {
      risks.push({
        filterId: 'low_quality',
        filterName: 'LowQualityFilter',
        risk: 'high',
        reason: 'Content too short, may be filtered as low quality',
        reasonZh: '内容过短，可能被判定为低质量',
      });
    }

    const mentions = content.match(/@\w+/g) || [];
    if (mentions.length > 10) {
      risks.push({
        filterId: 'low_quality',
        filterName: 'LowQualityFilter',
        risk: 'high',
        reason: 'Excessive mentions may trigger spam filter',
        reasonZh: '过多 @ 可能触发垃圾信息检测',
      });
    }

    const hashtags = content.match(/#\w+/g) || [];
    if (hashtags.length > 10) {
      risks.push({
        filterId: 'low_quality',
        filterName: 'LowQualityFilter',
        risk: 'medium',
        reason: 'Too many hashtags may reduce distribution',
        reasonZh: '话题标签过多可能降低分发',
      });
    }

    if (/(.)\1{5,}/.test(input.content)) {
      risks.push({
        filterId: 'low_quality',
        filterName: 'LowQualityFilter',
        risk: 'medium',
        reason: 'Repeated characters may trigger spam detection',
        reasonZh: '重复字符可能触发垃圾信息检测',
      });
    }

    const sensitiveKeywords = ['nsfw', 'explicit', '18+'];
    if (sensitiveKeywords.some((kw) => content.includes(kw))) {
      risks.push({
        filterId: 'nsfw',
        filterName: 'NSFWFilter',
        risk: 'high',
        reason: 'Content may be flagged as sensitive',
        reasonZh: '内容可能被标记为敏感',
      });
    }

    return risks;
  }, [input]);

  const getSuggestionIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'positive':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'negative':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getImpactBadge = (impact: Suggestion['impact']) => {
    switch (impact) {
      case 'high':
        return <Badge variant="destructive">{isZh ? '高' : 'High'}</Badge>;
      case 'medium':
        return <Badge variant="secondary">{isZh ? '中' : 'Med'}</Badge>;
      default:
        return <Badge variant="outline">{isZh ? '低' : 'Low'}</Badge>;
    }
  };

  const getRiskBadge = (risk: FilterRisk['risk']) => {
    switch (risk) {
      case 'high':
        return <Badge variant="destructive">{isZh ? '高风险' : 'High Risk'}</Badge>;
      case 'medium':
        return <Badge className="bg-orange-500">{isZh ? '中风险' : 'Med Risk'}</Badge>;
      default:
        return <Badge variant="secondary">{isZh ? '低风险' : 'Low Risk'}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Suggestions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            {t('analyzer.suggestions')}
            <Badge variant="secondary">{suggestions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('common.noData')}</p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg',
                    suggestion.type === 'positive' && 'bg-green-50',
                    suggestion.type === 'negative' && 'bg-red-50',
                    suggestion.type === 'neutral' && 'bg-gray-50'
                  )}
                >
                  {getSuggestionIcon(suggestion.type)}
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">
                      {isZh ? suggestion.messageZh : suggestion.message}
                    </p>
                  </div>
                  {getImpactBadge(suggestion.impact)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter Risks */}
      {filterRisks.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              {t('analyzer.filterRisks')}
              <Badge variant="destructive">{filterRisks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filterRisks.map((risk, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-orange-50"
                >
                  <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">
                      {risk.filterName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isZh ? risk.reasonZh : risk.reason}
                    </p>
                  </div>
                  {getRiskBadge(risk.risk)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
