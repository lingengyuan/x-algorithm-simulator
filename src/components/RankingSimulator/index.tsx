import { useState, useEffect, useCallback, useRef } from 'react';
import { TweetCandidate, PipelineStep, RankingScenario, FilterResult } from '@/core/types';
import { useTranslation } from '@/hooks/useI18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
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
import { FinalRanking } from './FinalRanking';
import { RANKING_SCENARIOS, generateScenarioTweets, getDefaultFilterContext } from '@/data/mockTweets';
import { FILTERS } from '@/core/filters';
import { DEFAULT_WEIGHTS } from '@/data/defaultWeights';
import { runPipelineStepByStep } from '@/core/pipeline';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';

export function RankingSimulator() {
  const { t, isZh } = useTranslation();

  const [selectedScenario, setSelectedScenario] = useState<RankingScenario>(RANKING_SCENARIOS[0]);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentCandidates, setCurrentCandidates] = useState<TweetCandidate[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [selectedTweetId, setSelectedTweetId] = useState<string | undefined>();
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pipelineGeneratorRef = useRef<Generator<{ step: PipelineStep; candidates: TweetCandidate[] }> | null>(null);
  const playIntervalRef = useRef<number | null>(null);

  // Initialize scenario function
  const initializeScenario = useCallback((scenario: RankingScenario) => {
    try {
      const newCandidates = generateScenarioTweets(scenario);
      setCurrentCandidates(newCandidates);
      setSteps([]);
      setCurrentStepIndex(0);
      setIsPlaying(false);

      // Initialize pipeline generator
      const context = getDefaultFilterContext(newCandidates, scenario);
      const config = {
        enabledFilters: FILTERS.filter(f => f.enabled).map(f => f.id),
        weights: DEFAULT_WEIGHTS,
        topK: 10,
      };
      pipelineGeneratorRef.current = runPipelineStepByStep(newCandidates, context, config);

      // Get first step
      const firstResult = pipelineGeneratorRef.current.next();
      if (!firstResult.done && firstResult.value) {
        setSteps([firstResult.value.step]);
        setCurrentCandidates(firstResult.value.candidates);
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
    initializeScenario(selectedScenario);
  }, [selectedScenario, initializeScenario]);

  // Next step function
  const nextStep = useCallback(() => {
    if (!pipelineGeneratorRef.current) return;

    const result = pipelineGeneratorRef.current.next();
    if (result.done) {
      setIsPlaying(false);
      return;
    }

    if (result.value) {
      setSteps((prev) => [...prev, result.value.step]);
      setCurrentCandidates(result.value.candidates);
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, []);

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
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const reset = useCallback(() => {
    initializeScenario(selectedScenario);
  }, [selectedScenario, initializeScenario]);

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleStepClick = (index: number) => {
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

  const filteredCount = steps.reduce((count, step) => {
    if (step.type !== 'filter' || !step.details) {
      return count;
    }

    const details = step.details as FilterResult;
    return count + details.filteredCandidates.length;
  }, 0);
  const currentStep = steps[currentStepIndex];
  const isComplete = steps.length > 0 && steps[steps.length - 1].id === 'final_ranking';

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
          </div>
        </CardContent>
      </Card>

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
        </div>

        {/* Right Column - Final Ranking */}
        <div className="lg:col-span-1">
          {isComplete ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <FinalRanking candidates={currentCandidates} topK={10} />
            </motion.div>
          ) : (
            <Card className="h-full flex items-center justify-center border-dashed border-slate-900/20">
              <CardContent className="text-center py-12">
                <BarChart3 className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                <p className="text-slate-500">
                  {isZh
                    ? '完成所有步骤后显示最终排序'
                    : 'Final ranking will appear after all steps'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
