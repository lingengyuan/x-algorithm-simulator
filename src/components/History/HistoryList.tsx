import { useState } from 'react';
import { AnalysisHistory, AnalysisResult, TweetInput } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getHistory, clearHistory, deleteHistoryItem } from '@/utils/storage';
import { getHeatLevel } from '@/utils/scoring';
import { History, Trash2, FileText, GitCompare, BarChart3, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6 text-[#1DA1F2]" />
            {t('history.title')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
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
        <Card>
          <CardContent className="py-12 text-center">
            <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-400">{t('history.noHistory')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {histories.map((history, index) => {
              const heatScore = getHeatScore(history);
              const heatLevel = heatScore ? getHeatLevel(heatScore) : null;

              return (
                <motion.div
                  key={history.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        {/* Type Icon */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                          {getTypeIcon(history.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary">{getTypeLabel(history.type)}</Badge>
                            <span className="text-xs text-gray-400">
                              {formatDate(history.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 line-clamp-2">
                            {getPreviewContent(history)}
                          </p>
                        </div>

                        {/* Heat Score */}
                        {heatScore !== undefined && heatLevel && (
                          <div className="flex-shrink-0 text-center">
                            <div className="flex items-center gap-1">
                              <Flame className="w-4 h-4" style={{ color: heatLevel.color }} />
                              <span
                                className="text-lg font-bold"
                                style={{ color: heatLevel.color }}
                              >
                                {Math.round(heatScore)}
                              </span>
                            </div>
                            <div
                              className="text-[10px]"
                              style={{ color: heatLevel.color }}
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
                          className="flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
