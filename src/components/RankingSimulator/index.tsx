import { useState, useEffect, useCallback, useRef } from 'react';
import { FeedItem, TweetCandidate, PipelineStep, RankingScenario, FilterResult } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { BLENDING_DEFAULTS } from '@/data/upstreamSnapshot';
import { runPipelineStepByStep } from '@/core/pipeline';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  BarChart3,
  Layers3,
  Shuffle,
} from 'lucide-react';
import { motion } from 'framer-motion';

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
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pipelineGeneratorRef = useRef<Generator<{ step: PipelineStep; candidates: TweetCandidate[]; feedItems?: FeedItem[] }> | null>(null);
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
    setIsPlaying((prev) => !prev);
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Pipeline Explorer
          </p>
          <h1 className="mt-1 text-2xl font-bold flex items-center gap-2 text-slate-900">
            <BarChart3 className="w-6 h-6 text-sky-600" />
            {t('simulator.title')}
          </h1>
          <p className="text-slate-600 text-sm mt-1">{t('simulator.subtitle')}</p>
        </div>

        {/* Scenario Selector */}
        <div className="flex items-center gap-3">
          <Select
            value={selectedScenario.id}
            onValueChange={(id) => {
              const scenario = RANKING_SCENARIOS.find((s) => s.id === id);
              if (scenario) setSelectedScenario(scenario);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('simulator.selectScenario')} />
            </SelectTrigger>
            <SelectContent>
              {RANKING_SCENARIOS.map((scenario) => (
                <SelectItem key={scenario.id} value={scenario.id}>
                  {isZh ? scenario.nameZh : scenario.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Controls */}
      <Card className="border-slate-900/15 bg-[rgba(255,255,255,0.78)]">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={reset}>
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={prevStep}
                disabled={currentStepIndex === 0}
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                variant={isPlaying ? 'destructive' : 'default'}
                onClick={togglePlay}
                className="w-24"
                disabled={isComplete}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    {t('simulator.pause')}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    {t('simulator.play')}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={nextStep}
                disabled={isComplete}
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-4">
              <Badge variant="secondary">
                {t('simulator.step')} {currentStepIndex + 1} {t('simulator.of')} {steps.length || '?'}
              </Badge>
              {currentStep && (
                <Badge variant="outline">
                  {isZh ? currentStep.nameZh : currentStep.name}
                </Badge>
              )}
            </div>

            {/* Speed Control */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">{t('simulator.speed')}:</span>
              <Slider
                value={[playSpeed]}
                onValueChange={([value]) => setPlaySpeed(value)}
                min={0.5}
                max={3}
                step={0.5}
                className="w-24"
              />
              <span className="text-sm font-medium w-8">{playSpeed}x</span>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <Switch
                checked={enableVMRanker}
                onCheckedChange={setEnableVMRanker}
                aria-label={isZh ? '启用 VMRanker DPP' : 'Enable VMRanker DPP'}
              />
              <div className="text-xs leading-tight">
                <div className="font-semibold text-slate-700">
                  {isZh ? 'VMRanker DPP' : 'VMRanker DPP'}
                </div>
                <div className="text-slate-500">
                  {enableVMRanker ? (isZh ? '公开默认开启' : 'Published default') : (isZh ? '手动关闭' : 'Manually off')}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Layers3 className="h-4 w-4 text-sky-600" />
            {isZh ? 'Scored Posts 层' : 'Scored Posts Layer'}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {isZh
              ? '先完成帖子召回、过滤、评分和排序。'
              : 'Ranks post candidates before final timeline blending.'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Shuffle className="h-4 w-4 text-violet-600" />
            {isZh ? 'For You 混排层' : 'For You Blend Layer'}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">
              {isZh ? '帖子' : 'Posts'} {feedModuleCounts?.post ?? 0}
            </Badge>
            <Badge variant="secondary">
              {isZh ? '广告' : 'Ads'} {feedModuleCounts?.ad ?? 0}
            </Badge>
            <Badge variant="secondary">
              {isZh ? '推荐关注' : 'Who to follow'} {feedModuleCounts?.who_to_follow ?? 0}
            </Badge>
            <Badge variant="secondary">
              {isZh ? '提示' : 'Prompt'} {feedModuleCounts?.prompt ?? 0}
            </Badge>
            <Badge variant="secondary">
              {isZh ? '置顶' : 'Push'} {feedModuleCounts?.push_to_home ?? 0}
            </Badge>
            <Badge variant="secondary">
              {isZh ? '框架' : 'Frames'} {feedModuleCounts?.frame ?? 0}
            </Badge>
            <Badge variant="secondary">
              {isZh ? '问卷' : 'Survey'} {feedModuleCounts?.feed_survey ?? 0}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Candidate Pool */}
        <div className="lg:col-span-1">
          <CandidatePool
            candidates={currentCandidates}
            filteredCount={filteredCount}
            selectedId={selectedTweetId}
            onSelect={setSelectedTweetId}
            showFiltered={false}
          />
        </div>

        {/* Middle Column - Pipeline */}
        <div className="lg:col-span-1 space-y-4">
          <FilterPipeline
            steps={steps}
            currentStepIndex={currentStepIndex}
            onStepClick={handleStepClick}
          />
          <ScorerPipeline
            steps={steps}
            currentStepIndex={currentStepIndex}
            onStepClick={handleStepClick}
          />
          <SideEffectPipeline
            steps={steps}
            currentStepIndex={currentStepIndex}
            onStepClick={handleStepClick}
          />
        </div>

        {/* Right Column - Final Timeline */}
        <div className="lg:col-span-1">
          {isComplete ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <FinalRanking
                candidates={currentCandidates}
                feedItems={currentFeedItems}
                topK={BLENDING_DEFAULTS.resultSize}
              />
            </motion.div>
          ) : (
            <Card className="h-full flex items-center justify-center border-dashed border-slate-900/20">
              <CardContent className="text-center py-12">
                <BarChart3 className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                <p className="text-slate-500">
                  {isZh
                    ? '完成所有步骤后显示最终首页流'
                    : 'Final timeline will appear after all steps'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
