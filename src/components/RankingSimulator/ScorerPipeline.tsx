import type { PipelineStep, ScorerResult } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';

interface ScorerPipelineProps { steps: PipelineStep[]; currentStepIndex: number; onStepClick?: (index: number) => void; }

export function ScorerPipeline({ steps, currentStepIndex, onStepClick }: ScorerPipelineProps) {
  const { t, isZh } = useTranslation();
  const scorers = steps.filter((step) => step.type === 'scorer');
  return <section className="pipeline-section">
    <div className="section-heading"><h2>{t('simulator.scoringStage')}</h2><small>{scorers.length}</small></div>
    {scorers.map((step) => {
      const index = steps.indexOf(step);
      const summary = (step.details as ScorerResult | undefined)?.summary;
      const active = currentStepIndex === index;
      return <button key={step.id} type="button" className="pipeline-step" aria-pressed={active} data-step-id={step.id}
        data-summary={summary ? JSON.stringify(summary) : undefined} onClick={() => onStepClick?.(index)}>
        <span className="pipeline-step-main"><span className="pipeline-step-name">{isZh ? step.nameZh : step.name}</span><span className="pipeline-step-metric">{step.inputCount} {isZh ? '条' : 'posts'}</span></span>
        {active && <p className="pipeline-step-description">{step.id === 'phoenix'
          ? (isZh ? `${summary?.outputHeadCount} 个默认输出；停留时长以秒计。本地使用可重复的模拟值。` : `${summary?.outputHeadCount} default outputs. Dwell values use seconds. Local values are repeatable fixtures.`)
          : summary?.valueModelMode === 'local-weighted-fallback'
            ? (isZh ? '本地加权与冷启动。服务不可用时跳过多样性、关注外系数和 DPP。' : 'Local fusion and cold-start. Service failure skips diversity, OON factors, and DPP.')
            : (isZh ? `复用加权分 → 多样性 → 关注外系数 → ${summary?.dppEnabled ? 'DPP' : '话题请求跳过 DPP'}` : `Weighted score → diversity → OON factor → ${summary?.dppEnabled ? 'DPP' : 'DPP skipped for topics'}`)}</p>}
      </button>;
    })}
    {!scorers.length && <p className="pipeline-empty">{isZh ? '过滤完成后，查看 Phoenix 和 VMRanker 的评分。' : 'Phoenix and VMRanker scores appear after filtering.'}</p>}
  </section>;
}
