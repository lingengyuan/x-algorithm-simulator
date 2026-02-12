import { PipelineStep, ScorerResult } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import { Calculator, CheckCircle, ChevronRight, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface ScorerPipelineProps {
  steps: PipelineStep[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
}

export function ScorerPipeline({ steps, currentStepIndex, onStepClick }: ScorerPipelineProps) {
  const { t, isZh } = useTranslation();

  const scorerSteps = steps.filter((step) => step.type === 'scorer');

  const getStepIcon = (stepId: string) => {
    switch (stepId) {
      case 'phoenix':
        return '🤖';
      case 'weighted':
        return '⚖️';
      case 'author_diversity':
        return '👥';
      case 'oon':
        return '🌐';
      default:
        return '📊';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="w-5 h-5 text-purple-500" />
          {t('simulator.scoringStage')}
          <Badge variant="secondary">{scorerSteps.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {scorerSteps.map((step, index) => {
            const globalIndex = steps.indexOf(step);
            const isActive = globalIndex === currentStepIndex;
            const isPassed = globalIndex < currentStepIndex;
            const scorerResult = step.details as ScorerResult | undefined;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'cursor-pointer rounded-xl border p-3 transition-all',
                  isActive && 'border-sky-300 bg-sky-50',
                  isPassed && 'border-emerald-300 bg-emerald-50',
                  !isActive && !isPassed && 'border-slate-300/60 hover:border-slate-400/70'
                )}
                onClick={() => onStepClick?.(globalIndex)}
              >
                <div className="flex items-center gap-3">
                  {/* Status Icon */}
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-lg',
                      isActive && 'bg-sky-600',
                      isPassed && 'bg-green-500',
                      !isActive && !isPassed && 'bg-slate-200'
                    )}
                  >
                    {isPassed ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : (
                      getStepIcon(step.id)
                    )}
                  </div>

                  {/* Scorer Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {isZh ? step.nameZh : step.name}
                      </span>
                      {isActive && (
                        <Zap className="w-4 h-4 text-sky-600 animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 truncate">
                      {isZh ? step.descriptionZh : step.description}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="text-right text-xs">
                    <div className="text-slate-500">
                      {step.inputCount} {t('simulator.tweets')}
                    </div>
                    {scorerResult && (
                      <div className="text-purple-500 font-medium">
                        {t('simulator.viewDetails')}
                      </div>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>

                {/* Formula Preview */}
                {isActive && step.id === 'weighted' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 border-t border-slate-200 pt-3"
                  >
                    <div className="overflow-x-auto rounded bg-slate-100 p-2 font-mono text-xs text-slate-700">
                      score = Σ(behavior_i × weight_i) + offset
                    </div>
                  </motion.div>
                )}

                {isActive && step.id === 'author_diversity' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 border-t border-slate-200 pt-3"
                  >
                    <div className="overflow-x-auto rounded bg-slate-100 p-2 font-mono text-xs text-slate-700">
                      multiplier = (1 - floor) × decay^position + floor
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
