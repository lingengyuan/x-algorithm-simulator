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
import { containsKeywordSequence, tokenizePostText } from '@/utils/textTokens';

interface SuggestionsProps {
  input: TweetInput;
}

export function Suggestions({ input }: SuggestionsProps) {
  const { t, isZh } = useTranslation();

  const suggestions = useMemo((): Suggestion[] => {
    const result: Suggestion[] = [{
      type: 'neutral',
      message: 'Values are deterministic fixtures for the published Phoenix output heads, not production model inference.',
      messageZh: '这些数值只是公开 Phoenix 输出头的确定性测试数据，不是生产模型推理结果。',
      impact: 'high',
    }];

    if (input.hasMedia === 'video') {
      const durationMs = input.videoDurationMs || 0;
      result.push({
        type: durationMs > 10_000 ? 'positive' : 'neutral',
        message: durationMs > 10_000
          ? 'This fixture passes the published >10s VQV duration gate; the viewer-follower gate is evaluated separately.'
          : 'This fixture does not pass the published >10s VQV duration gate.',
        messageZh: durationMs > 10_000
          ? '该测试数据通过公开的“大于 10 秒”VQV 时长条件；观看者粉丝数条件另行判断。'
          : '该测试数据未通过公开的“大于 10 秒”VQV 时长条件。',
        impact: 'medium',
      });
    } else {
      result.push({
        type: 'neutral',
        message: 'The local fixture generator changes media-related heads, but the upstream code publishes no reach guarantee.',
        messageZh: '本地测试生成器会改变媒体相关输出头，但上游代码没有公开任何触达保证。',
        impact: 'low',
      });
    }

    result.push({
      type: 'neutral',
      message: 'Text length, punctuation, author type, and follower count only seed local fixture values.',
      messageZh: '文本长度、标点、作者类型和粉丝数只用于生成本地测试数值。',
      impact: 'low',
    });
    return result;
  }, [input]);

  const filterRisks = useMemo((): FilterRisk[] => {
    const risks: FilterRisk[] = [];

    const mutedKeywordHints = ['crypto', 'giveaway', 'spoiler'];
    const contentTokens = tokenizePostText(input.content);
    const hasMutedKeyword = mutedKeywordHints.some((keyword) =>
      containsKeywordSequence(contentTokens, tokenizePostText(keyword))
    );
    if (hasMutedKeyword) {
      risks.push({
        filterId: 'muted_keyword',
        filterName: 'MutedKeywordFilter',
        risk: 'medium',
        reason: 'The simulator viewer fixture mutes one of these exact keywords.',
        reasonZh: '模拟器中的观看者测试数据明确静音了其中一个关键词。',
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
        return <Badge className="border-orange-700/20 bg-orange-100 text-orange-700">{isZh ? '中风险' : 'Med Risk'}</Badge>;
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
            <p className="text-slate-600 text-sm">{t('common.noData')}</p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg',
                    suggestion.type === 'positive' && 'bg-emerald-50',
                    suggestion.type === 'negative' && 'bg-rose-50',
                    suggestion.type === 'neutral' && 'bg-slate-100/70'
                  )}
                >
                  {getSuggestionIcon(suggestion.type)}
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">
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
        <Card className="border-orange-300/50">
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
                    <p className="text-sm font-medium text-slate-700">
                      {risk.filterName}
                    </p>
                    <p className="text-sm text-slate-600">
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
