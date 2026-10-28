import type { PipelineStep, SideEffectResult } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
interface SideEffectPipelineProps { steps: PipelineStep[]; currentStepIndex: number; onStepClick?: (index: number) => void; }
export function SideEffectPipeline({ steps }: SideEffectPipelineProps) {
  const { isZh } = useTranslation();
  const effects = steps.filter((step) => step.type === 'side_effect');
  if (!effects.length) return null;
  return <details className="side-effects pipeline-section">
    <summary>{isZh ? '外部副作用检查点' : 'External side-effect checkpoints'} · {effects.length}</summary>
    <p className="field-note">{isZh ? '本地仅记录检查点，不执行外部写入。' : 'Local execution records checkpoints without external writes.'}</p>
    {effects.map((step) => <ul key={step.id}>{(step.details as SideEffectResult)?.actions.map((action) => <li key={action.name}>{action.name}</li>)}</ul>)}
  </details>;
}
