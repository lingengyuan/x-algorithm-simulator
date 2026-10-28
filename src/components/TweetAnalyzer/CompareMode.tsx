import { useState } from 'react';
import { TweetInput, AnalysisResult } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CONTINUOUS_OUTPUT_LABELS,
  SCORE_LABELS,
  simulatePhoenixScores,
  calculateHeatScore,
} from '@/utils/scoring';
import {
  Plus,
  X,
  GitCompare,
  Flame,
} from 'lucide-react';


interface CompareModeProps {
  onClose?: () => void;
}

interface CompareItem {
  id: string;
  input: TweetInput;
  result?: AnalysisResult;
}

const COLORS = ['#283b43', '#1b6c80', '#596369', '#475e66'];

export function CompareMode({ onClose }: CompareModeProps) {
  const { t, isZh } = useTranslation();

  const [items, setItems] = useState<CompareItem[]>([
    { id: '1', input: { content: '', hasMedia: 'none', authorType: 'normal', followerCount: 10000 } },
    { id: '2', input: { content: '', hasMedia: 'none', authorType: 'normal', followerCount: 10000 } },
  ]);

  const addItem = () => {
    if (items.length >= 4) return;
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        input: { content: '', hasMedia: 'none', authorType: 'normal', followerCount: 10000 },
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 2) return;
    setItems(items.filter((item) => item.id !== id));
  };

  const updateContent = (id: string, content: string) => {
    setItems(
      items.map((item) =>
        item.id === id
          ? { ...item, input: { ...item.input, content }, result: undefined }
          : item
      )
    );
  };

  const analyzeAll = () => {
    const analyzed = items.map((item) => {
      if (!item.input.content.trim()) return { ...item, result: undefined };

      const phoenixScores = simulatePhoenixScores(item.input);
      const heatScore = calculateHeatScore(phoenixScores);

      return {
        ...item,
        result: {
          phoenixScores,
          heatScore,
          suggestions: [],
          filterRisks: [],
        },
      };
    });

    setItems(analyzed);
  };

  const hasResults = items.some((item) => item.result);
  const validItems = items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => item.result !== undefined);

  // Use aligned metrics instead of overlapping radial labels.
  const positiveKeys = (Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[])
    .filter((key) => SCORE_LABELS[key].type === 'positive')
    ;


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-sky-600" />
            {t('analyzer.compareMode')}
            <Badge variant="secondary">{items.length}</Badge>
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="relative p-4 rounded-lg border-2"
              style={{ borderColor: COLORS[index] }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: COLORS[index] }}
                  >
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span className="text-sm font-medium">
                    {isZh ? `推文 ${String.fromCharCode(65 + index)}` : `Tweet ${String.fromCharCode(65 + index)}`}
                  </span>
                </div>
                {items.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Textarea */}
              <Textarea
                placeholder={t('analyzer.inputPlaceholder')}
                value={item.input.content}
                onChange={(e) => updateContent(item.id, e.target.value)}
                className="min-h-[100px] resize-none"
                maxLength={280}
              />
              <div className="flex justify-end text-xs text-slate-500 mt-1">
                {item.input.content.length}/280
              </div>

              {/* Heat Score */}
              {item.result && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame
                        className="w-4 h-4"

                      />
                      <span className="text-sm text-slate-600">
                        {t('analyzer.heatScore')}
                      </span>
                    </div>
                    <span
                      className="font-bold text-lg"

                    >
                      {Math.round(item.result.heatScore)}
                    </span>
                  </div>
                  <Progress
                    value={item.result.heatScore}
                    max={100}
                    className="mt-2 h-2"

                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Button */}
        {items.length < 4 && (
          <Button
            variant="outline"
            onClick={addItem}
            className="w-full border-dashed"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('analyzer.addTweet')}
          </Button>
        )}

        {/* Analyze Button */}
        <Button
          onClick={analyzeAll}
          className="w-full"
          disabled={!items.some((item) => item.input.content.trim())}
        >
          <GitCompare className="w-4 h-4 mr-2" />
          {t('analyzer.analyzeButton')}
        </Button>

        {/* Comparison Chart */}
        {hasResults && validItems.length >= 2 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-semibold mb-4">
              {isZh ? '对比分析' : 'Comparison Analysis'}
            </h3>
            {/* Score Comparison Table */}
            <div className="comparison-table-well">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-900/10">
                    <th className="text-left py-2 pr-4">{isZh ? '指标' : 'Metric'}</th>
                    {validItems.map(({ item, originalIndex }) => (
                      <th
                        key={item.id}
                        className="text-right py-2 px-2"
                        style={{ color: COLORS[originalIndex] }}
                      >
                        {String.fromCharCode(65 + originalIndex)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-900/10">
                    <td className="py-2 pr-4 font-medium">
                      {t('analyzer.heatScore')}
                    </td>
                    {validItems.map(({ item, originalIndex }) => (
                      <td
                        key={item.id}
                        className="text-right py-2 px-2 font-medium"
                        style={{ color: COLORS[originalIndex] }}
                      >
                        {item.result ? Math.round(item.result.heatScore) : '-'}
                      </td>
                    ))}
                  </tr>
                  {positiveKeys.map((key) => (
                    <tr key={key} className="border-b border-slate-900/10">
                      <td className="py-2 pr-4">
                        {isZh ? SCORE_LABELS[key].nameZh : SCORE_LABELS[key].name}
                      </td>
                      {validItems.map(({ item }) => (
                        <td key={item.id} className="text-right py-2 px-2">
                          {item.result
                            ? `${Math.round((item.result.phoenixScores[key] ?? 0) * 100)}%`
                            : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {(Object.keys(CONTINUOUS_OUTPUT_LABELS) as Array<keyof typeof CONTINUOUS_OUTPUT_LABELS>)
                    .map((key) => (
                      <tr key={key} className="border-b border-slate-900/10">
                        <td className="py-2 pr-4">
                          {isZh
                            ? CONTINUOUS_OUTPUT_LABELS[key].nameZh
                            : CONTINUOUS_OUTPUT_LABELS[key].name}
                        </td>
                        {validItems.map(({ item }) => (
                          <td key={item.id} className="text-right py-2 px-2 tabular-nums">
                            {item.result && item.result.phoenixScores[key] !== undefined
                              ? `${item.result.phoenixScores[key].toFixed(3)}${CONTINUOUS_OUTPUT_LABELS[key].unit}`
                              : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
