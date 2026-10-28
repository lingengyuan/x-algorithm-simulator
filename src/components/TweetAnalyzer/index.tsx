import { useState } from 'react';
import { TweetInput, AnalysisResult } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { InputForm } from './InputForm';
import { ScoreRadar } from './ScoreRadar';
import { HeatGauge } from './HeatGauge';
import { Suggestions } from './Suggestions';
import { CompareMode } from './CompareMode';
import { simulatePhoenixScores, calculateHeatScore, SCORE_LABELS, CONTINUOUS_OUTPUT_LABELS } from '@/utils/scoring';
import { saveHistory, generateId } from '@/utils/storage';
import { GitCompare, ArrowLeft } from 'lucide-react';

export function TweetAnalyzer() {
  const { t, isZh } = useTranslation();

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [currentInput, setCurrentInput] = useState<TweetInput | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = (input: TweetInput) => {
    const phoenixScores = simulatePhoenixScores(input);
    const heatScore = calculateHeatScore(phoenixScores);

    const analysisResult: AnalysisResult = {
      phoenixScores,
      heatScore,
      suggestions: [],
      filterRisks: [],
    };

    setCurrentInput(input);
    setResult(analysisResult);

    // Save to history
    saveHistory({
      id: generateId(),
      timestamp: Date.now(),
      type: 'single',
      input,
      result: analysisResult,
    });
  };

  return (
    <div>
      <div className="page-heading"><div><h1>{t('common.tweetAnalyzer')}</h1><p>{isZh ? '生成本地测试输出，查看行为概率和停留时长。' : 'Generate local fixture outputs to inspect probabilities and dwell times.'}</p></div>
      <div className="page-heading-actions">
        <Button
          variant={isCompareMode ? 'default' : 'outline'}
          onClick={() => setIsCompareMode(!isCompareMode)}
          className="gap-2"
        >
          {isCompareMode ? (
            <>
              <ArrowLeft className="w-4 h-4" />
              {t('common.reset')}
            </>
          ) : (
            <>
              <GitCompare className="w-4 h-4" />
              {t('analyzer.compareMode')}
            </>
          )}
        </Button>
      </div></div>

      <>
        {isCompareMode ? (
          <div
            key="compare"
          >
            <CompareMode onClose={() => setIsCompareMode(false)} />
          </div>
        ) : (
          <div
            key="single"
            className="analyzer-workbench"
          >
            {/* Input Panel */}
            <div className="analyzer-input">
              <InputForm
                onAnalyze={handleAnalyze}
                onInputChange={() => {
                  setCurrentInput(null);
                  setResult(null);
                }}
                initialValue={currentInput || undefined}
              />
            </div>

            {/* Results Panel */}
            <div className="analyzer-results">
              {result ? (
                <div
                  className="space-y-6"
                >
                  {/* Heat Gauge */}
                  <HeatGauge score={result.heatScore} />

                  {/* Score Radar */}
                  <ScoreRadar scores={result.phoenixScores} />

                  {/* Suggestions */}
                  {currentInput && <Suggestions input={currentInput} />}
                </div>
              ) : (
                <div className="analyzer-empty">
                  <h2>{isZh ? '输出结构' : 'Output contract'}</h2>
                  <p>{isZh ? '填写测试帖子后，查看每项行为的概率和连续输出。下方是字段范围。' : 'Generate a fixture post to inspect behavior probabilities and continuous outputs. The field ranges are shown below.'}</p>
                  <div className="contract-preview">
                    <section><h3>{isZh ? '行为概率' : 'Behavior probabilities'} · {Object.keys(SCORE_LABELS).length}</h3>
                      <dl>{(['favoriteScore','replyScore','retweetScore','shareViaCopyLinkScore','notInterestedScore','reportScore'] as const).map((key) => <div key={key} className="contents"><dt>{isZh ? SCORE_LABELS[key].nameZh : SCORE_LABELS[key].name}</dt><dd>0–100%</dd></div>)}</dl>
                    </section>
                    <section><h3>{isZh ? '连续值' : 'Continuous values'} · {Object.keys(CONTINUOUS_OUTPUT_LABELS).length}</h3>
                      <dl>{Object.values(CONTINUOUS_OUTPUT_LABELS).map((field) => <div key={field.name} className="contents"><dt>{isZh ? field.nameZh : field.name}</dt><dd>{isZh ? '秒' : 'seconds'}</dd></div>)}</dl>
                    </section>
                  </div>
                  <p className="field-note">{isZh ? '数据来自本地模拟，不代表生产模型推理或真实曝光。' : 'Local fixtures illustrate the public contract. They do not predict production reach.'}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    </div>
  );
}
