import { useState } from 'react';
import { TweetInput, AnalysisResult } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { InputForm } from './InputForm';
import { ScoreRadar } from './ScoreRadar';
import { HeatGauge } from './HeatGauge';
import { Suggestions } from './Suggestions';
import { CompareMode } from './CompareMode';
import { simulatePhoenixScores, calculateHeatScore } from '@/utils/scoring';
import { saveHistory, generateId } from '@/utils/storage';
import { GitCompare, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function TweetAnalyzer() {
  const { t } = useTranslation();

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
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex justify-end">
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
      </div>

      <AnimatePresence mode="wait">
        {isCompareMode ? (
          <motion.div
            key="compare"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <CompareMode onClose={() => setIsCompareMode(false)} />
          </motion.div>
        ) : (
          <motion.div
            key="single"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Input Panel */}
            <div className="lg:col-span-1">
              <InputForm onAnalyze={handleAnalyze} initialValue={currentInput || undefined} />
            </div>

            {/* Results Panel */}
            <div className="lg:col-span-2">
              {result ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Heat Gauge */}
                  <HeatGauge score={result.heatScore} />

                  {/* Score Radar */}
                  <ScoreRadar scores={result.phoenixScores} />

                  {/* Suggestions */}
                  {currentInput && <Suggestions input={currentInput} />}
                </motion.div>
              ) : (
                <div className="flex items-center justify-center h-[400px] bg-white rounded-xl border border-gray-200">
                  <div className="text-center text-gray-400">
                    <p className="text-lg font-medium">
                      {t('analyzer.subtitle')}
                    </p>
                    <p className="text-sm mt-2">
                      {t('analyzer.inputPlaceholder')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
