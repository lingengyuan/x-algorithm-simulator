import { PipelineStep, FilterResult } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/utils/cn';
import { Filter, CheckCircle, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface FilterPipelineProps {
  steps: PipelineStep[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
}

export function FilterPipeline({ steps, currentStepIndex, onStepClick }: FilterPipelineProps) {
  const { t, isZh } = useTranslation();

  const filterSteps = steps.filter((step) => step.type === 'filter');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Filter className="w-5 h-5 text-orange-500" />
          {t('simulator.filterStage')}
          <Badge variant="secondary">{filterSteps.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {filterSteps.map((step, index) => {
            const isActive = steps.indexOf(step) === currentStepIndex;
            const isPassed = steps.indexOf(step) < currentStepIndex;
            const filterResult = step.details as FilterResult | undefined;
            const filteredCount = filterResult
              ? filterResult.inputCount - filterResult.outputCount
              : 0;
            const passRate = filterResult
              ? (filterResult.outputCount / filterResult.inputCount) * 100
              : 100;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'p-3 rounded-lg border cursor-pointer transition-all',
                  isActive && 'border-[#1DA1F2] bg-blue-50',
                  isPassed && 'border-green-300 bg-green-50',
                  !isActive && !isPassed && 'border-gray-200 hover:border-gray-300'
                )}
                onClick={() => onStepClick?.(steps.indexOf(step))}
              >
                <div className="flex items-center gap-3">
                  {/* Status Icon */}
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                      isActive && 'bg-[#1DA1F2] text-white',
                      isPassed && 'bg-green-500 text-white',
                      !isActive && !isPassed && 'bg-gray-200 text-gray-500'
                    )}
                  >
                    {isPassed ? <CheckCircle className="w-4 h-4" /> : index + 1}
                  </div>

                  {/* Filter Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {isZh ? step.nameZh : step.name}
                      </span>
                      {filteredCount > 0 && (
                        <Badge variant="negative" className="text-[10px]">
                          -{filteredCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {isZh ? step.descriptionZh : step.description}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="text-right text-xs">
                    <div className="text-gray-500">
                      {step.inputCount} → {step.outputCount}
                    </div>
                    {filterResult && (
                      <div className={cn(
                        'font-medium',
                        passRate >= 90 ? 'text-green-500' : passRate >= 70 ? 'text-yellow-500' : 'text-red-500'
                      )}>
                        {passRate.toFixed(0)}%
                      </div>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>

                {/* Progress Bar */}
                {filterResult && (
                  <Progress
                    value={passRate}
                    max={100}
                    className="mt-2 h-1"
                    indicatorClassName={cn(
                      passRate >= 90 && 'bg-green-500',
                      passRate >= 70 && passRate < 90 && 'bg-yellow-500',
                      passRate < 70 && 'bg-red-500'
                    )}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
