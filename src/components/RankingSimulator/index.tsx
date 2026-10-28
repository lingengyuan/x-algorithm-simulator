import { useState, useEffect, useCallback, useRef } from 'react';
import { FeedItem, TweetCandidate, PipelineStep, RankingScenario, FilterResult } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CandidatePool } from './CandidatePool';
import { FilterPipeline } from './FilterPipeline';
import { ScorerPipeline } from './ScorerPipeline';
import { SideEffectPipeline } from './SideEffectPipeline';
import { FinalRanking } from './FinalRanking';
import { RANKING_SCENARIOS, generateScenarioTweets, getDefaultFilterContext } from '@/data/mockTweets';
import { FILTERS } from '@/core/filters';
import { DEFAULT_WEIGHTS } from '@/data/defaultWeights';
import { BLENDING_DEFAULTS, UPSTREAM_SNAPSHOT } from '@/data/upstreamSnapshot';
import { runPipelineStepByStep, type PipelineFrame, type PipelineTrace } from '@/core/pipeline';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Download,
} from 'lucide-react';

export function RankingSimulator() {
  const { t, isZh } = useTranslation();

  const [selectedScenario, setSelectedScenario] = useState<RankingScenario>(
    () => RANKING_SCENARIOS.find((scenario) => scenario.id === 'for_you') || RANKING_SCENARIOS[0]
  );
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [stepSnapshots, setStepSnapshots] = useState<Array<{ candidates: TweetCandidate[]; feedItems?: FeedItem[] }>>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentCandidates, setCurrentCandidates] = useState<TweetCandidate[]>([]);
  const [currentFeedItems, setCurrentFeedItems] = useState<FeedItem[] | undefined>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [enableVMRanker, setEnableVMRanker] = useState(DEFAULT_WEIGHTS.enableVMRanker);
  const [selectedTweetId, setSelectedTweetId] = useState<string | undefined>();
  const [activePane, setActivePane] = useState('candidates');
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pipelineGeneratorRef = useRef<Generator<PipelineFrame> | null>(null);
  const traceRef = useRef<PipelineTrace | undefined>(undefined);
  const playIntervalRef = useRef<number | null>(null);

  // Initialize scenario function
  const initializeScenario = useCallback((scenario: RankingScenario, useVMRanker: boolean) => {
    try {
      const newCandidates = generateScenarioTweets(scenario);
      setCurrentCandidates(newCandidates);
      setCurrentFeedItems(undefined);
      setSteps([]);
      setStepSnapshots([]);
      setCurrentStepIndex(0);
      setIsPlaying(false);
      setActivePane('candidates');
      traceRef.current = undefined;

      // Initialize pipeline generator
      const context = getDefaultFilterContext(newCandidates, scenario);
      const config = {
        enabledFilters: FILTERS.filter(f => f.enabled).map(f => f.id),
        weights: {
          ...DEFAULT_WEIGHTS,
          enableVMRanker: useVMRanker,
        },
        topK: BLENDING_DEFAULTS.topKPosts,
      };
      pipelineGeneratorRef.current = runPipelineStepByStep(newCandidates, context, config);

      // Get first step
      const firstResult = pipelineGeneratorRef.current.next();
      if (!firstResult.done && firstResult.value) {
        setSteps([firstResult.value.step]);
        setCurrentCandidates(firstResult.value.candidates);
        setCurrentFeedItems(firstResult.value.feedItems);
        setStepSnapshots([{
          candidates: firstResult.value.candidates,
          feedItems: firstResult.value.feedItems,
        }]);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to initialize scenario:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
    setInitialized(true);
  }, []);

  // Initialize scenario when selected
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    initializeScenario(selectedScenario, enableVMRanker);
  }, [selectedScenario, enableVMRanker, initializeScenario]);

  // Next step function
  const nextStep = useCallback(() => {
    if (!pipelineGeneratorRef.current) return;

    if (currentStepIndex < stepSnapshots.length - 1) {
      const targetIndex = currentStepIndex + 1;
      setActivePane(steps[targetIndex]?.id === 'final_ranking' ? 'timeline' : 'pipeline');
      const snapshot = stepSnapshots[targetIndex];
      setCurrentCandidates(snapshot.candidates);
      setCurrentFeedItems(snapshot.feedItems);
      setCurrentStepIndex(targetIndex);
      if (steps[targetIndex]?.id === 'final_ranking') {
        setIsPlaying(false);
      }
      return;
    }

    const result = pipelineGeneratorRef.current.next();
    if (result.done) {
      setIsPlaying(false);
      return;
    }

    if (result.value) {
      setActivePane(result.value.step.id === 'final_ranking' ? 'timeline' : 'pipeline');
      if (result.value.trace) traceRef.current = result.value.trace;
      setSteps((prev) => [...prev, result.value.step]);
      setStepSnapshots((prev) => [
        ...prev,
        {
          candidates: result.value.candidates,
          feedItems: result.value.feedItems,
        },
      ]);
      setCurrentCandidates(result.value.candidates);
      setCurrentFeedItems(result.value.feedItems);
      setCurrentStepIndex((prev) => prev + 1);
      if (result.value.step.id === 'final_ranking') {
        setIsPlaying(false);
      }
    }
  }, [currentStepIndex, stepSnapshots, steps]);

  // Auto-play logic
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = window.setInterval(() => {
        nextStep();
      }, 1500 / playSpeed);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, playSpeed, nextStep]);

  const prevStep = useCallback(() => {
    setActivePane('pipeline');
    if (currentStepIndex > 0) {
      const targetIndex = currentStepIndex - 1;
      const snapshot = stepSnapshots[targetIndex];
      if (snapshot) {
        setCurrentCandidates(snapshot.candidates);
        setCurrentFeedItems(snapshot.feedItems);
      }
      setCurrentStepIndex(targetIndex);
    }
  }, [currentStepIndex, stepSnapshots]);

  const reset = useCallback(() => {
    initializeScenario(selectedScenario, enableVMRanker);
  }, [selectedScenario, enableVMRanker, initializeScenario]);

  const togglePlay = () => {
    setActivePane('pipeline');
    setIsPlaying((prev) => !prev);
  };

  const exportTrace = () => {
    if (!traceRef.current) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(traceRef.current)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `x-pipeline-${selectedScenario.id}-${traceRef.current.upstream.shortCommit}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleStepClick = (index: number) => {
    const snapshot = stepSnapshots[index];
    if (snapshot) {
      setCurrentCandidates(snapshot.candidates);
      setCurrentFeedItems(snapshot.feedItems);
    }
    setCurrentStepIndex(index);
  };

  // Show error if any
  if (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-red-500 mb-4">Error</h2>
        <p className="mb-4 text-slate-600">{error}</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    );
  }

  // Don't render until initialized
  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">{t('common.loading')}</div>
      </div>
    );
  }

  const filteredCount = steps.slice(0, currentStepIndex + 1).reduce((count, step) => {
    if (step.type !== 'filter' || !step.details) {
      return count;
    }

    const details = step.details as FilterResult;
    return count + details.filteredCandidates.length;
  }, 0);
  const currentStep = steps[currentStepIndex];
  const isComplete = currentStep?.id === 'final_ranking';
  const feedModuleCounts = currentFeedItems?.reduce(
    (counts, item) => ({
      ...counts,
      [item.type]: counts[item.type] + 1,
    }),
    {
      post: 0,
      ad: 0,
      who_to_follow: 0,
      prompt: 0,
      push_to_home: 0,
      frame: 0,
      feed_survey: 0,
    }
  );

  const visibleSteps = steps.slice(0, currentStepIndex + 1);
  const afterFilters = visibleSteps.find((item) => item.id === 'fair_share_ranking')?.outputCount;
  const panes = [
    { id: 'candidates', label: t('simulator.candidatePool') },
    { id: 'pipeline', label: isZh ? '流程与决策' : 'Pipeline decisions' },
    { id: 'timeline', label: isZh ? '最终信息流' : 'Final timeline' },
  ];
  return <div>
    <div className="page-heading simulator-heading">
      <div><h1>{t('simulator.title')}</h1><p>{isZh ? '逐步查看候选帖子如何进入 For You 信息流。' : 'Follow candidates from retrieval to the final For You timeline.'}</p></div>
      <div className="page-heading-actions">
        <Select value={selectedScenario.id} onValueChange={(id) => {
          const scenario = RANKING_SCENARIOS.find((item) => item.id === id);
          if (scenario) { setSelectedScenario(scenario); setActivePane('candidates'); }
        }}>
          <SelectTrigger className="w-[240px]" aria-label={t('simulator.selectScenario')}><SelectValue /></SelectTrigger>
          <SelectContent>{RANKING_SCENARIOS.map((scenario) => <SelectItem key={scenario.id} value={scenario.id}>{isZh ? scenario.nameZh : scenario.name}</SelectItem>)}</SelectContent>
        </Select>
        {isComplete && <Button variant="outline" onClick={exportTrace} data-testid="export-trace"><Download size={14} />{isZh ? '导出流程 JSON' : 'Export pipeline JSON'}</Button>}
      </div>
    </div>
    <div className="simulator-toolbar">
      <div className="playback-buttons">
        <Button variant="outline" size="icon" onClick={reset} aria-label={isZh ? '重新开始' : 'Restart'}><RotateCcw size={15} /></Button>
        <Button variant="outline" size="icon" onClick={prevStep} disabled={currentStepIndex === 0} aria-label={isZh ? '上一步' : 'Previous step'}><SkipBack size={15} /></Button>
        <Button data-testid="playback-toggle" onClick={togglePlay} disabled={isComplete}>{isPlaying ? <Pause size={14} /> : <Play size={14} />}{isPlaying ? t('simulator.pause') : t('simulator.play')}</Button>
        <Button variant="outline" size="icon" onClick={nextStep} disabled={isComplete} aria-label={isZh ? '下一步' : 'Next step'}><SkipForward size={15} /></Button>
      </div>
      <div className="playback-progress">
        <span data-testid="pipeline-progress" data-step={currentStep?.id}>{t('simulator.step')} {currentStepIndex + 1} {t('simulator.of')} {steps.length}</span>
        <span className="current-step-name">{isZh ? currentStep?.nameZh : currentStep?.name}</span>
      </div>
      <div className="speed-control"><span>{t('simulator.speed')}</span><Slider aria-label={t('simulator.speed')} value={[playSpeed]} onValueChange={([value]) => setPlaySpeed(value)} min={0.5} max={3} step={0.5} /><span>{playSpeed}×</span></div>
      <label className="service-control"><Switch checked={enableVMRanker} onCheckedChange={setEnableVMRanker} aria-label={isZh ? 'VMRanker 服务可用' : 'VMRanker service available'} /><span>VMRanker<br /><span className="text-slate-600">{enableVMRanker ? (isZh ? '服务正常' : 'Service available') : (isZh ? '本地回退' : 'Local fallback')}</span></span></label>
    </div>
    <dl className="pipeline-summary" aria-label={isZh ? '推荐流程概况' : 'Pipeline overview'}>
      <div data-current={!afterFilters}><dt>{isZh ? '输入候选' : 'Input candidates'}</dt><dd>{selectedScenario.candidateCount.toLocaleString()}<small>{isZh ? '本地测试帖子' : 'fixture posts'}</small></dd></div>
      <div data-current={afterFilters !== undefined && !isComplete}><dt>{isZh ? '进入评分' : 'Ready for scoring'}</dt><dd>{afterFilters?.toLocaleString() ?? '—'}<small>{isZh ? '过滤后保留' : 'after filtering'}</small></dd></div>
      <div data-current={isComplete}><dt>{isZh ? '最终信息流' : 'Final timeline'}</dt><dd>{currentFeedItems?.length ?? '—'}<small>{isComplete ? (isZh ? `${feedModuleCounts?.post ?? 0} 帖子 · ${feedModuleCounts?.ad ?? 0} 广告` : `${feedModuleCounts?.post ?? 0} posts · ${feedModuleCounts?.ad ?? 0} ads`) : (isZh ? '等待混排' : 'awaiting blending')}</small></dd></div>
    </dl>
    <div className="workspace-tabs" role="tablist" aria-label={isZh ? '工作区视图' : 'Workspace view'}>{panes.map((pane) => <button key={pane.id} role="tab" aria-selected={activePane === pane.id} aria-controls={`pane-${pane.id}`} onClick={() => setActivePane(pane.id)}>{pane.label}</button>)}</div>
    <div className="simulator-panes">
      <div className="simulator-pane" id="pane-candidates" data-active={activePane === 'candidates'}>
        <CandidatePool candidates={currentCandidates} filteredCount={filteredCount} selectedId={selectedTweetId} onSelect={setSelectedTweetId} showFiltered={false} />
      </div>
      <section className="simulator-pane" id="pane-pipeline" data-active={activePane === 'pipeline'}>
        <div className="current-stage"><h2>{isZh ? '当前阶段' : 'Current stage'}</h2><p>{isZh ? currentStep?.nameZh : currentStep?.name}</p><div className="stage-counts">{currentStep?.inputCount.toLocaleString()} <span>→</span> {currentStep?.outputCount.toLocaleString()} <span>{isZh ? '条' : 'posts'}</span></div></div>
        <FilterPipeline steps={steps} currentStepIndex={currentStepIndex} onStepClick={handleStepClick} />
        <ScorerPipeline steps={steps} currentStepIndex={currentStepIndex} onStepClick={handleStepClick} />
        <SideEffectPipeline steps={steps} currentStepIndex={currentStepIndex} onStepClick={handleStepClick} />
      </section>
      <div className="simulator-pane" id="pane-timeline" data-active={activePane === 'timeline'}>
        {isComplete ? <FinalRanking candidates={currentCandidates} feedItems={currentFeedItems} topK={BLENDING_DEFAULTS.resultSize} /> : <Card>
          <CardHeader><CardTitle>{isZh ? '最终信息流' : 'Final timeline'}</CardTitle></CardHeader>
          <CardContent><p className="timeline-empty">{isZh ? '完成评分和混排后，查看帖子顺序及插入的模块。' : 'Finish scoring and blending to inspect post order and inserted modules.'}</p>
            <div className="section-heading"><h2>{isZh ? '当前配置' : 'Current configuration'}</h2></div>
            <dl className="configuration-list"><div><dt>{isZh ? '上游提交' : 'Upstream commit'}</dt><dd>{UPSTREAM_SNAPSHOT.shortCommit}</dd></div>
              <div><dt>{isZh ? '点赞权重' : 'Like weight'}</dt><dd>{DEFAULT_WEIGHTS.favoriteWeight}</dd></div><div><dt>{isZh ? '回复权重' : 'Reply weight'}</dt><dd>{DEFAULT_WEIGHTS.replyWeight}</dd></div>
              <div><dt>{isZh ? '点击后停留权重' : 'Click-dwell weight'}</dt><dd>{DEFAULT_WEIGHTS.clickDwellTimeWeight}</dd></div><div><dt>{isZh ? '单次信息流帖子数' : 'Feed post limit'}</dt><dd>{BLENDING_DEFAULTS.resultSize}</dd></div></dl>
          </CardContent></Card>}
      </div>
    </div>
  </div>;
}
