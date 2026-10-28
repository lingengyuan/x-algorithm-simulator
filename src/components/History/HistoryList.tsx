import { Link } from 'react-router-dom';
import { useState } from 'react';
import { AnalysisHistory, AnalysisResult, TweetInput } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getHistory, clearHistory, deleteHistoryItem } from '@/utils/storage';
import { getHeatLevel } from '@/utils/scoring';
import { Trash2, FileText, GitCompare, BarChart3, Flame } from 'lucide-react';

export function HistoryList() {
  const { t, isZh } = useTranslation();
  const [histories, setHistories] = useState<AnalysisHistory[]>(() => getHistory());

  const handleClearAll = () => {
    if (window.confirm(isZh ? '确定要清除所有历史记录吗？' : 'Clear all history?')) {
      clearHistory();
      setHistories([]);
    }
  };

  const handleDelete = (id: string) => {
    deleteHistoryItem(id);
    setHistories((prev) => prev.filter((h) => h.id !== id));
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString(isZh ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeIcon = (type: AnalysisHistory['type']) => {
    switch (type) {
      case 'single':
        return <FileText className="w-4 h-4" />;
      case 'compare':
        return <GitCompare className="w-4 h-4" />;
      case 'ranking':
        return <BarChart3 className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: AnalysisHistory['type']) => {
    switch (type) {
      case 'single':
        return t('history.single');
      case 'compare':
        return t('history.compare');
      case 'ranking':
        return t('history.ranking');
    }
  };

  const getPreviewContent = (history: AnalysisHistory): string => {
    if (Array.isArray(history.input)) {
      return history.input.map((i) => i.content).join(' | ');
    }
    return (history.input as TweetInput).content;
  };

  const getHeatScore = (history: AnalysisHistory): number | undefined => {
    if (Array.isArray(history.result)) {
      return undefined;
    }
    return (history.result as AnalysisResult).heatScore;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1 className="mt-1 text-2xl font-bold flex items-center gap-2 text-slate-900">

            {t('history.title')}
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            {histories.length} {isZh ? '条记录' : 'records'}
          </p>
        </div>

        {histories.length > 0 && (
          <Button variant="outline" onClick={handleClearAll} className="gap-2 text-red-500">
            <Trash2 className="w-4 h-4" />
            {t('history.clearAll')}
          </Button>
        )}
      </div>

      {/* History List */}
      {histories.length === 0 ? (
        <div className="analyzer-empty">
          <h2>{t('history.noHistory')}</h2>
          <p>{isZh ? '生成一次测试输出后，本浏览器会保存分析记录。' : 'Generate fixture outputs to save your first analysis in this browser.'}</p>
          <Link to="/" className="button button-primary mt-4">{isZh ? '开始输出探索' : 'Explore fixture outputs'}</Link>
        </div>
      ) : (
        <div className="space-y-3">
          <>
            {histories.map((history) => {
              const heatScore = getHeatScore(history);
              const heatLevel = heatScore ? getHeatLevel(heatScore) : null;

              return (
                <div
                  key={history.id}
                >
                  <Card className="">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        {/* Type Icon */}
                        <div className="mt-1 shrink-0 text-slate-600">
                          {getTypeIcon(history.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge variant="secondary">{getTypeLabel(history.type)}</Badge>
                            <span className="text-xs text-slate-500">
                              {formatDate(history.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 line-clamp-2">
                            {getPreviewContent(history)}
                          </p>
                        </div>

                        {/* Heat Score */}
                        {heatScore !== undefined && heatLevel && (
                          <div className="flex-shrink-0 text-center">
                            <div className="flex items-center gap-1">
                              <Flame className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                              <span
                                className="text-lg font-bold"
                                style={{ color: 'var(--accent)' }}
                              >
                                {Math.round(heatScore)}
                              </span>
                            </div>
                            <div
                              className="text-xs"
                              style={{ color: 'var(--accent)' }}
                            >
                              {isZh ? heatLevel.labelZh : heatLevel.label}
                            </div>
                          </div>
                        )}

                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(history.id)}
                          aria-label={isZh ? '删除记录' : 'Delete analysis'}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </>
        </div>
      )}
    </div>
  );
}
