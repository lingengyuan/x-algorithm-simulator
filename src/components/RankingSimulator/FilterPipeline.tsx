import type { PipelineStep, FilterResult } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';

interface FilterPipelineProps {
  steps: PipelineStep[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
}

export function FilterPipeline({ steps, currentStepIndex, onStepClick }: FilterPipelineProps) {
  const { t, isZh } = useTranslation();
  const filters = steps.filter((step) => step.type === 'filter');
  return <section className="pipeline-section">
    <div className="section-heading"><h2>{t('simulator.filterStage')}</h2><small>{filters.length}</small></div>
    <div className="pipeline-step-list">
      {filters.map((step) => {
        const index = steps.indexOf(step);
        const details = step.details as FilterResult | undefined;
        const active = index === currentStepIndex;
        return <button key={step.id} type="button" className="pipeline-step" aria-pressed={active}
          data-step-id={step.id} data-input-count={step.inputCount} data-output-count={step.outputCount}
          data-kept-sources={step.id === 'fair_share_ranking' ? JSON.stringify(details?.passedCandidates.map((candidate) => candidate.servedType)) : undefined}
          data-removed-sources={step.id === 'fair_share_ranking' ? JSON.stringify(details?.filteredCandidates.map((candidate) => candidate.servedType)) : undefined}
          onClick={() => onStepClick?.(index)}>
          <span className="pipeline-step-main"><span className="pipeline-step-name">{isZh ? step.nameZh : step.name}</span><span className="pipeline-step-metric">{step.inputCount.toLocaleString()} → {step.outputCount.toLocaleString()}</span></span>
          {active && <p className="pipeline-step-description">{isZh ? step.descriptionZh : step.description}</p>}
        </button>;
      })}
      {!filters.length && <p className="pipeline-empty">{isZh ? '过滤决策会随流程逐步出现。' : 'Filter decisions appear as the pipeline advances.'}</p>}
    </div>
  </section>;
}
