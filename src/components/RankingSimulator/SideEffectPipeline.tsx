import { PipelineStep, SideEffectResult } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import { Activity, CheckCircle, ChevronRight, Database } from 'lucide-react';
import { motion } from 'framer-motion';

interface SideEffectPipelineProps {
  steps: PipelineStep[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
}

export function SideEffectPipeline({ steps, currentStepIndex, onStepClick }: SideEffectPipelineProps) {
  const { isZh } = useTranslation();
  const sideEffectSteps = steps.filter((step) => step.type === 'side_effect');

  if (!sideEffectSteps.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-600" />
          {isZh ? '副作用记录' : 'Side Effects'}
          <Badge variant="secondary">{sideEffectSteps.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sideEffectSteps.map((step, index) => {
            const globalIndex = steps.indexOf(step);
            const isActive = globalIndex === currentStepIndex;
            const isPassed = globalIndex < currentStepIndex;
            const details = step.details as SideEffectResult | undefined;

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
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                      isActive && 'bg-sky-600 text-white',
                      isPassed && 'bg-green-500 text-white',
                      !isActive && !isPassed && 'bg-slate-200 text-slate-600'
                    )}
                  >
                    {isPassed ? <CheckCircle className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {isZh ? step.nameZh : step.name}
                    </div>
                    <p className="text-xs text-slate-600 truncate">
                      {isZh ? step.descriptionZh : step.description}
                    </p>
                  </div>

                  <div className="text-right text-xs">
                    <div className="text-slate-500">
                      {step.outputCount} {isZh ? '项' : 'items'}
                    </div>
                    {details && (
                      <div className="text-cyan-600 font-medium">
                        {details.actions.length} {isZh ? '动作' : 'actions'}
                      </div>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>

                {isActive && details && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 border-t border-slate-200 pt-3"
                  >
                    <div className="space-y-1">
                      {details.actions.map((action) => (
                        <div
                          key={action.name}
                          className="flex items-center justify-between gap-3 rounded bg-slate-100 px-2 py-1 text-xs"
                        >
                          <span className="truncate font-medium text-slate-700">
                            {isZh ? action.nameZh : action.name}
                          </span>
                          <span className="font-mono text-cyan-700">{action.count}</span>
                        </div>
                      ))}
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
