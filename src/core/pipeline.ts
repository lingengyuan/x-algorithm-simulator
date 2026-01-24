import { TweetCandidate, WeightConfig, FilterContext, PipelineStep, FilterResult, ScorerResult } from './types';
import { FILTERS, runAllFilters, runFilter } from './filters';
import { SCORERS, runAllScorers, runPhoenixScorer, runWeightedScorer, runAuthorDiversityScorer, runOONScorer } from './scorers';

export interface PipelineConfig {
  enabledFilters: string[];
  weights: WeightConfig;
  topK: number;
}

export interface PipelineResult {
  steps: PipelineStep[];
  initialCount: number;
  afterFilterCount: number;
  finalCount: number;
  finalCandidates: TweetCandidate[];
  allCandidates: TweetCandidate[]; // Including filtered ones
}

// Run the complete ranking pipeline
export function runPipeline(
  candidates: TweetCandidate[],
  context: FilterContext,
  config: PipelineConfig
): PipelineResult {
  const steps: PipelineStep[] = [];
  const initialCount = candidates.length;

  // Step 1: Candidate Pool (just for display)
  steps.push({
    id: 'candidate_pool',
    name: 'Candidate Pool',
    nameZh: '候选池',
    description: 'Initial set of candidate tweets',
    descriptionZh: '初始候选推文集合',
    type: 'filter',
    inputCount: initialCount,
    outputCount: initialCount,
  });

  // Step 2: Run filters
  const { results: filterResults, finalCandidates: filteredCandidates } = runAllFilters(
    candidates,
    context,
    config.enabledFilters
  );

  for (const result of filterResults) {
    const filter = FILTERS.find(f => f.id === result.filterId);
    steps.push({
      id: result.filterId,
      name: filter?.name || result.filterName,
      nameZh: filter?.nameZh || result.filterName,
      description: filter?.description || '',
      descriptionZh: filter?.descriptionZh || '',
      type: 'filter',
      inputCount: result.inputCount,
      outputCount: result.outputCount,
      details: result,
    });
  }

  const afterFilterCount = filteredCandidates.length;

  // Step 3: Run scorers
  const { results: scorerResults, finalCandidates } = runAllScorers(
    filteredCandidates,
    config.weights
  );

  for (const result of scorerResults) {
    const scorer = SCORERS.find(s => s.id === result.scorerId);
    steps.push({
      id: result.scorerId,
      name: scorer?.name || result.scorerName,
      nameZh: scorer?.nameZh || result.scorerName,
      description: scorer?.description || '',
      descriptionZh: scorer?.descriptionZh || '',
      type: 'scorer',
      inputCount: afterFilterCount,
      outputCount: afterFilterCount,
      details: result,
    });
  }

  // Step 4: Final ranking
  const topCandidates = finalCandidates.slice(0, config.topK);

  steps.push({
    id: 'final_ranking',
    name: 'Final Ranking',
    nameZh: '最终排序',
    description: `Top ${config.topK} tweets for timeline`,
    descriptionZh: `时间线展示的 Top ${config.topK} 推文`,
    type: 'ranker',
    inputCount: afterFilterCount,
    outputCount: topCandidates.length,
  });

  // Collect all candidates including filtered ones
  const allCandidates = [
    ...topCandidates,
    ...finalCandidates.slice(config.topK),
    ...candidates.filter(c => c.filtered),
  ];

  return {
    steps,
    initialCount,
    afterFilterCount,
    finalCount: topCandidates.length,
    finalCandidates: topCandidates,
    allCandidates,
  };
}

// Run pipeline step by step for animation
export function* runPipelineStepByStep(
  candidates: TweetCandidate[],
  context: FilterContext,
  config: PipelineConfig
): Generator<{ step: PipelineStep; candidates: TweetCandidate[] }> {
  let currentCandidates = [...candidates];

  // Initial pool
  yield {
    step: {
      id: 'candidate_pool',
      name: 'Candidate Pool',
      nameZh: '候选池',
      description: 'Initial set of candidate tweets',
      descriptionZh: '初始候选推文集合',
      type: 'filter',
      inputCount: candidates.length,
      outputCount: candidates.length,
    },
    candidates: currentCandidates,
  };

  // Filters
  for (const filter of FILTERS) {
    if (!config.enabledFilters.includes(filter.id)) continue;

    const result = runFilter(filter.id, currentCandidates, context);
    currentCandidates = result.passedCandidates;

    yield {
      step: {
        id: filter.id,
        name: filter.name,
        nameZh: filter.nameZh,
        description: filter.description,
        descriptionZh: filter.descriptionZh,
        type: 'filter',
        inputCount: result.inputCount,
        outputCount: result.outputCount,
        details: result,
      },
      candidates: currentCandidates,
    };
  }

  // Phoenix scorer
  const phoenixResult = runPhoenixScorer(currentCandidates);
  yield {
    step: {
      id: 'phoenix',
      name: 'Phoenix ML Scorer',
      nameZh: 'Phoenix 机器学习评分器',
      description: 'Predicts 18 user behaviors using ML model',
      descriptionZh: '使用机器学习模型预测 18 种用户行为',
      type: 'scorer',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
      details: phoenixResult,
    },
    candidates: currentCandidates,
  };

  // Weighted scorer
  const { result: weightedResult, updatedCandidates: weightedCandidates } =
    runWeightedScorer(currentCandidates, config.weights);
  currentCandidates = weightedCandidates;

  yield {
    step: {
      id: 'weighted',
      name: 'Weighted Sum Scorer',
      nameZh: '加权求和评分器',
      description: 'Combines Phoenix scores with configurable weights',
      descriptionZh: '使用可配置的权重组合 Phoenix 分数',
      type: 'scorer',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
      details: weightedResult,
    },
    candidates: currentCandidates,
  };

  // Author diversity
  const { result: diversityResult, updatedCandidates: diversityCandidates } =
    runAuthorDiversityScorer(
      currentCandidates,
      config.weights.authorDiversityDecay,
      config.weights.authorDiversityFloor
    );
  currentCandidates = diversityCandidates;

  yield {
    step: {
      id: 'author_diversity',
      name: 'Author Diversity Scorer',
      nameZh: '作者多样性评分器',
      description: 'Applies decay to same-author tweets',
      descriptionZh: '对同一作者的推文应用衰减惩罚',
      type: 'scorer',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
      details: diversityResult,
    },
    candidates: currentCandidates,
  };

  // OON scorer
  const { result: oonResult, updatedCandidates: oonCandidates } = runOONScorer(
    currentCandidates,
    config.weights.oonWeightFactor
  );
  currentCandidates = oonCandidates;

  yield {
    step: {
      id: 'oon',
      name: 'OON Balance Scorer',
      nameZh: '内外网平衡评分器',
      description: 'Balances in-network vs out-of-network content',
      descriptionZh: '平衡关注者内容和推荐内容',
      type: 'scorer',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
      details: oonResult,
    },
    candidates: currentCandidates,
  };

  // Final ranking
  currentCandidates.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
  const topK = currentCandidates.slice(0, config.topK);

  yield {
    step: {
      id: 'final_ranking',
      name: 'Final Ranking',
      nameZh: '最终排序',
      description: `Top ${config.topK} tweets for timeline`,
      descriptionZh: `时间线展示的 Top ${config.topK} 推文`,
      type: 'ranker',
      inputCount: currentCandidates.length,
      outputCount: topK.length,
    },
    candidates: topK,
  };
}
