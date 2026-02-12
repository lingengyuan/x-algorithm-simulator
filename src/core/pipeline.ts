import {
  TweetCandidate,
  WeightConfig,
  FilterContext,
  PipelineStep,
} from './types';
import {
  FILTERS,
  PRE_SCORING_FILTERS,
  POST_SELECTION_FILTERS,
  runAllFilters,
  runPostSelectionFilters,
  runFilter,
} from './filters';
import {
  SCORERS,
  runAllScorers,
  runPhoenixScorer,
  runWeightedScorer,
  runAuthorDiversityScorer,
  runOONScorer,
} from './scorers';

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
  allCandidates: TweetCandidate[];
}

function dedupeById(candidates: TweetCandidate[]): TweetCandidate[] {
  const seenIds = new Set<string>();
  const merged: TweetCandidate[] = [];

  for (const candidate of candidates) {
    if (seenIds.has(candidate.id)) {
      continue;
    }
    seenIds.add(candidate.id);
    merged.push(candidate);
  }

  return merged;
}

function sourceThunder(candidates: TweetCandidate[], context: FilterContext): TweetCandidate[] {
  return candidates
    .filter(
      (candidate) =>
        candidate.inNetwork ||
        candidate.authorId === context.currentUserId ||
        context.followedAuthorIds.includes(candidate.authorId)
    )
    .map((candidate) => ({
      ...candidate,
      inNetwork: true,
      servedType: 'for_you_in_network',
      filtered: false,
      filteredBy: undefined,
      filterReason: undefined,
    }));
}

function sourcePhoenix(candidates: TweetCandidate[], context: FilterContext): TweetCandidate[] {
  if (context.inNetworkOnly) {
    return [];
  }

  return candidates
    .filter((candidate) => !candidate.inNetwork)
    .map((candidate) => ({
      ...candidate,
      servedType: 'for_you_phoenix_retrieval',
      filtered: false,
      filteredBy: undefined,
      filterReason: undefined,
    }));
}

function hydrateInNetwork(candidates: TweetCandidate[], context: FilterContext): TweetCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    inNetwork:
      candidate.authorId === context.currentUserId ||
      context.followedAuthorIds.includes(candidate.authorId) ||
      candidate.servedType === 'for_you_in_network',
  }));
}

function hydrateCoreData(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    content: candidate.content || '',
    authorId: candidate.authorId || '',
  }));
}

function hydrateVideoDuration(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate) => {
    if (!candidate.hasVideo) {
      return candidate;
    }

    if (candidate.videoDurationMs && candidate.videoDurationMs > 0) {
      return candidate;
    }

    return {
      ...candidate,
      videoDurationMs: 15000,
    };
  });
}

function hydrateSubscription(candidates: TweetCandidate[]): TweetCandidate[] {
  return candidates.map((candidate, index) => {
    if (candidate.subscriptionAuthorId) {
      return candidate;
    }

    // Mark a small deterministic subset as subscription-only.
    if (index % 11 === 0) {
      return {
        ...candidate,
        subscriptionAuthorId: candidate.authorId,
      };
    }

    return candidate;
  });
}

function hydrateVisibility(candidates: TweetCandidate[]): TweetCandidate[] {
  const blockedTerms = ['gore', 'violence', 'graphic', 'explicit scam'];

  return candidates.map((candidate) => {
    const content = candidate.content.toLowerCase();
    const flaggedByText = blockedTerms.some((term) => content.includes(term));

    return {
      ...candidate,
      visibilityFiltered: candidate.visibilityFiltered || flaggedByText,
    };
  });
}

function sortByFinalScore(candidates: TweetCandidate[]): TweetCandidate[] {
  return [...candidates].sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
}

// Run the complete ranking pipeline
export function runPipeline(
  rawCandidates: TweetCandidate[],
  context: FilterContext,
  config: PipelineConfig
): PipelineResult {
  const steps: PipelineStep[] = [];
  const initialCount = rawCandidates.length;

  steps.push({
    id: 'candidate_pool',
    name: 'Candidate Pool',
    nameZh: '候选池',
    description: 'Initial raw candidate corpus',
    descriptionZh: '初始原始候选集合',
    type: 'source',
    inputCount: initialCount,
    outputCount: initialCount,
  });

  steps.push({
    id: 'query_hydrator_user_action_seq',
    name: 'UserActionSeqQueryHydrator',
    nameZh: '用户行为序列补全器',
    description: 'Hydrate user action sequence for retrieval and ranking',
    descriptionZh: '补全用户行为序列用于召回和打分',
    type: 'query_hydrator',
    inputCount: initialCount,
    outputCount: initialCount,
  });

  steps.push({
    id: 'query_hydrator_user_features',
    name: 'UserFeaturesQueryHydrator',
    nameZh: '用户特征补全器',
    description: 'Hydrate user features (follow graph, mute/block, subscription)',
    descriptionZh: '补全用户特征（关注关系、静音/屏蔽、订阅）',
    type: 'query_hydrator',
    inputCount: initialCount,
    outputCount: initialCount,
  });

  const thunderCandidates = sourceThunder(rawCandidates, context);
  const phoenixCandidates = sourcePhoenix(rawCandidates, context);
  let candidates = dedupeById([...thunderCandidates, ...phoenixCandidates]);

  steps.push({
    id: 'source_thunder',
    name: 'ThunderSource',
    nameZh: 'Thunder 内网源',
    description: 'Retrieve in-network posts',
    descriptionZh: '召回内网（关注网络）内容',
    type: 'source',
    inputCount: initialCount,
    outputCount: thunderCandidates.length,
  });

  steps.push({
    id: 'source_phoenix',
    name: 'PhoenixSource',
    nameZh: 'Phoenix 外网源',
    description: 'Retrieve out-of-network posts',
    descriptionZh: '召回外网探索内容',
    type: 'source',
    inputCount: initialCount,
    outputCount: phoenixCandidates.length,
  });

  steps.push({
    id: 'source_merge',
    name: 'Source Merge',
    nameZh: '召回源合并',
    description: 'Merge source outputs and deduplicate IDs',
    descriptionZh: '合并召回结果并按 ID 去重',
    type: 'source',
    inputCount: thunderCandidates.length + phoenixCandidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateInNetwork(candidates, context);
  steps.push({
    id: 'hydrator_in_network',
    name: 'InNetworkCandidateHydrator',
    nameZh: '内外网标注补全器',
    description: 'Hydrate in-network flag per candidate',
    descriptionZh: '补全候选的内外网标记',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateCoreData(candidates);
  steps.push({
    id: 'hydrator_core_data',
    name: 'CoreDataCandidateHydrator',
    nameZh: '核心数据补全器',
    description: 'Hydrate core tweet metadata',
    descriptionZh: '补全推文核心元数据',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateVideoDuration(candidates);
  steps.push({
    id: 'hydrator_video_duration',
    name: 'VideoDurationCandidateHydrator',
    nameZh: '视频时长补全器',
    description: 'Hydrate video duration for VQV gating',
    descriptionZh: '补全视频时长用于 VQV 权重控制',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateSubscription(candidates);
  steps.push({
    id: 'hydrator_subscription',
    name: 'SubscriptionHydrator',
    nameZh: '订阅关系补全器',
    description: 'Hydrate subscription-only author metadata',
    descriptionZh: '补全订阅内容作者信息',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  candidates = hydrateVisibility(candidates);
  steps.push({
    id: 'hydrator_vf',
    name: 'VFCandidateHydrator',
    nameZh: '可见性补全器',
    description: 'Hydrate visibility filtering hints',
    descriptionZh: '补全可见性过滤信号',
    type: 'hydrator',
    inputCount: candidates.length,
    outputCount: candidates.length,
  });

  const { results: preFilterResults, finalCandidates: preFilteredCandidates, filteredCandidates: preFilteredOut } =
    runAllFilters(candidates, context, config.enabledFilters);

  for (const result of preFilterResults) {
    const filter = FILTERS.find((item) => item.id === result.filterId);
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

  const afterFilterCount = preFilteredCandidates.length;

  const { results: scorerResults, finalCandidates: scoredCandidates } = runAllScorers(
    preFilteredCandidates,
    config.weights
  );

  for (const result of scorerResults) {
    const scorer = SCORERS.find((item) => item.id === result.scorerId);
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

  const selectedCandidates = sortByFinalScore(scoredCandidates).slice(0, config.topK);
  steps.push({
    id: 'selector_top_k',
    name: 'TopKScoreSelector',
    nameZh: 'TopK 选择器',
    description: `Select top ${config.topK} by final score`,
    descriptionZh: `按最终分数选择 Top ${config.topK}`,
    type: 'selector',
    inputCount: scoredCandidates.length,
    outputCount: selectedCandidates.length,
  });

  const {
    results: postFilterResults,
    finalCandidates: postFilteredCandidates,
    filteredCandidates: postFilteredOut,
  } = runPostSelectionFilters(selectedCandidates, context, config.enabledFilters);

  for (const result of postFilterResults) {
    const filter = FILTERS.find((item) => item.id === result.filterId);
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

  const finalCandidates = sortByFinalScore(postFilteredCandidates);
  steps.push({
    id: 'final_ranking',
    name: 'Final Ranking',
    nameZh: '最终排序',
    description: 'Final ranked timeline after post-selection filters',
    descriptionZh: '后置过滤后的最终时间线排序',
    type: 'ranker',
    inputCount: selectedCandidates.length,
    outputCount: finalCandidates.length,
  });

  const allCandidates = [
    ...finalCandidates,
    ...postFilteredOut,
    ...preFilteredOut,
    ...scoredCandidates.filter(
      (candidate) => !selectedCandidates.some((selected) => selected.id === candidate.id)
    ),
  ];

  return {
    steps,
    initialCount,
    afterFilterCount,
    finalCount: finalCandidates.length,
    finalCandidates,
    allCandidates,
  };
}

// Run pipeline step by step for animation
export function* runPipelineStepByStep(
  rawCandidates: TweetCandidate[],
  context: FilterContext,
  config: PipelineConfig
): Generator<{ step: PipelineStep; candidates: TweetCandidate[] }> {
  let currentCandidates = [...rawCandidates];

  yield {
    step: {
      id: 'candidate_pool',
      name: 'Candidate Pool',
      nameZh: '候选池',
      description: 'Initial raw candidate corpus',
      descriptionZh: '初始原始候选集合',
      type: 'source',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };

  yield {
    step: {
      id: 'query_hydrator_user_action_seq',
      name: 'UserActionSeqQueryHydrator',
      nameZh: '用户行为序列补全器',
      description: 'Hydrate user action sequence for retrieval and ranking',
      descriptionZh: '补全用户行为序列用于召回和打分',
      type: 'query_hydrator',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };

  yield {
    step: {
      id: 'query_hydrator_user_features',
      name: 'UserFeaturesQueryHydrator',
      nameZh: '用户特征补全器',
      description: 'Hydrate user features (follow graph, mute/block, subscription)',
      descriptionZh: '补全用户特征（关注关系、静音/屏蔽、订阅）',
      type: 'query_hydrator',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };

  const thunderCandidates = sourceThunder(currentCandidates, context);
  yield {
    step: {
      id: 'source_thunder',
      name: 'ThunderSource',
      nameZh: 'Thunder 内网源',
      description: 'Retrieve in-network posts',
      descriptionZh: '召回内网（关注网络）内容',
      type: 'source',
      inputCount: currentCandidates.length,
      outputCount: thunderCandidates.length,
    },
    candidates: thunderCandidates,
  };

  const phoenixCandidates = sourcePhoenix(currentCandidates, context);
  yield {
    step: {
      id: 'source_phoenix',
      name: 'PhoenixSource',
      nameZh: 'Phoenix 外网源',
      description: 'Retrieve out-of-network posts',
      descriptionZh: '召回外网探索内容',
      type: 'source',
      inputCount: currentCandidates.length,
      outputCount: phoenixCandidates.length,
    },
    candidates: phoenixCandidates,
  };

  currentCandidates = dedupeById([...thunderCandidates, ...phoenixCandidates]);
  yield {
    step: {
      id: 'source_merge',
      name: 'Source Merge',
      nameZh: '召回源合并',
      description: 'Merge source outputs and deduplicate IDs',
      descriptionZh: '合并召回结果并按 ID 去重',
      type: 'source',
      inputCount: thunderCandidates.length + phoenixCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };

  currentCandidates = hydrateInNetwork(currentCandidates, context);
  yield {
    step: {
      id: 'hydrator_in_network',
      name: 'InNetworkCandidateHydrator',
      nameZh: '内外网标注补全器',
      description: 'Hydrate in-network flag per candidate',
      descriptionZh: '补全候选的内外网标记',
      type: 'hydrator',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };

  currentCandidates = hydrateCoreData(currentCandidates);
  yield {
    step: {
      id: 'hydrator_core_data',
      name: 'CoreDataCandidateHydrator',
      nameZh: '核心数据补全器',
      description: 'Hydrate core tweet metadata',
      descriptionZh: '补全推文核心元数据',
      type: 'hydrator',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };

  currentCandidates = hydrateVideoDuration(currentCandidates);
  yield {
    step: {
      id: 'hydrator_video_duration',
      name: 'VideoDurationCandidateHydrator',
      nameZh: '视频时长补全器',
      description: 'Hydrate video duration for VQV gating',
      descriptionZh: '补全视频时长用于 VQV 权重控制',
      type: 'hydrator',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };

  currentCandidates = hydrateSubscription(currentCandidates);
  yield {
    step: {
      id: 'hydrator_subscription',
      name: 'SubscriptionHydrator',
      nameZh: '订阅关系补全器',
      description: 'Hydrate subscription-only author metadata',
      descriptionZh: '补全订阅内容作者信息',
      type: 'hydrator',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };

  currentCandidates = hydrateVisibility(currentCandidates);
  yield {
    step: {
      id: 'hydrator_vf',
      name: 'VFCandidateHydrator',
      nameZh: '可见性补全器',
      description: 'Hydrate visibility filtering hints',
      descriptionZh: '补全可见性过滤信号',
      type: 'hydrator',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };

  // Pre-scoring filters
  for (const filter of PRE_SCORING_FILTERS) {
    if (!config.enabledFilters.includes(filter.id)) {
      continue;
    }

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

  const phoenixResult = runPhoenixScorer(currentCandidates);
  yield {
    step: {
      id: 'phoenix',
      name: 'Phoenix ML Scorer',
      nameZh: 'Phoenix 机器学习评分器',
      description: 'Predicts 18 user behaviors using ML model',
      descriptionZh: '使用模型预测 18 种用户行为',
      type: 'scorer',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
      details: phoenixResult,
    },
    candidates: currentCandidates,
  };

  const { result: weightedResult, updatedCandidates: weightedCandidates } = runWeightedScorer(
    currentCandidates,
    config.weights
  );
  currentCandidates = weightedCandidates;

  yield {
    step: {
      id: 'weighted',
      name: 'Weighted Sum Scorer',
      nameZh: '加权求和评分器',
      description: 'Combines Phoenix predictions into weighted score',
      descriptionZh: '将 Phoenix 预测融合为加权分数',
      type: 'scorer',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
      details: weightedResult,
    },
    candidates: currentCandidates,
  };

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
      description: 'Apply decay to repeated authors',
      descriptionZh: '对重复作者应用衰减',
      type: 'scorer',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
      details: diversityResult,
    },
    candidates: currentCandidates,
  };

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
      description: 'Adjust score for out-of-network content',
      descriptionZh: '对外网内容进行平衡调整',
      type: 'scorer',
      inputCount: currentCandidates.length,
      outputCount: currentCandidates.length,
      details: oonResult,
    },
    candidates: currentCandidates,
  };

  const selectedCandidates = sortByFinalScore(currentCandidates).slice(0, config.topK);
  yield {
    step: {
      id: 'selector_top_k',
      name: 'TopKScoreSelector',
      nameZh: 'TopK 选择器',
      description: `Select top ${config.topK} by final score`,
      descriptionZh: `按最终分数选择 Top ${config.topK}`,
      type: 'selector',
      inputCount: currentCandidates.length,
      outputCount: selectedCandidates.length,
    },
    candidates: selectedCandidates,
  };

  currentCandidates = selectedCandidates;

  for (const filter of POST_SELECTION_FILTERS) {
    if (!config.enabledFilters.includes(filter.id)) {
      continue;
    }

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

  currentCandidates = sortByFinalScore(currentCandidates);

  yield {
    step: {
      id: 'final_ranking',
      name: 'Final Ranking',
      nameZh: '最终排序',
      description: 'Final ranked timeline after post-selection filters',
      descriptionZh: '后置过滤后的最终时间线排序',
      type: 'ranker',
      inputCount: selectedCandidates.length,
      outputCount: currentCandidates.length,
    },
    candidates: currentCandidates,
  };
}
