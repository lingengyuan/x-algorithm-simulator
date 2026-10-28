import type { FilterContext, ScorerResult, TweetCandidate, WeightConfig } from '@/core/types';
import { CACHED_POSTS_MIN_COUNT, RANKING_CONSTANTS, RANKING_DEFAULTS } from '@/data/upstreamSnapshot';
import { computeWeightedScore, createSeededRandom, hashString } from '@/utils/scoring';

const EPSILON = 1e-6;

export const SCORERS = [
  {
    id: 'phoenix',
    name: 'PhoenixScorer (synthetic outputs)',
    nameZh: 'Phoenix 评分器（模拟输出）',
    description: 'Consumes the current Phoenix output-head contract; local values are deterministic fixtures',
    descriptionZh: '使用当前 Phoenix 输出头契约；本地数值为确定性测试数据',
  },
  {
    id: 'vm_ranker',
    name: 'VMRanker',
    nameZh: 'VMRanker 价值评分与重排',
    description: 'Home Mixer fusion → cold-start → VM diversity/OON → DPP',
    descriptionZh: 'Home Mixer 加权 → 冷启动 → VM 多样性与关注外系数 → DPP',
  },
] as const;

export function runPhoenixScorer(candidates: TweetCandidate[]): ScorerResult {
  return {
    scorerId: 'phoenix',
    scorerName: 'PhoenixScorer (synthetic outputs)',
    summary: {
      outputHeadCount: 26,
      outputContractHeadCount: 28,
      homeExcursionScoresEnabled: RANKING_DEFAULTS.homeExcursionScores,
      fixtureOutputUnits: 'probabilities-and-continuous-seconds',
      productionModelInference: false,
    },
    candidateScores: candidates.map((candidate) => ({
      candidateId: candidate.id,
      scores: Object.fromEntries(Object.entries(candidate.phoenixScores).filter(([, value]) => value !== undefined)),
      finalScore: candidate.phoenixScores.favoriteScore,
    })),
  };
}

function getEffectiveOonFactor(context: FilterContext, weights: WeightConfig): number {
  if (context.topicIds.length > 0) {
    return weights.topicOonWeightFactor;
  }

  const isEligibleNewUser =
    weights.newUserAgeThresholdSecs > 0 &&
    context.userAccountAgeSeconds < weights.newUserAgeThresholdSecs &&
    context.followedCount >= weights.newUserMinFollowing;

  return isEligibleNewUser ? weights.newUserOonWeightFactor : weights.oonWeightFactor;
}

// Seeded Gamma/Beta draws make the public Thompson policy repeatable in local fixtures.
function gammaSample(shape: number, random: () => number): number {
  if (shape < 1) return gammaSample(shape + 1, random) * Math.max(random(), Number.EPSILON) ** (1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const normal = Math.sqrt(-2 * Math.log(Math.max(random(), Number.EPSILON))) * Math.cos(2 * Math.PI * random());
    const base = 1 + c * normal;
    if (base <= 0) continue;
    const v = base ** 3;
    const u = random();
    if (u < 1 - 0.0331 * normal ** 4 || Math.log(u) < normal ** 2 / 2 + d * (1 - v + Math.log(v))) return d * v;
  }
}

function applyAuthorColdStart(
  candidates: TweetCandidate[],
  weights: WeightConfig,
  context: FilterContext
): TweetCandidate[] {
  if (!weights.enableAuthorColdStart || context.topicIds.length > 0 || candidates.length === 0) {
    return candidates.map((candidate) => ({
      ...candidate,
      coldStartAdjustedScore: candidate.weightedScore ?? 0,
    }));
  }

  const scores = candidates.map((candidate) => candidate.weightedScore ?? 0);
  const rankedAll = [...scores].sort((left, right) => right - left);
  const high = Math.min(Math.floor(weights.coldStartSlotMax), rankedAll.length);
  const low = Math.min(Math.floor(weights.coldStartSlotMin), high);
  if (low >= high) {
    return candidates.map((candidate) => ({
      ...candidate,
      coldStartAdjustedScore: candidate.weightedScore ?? 0,
    }));
  }

  // The published defaults define a one-slot range [15, 16), so the target is deterministic.
  const target = rankedAll[low];
  const nonzeroOrder = scores
    .map((score, index) => ({ index, score }))
    .filter(({ score }) => score !== 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const positionByIndex = new Map(nonzeroOrder.map(({ index }, position) => [index, position]));
  const maxPosition = Math.floor(weights.lowImpressionsMaxPositionRatio * nonzeroOrder.length);

  const eligible = candidates
    .map((candidate, index) => ({ candidate, index, score: scores[index] }))
    .filter(({ candidate, index }) =>
      !candidate.inReplyToTweetId &&
      !candidate.originalTweetId &&
      candidate.authorFollowers !== undefined &&
      candidate.authorFollowers <= weights.coldStartFollowerCap &&
      candidate.viewCountOnHome !== undefined &&
      candidate.viewCountOnHome < weights.coldStartImpressionThreshold &&
      context.currentTime >= candidate.createdAt &&
      context.currentTime - candidate.createdAt <= weights.coldStartMaxPostAgeSecs * 1000 &&
      (positionByIndex.get(index) ?? Number.MAX_SAFE_INTEGER) < maxPosition
    )
    .sort((left, right) => right.score - left.score || right.index - left.index);

  if (!eligible.length) {
    return candidates.map((candidate) => ({
      ...candidate,
      coldStartAdjustedScore: candidate.weightedScore ?? 0,
    }));
  }

  const random = createSeededRandom(hashString(candidates.map((candidate) => candidate.content).join('|')) || 1);
  const sampled = eligible.map((item) => {
    const views = item.candidate.viewCountOnHome ?? 0;
    const favorites = Math.min(Math.max(item.candidate.favoriteCount ?? 0, 0), views);
    const alpha = gammaSample(RANKING_DEFAULTS.coldStartBetaAlpha + favorites, random);
    const beta = gammaSample(RANKING_DEFAULTS.coldStartBetaBeta + views - favorites, random);
    return { ...item, reward: alpha / (alpha + beta) };
  }).sort((a, b) => b.reward - a.reward || a.index - b.index)
    .slice(0, RANKING_DEFAULTS.coldStartThompsonTopK)
    .sort((a, b) => b.score - a.score || b.index - a.index);
  const boostedIndex = sampled[0].index;
  return candidates.map((candidate, index) => index === boostedIndex
    ? {
        ...candidate,
        coldStartAdjustedScore: Math.max(candidate.weightedScore ?? 0, target),
        coldStartBoosted: true,
      }
    : {
        ...candidate,
        coldStartAdjustedScore: candidate.weightedScore ?? 0,
      }
  );
}

function applyAuthorDiversity(
  candidates: TweetCandidate[],
  weights: WeightConfig,
  hasCachedPosts: boolean
): TweetCandidate[] {
  const sorted = candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) =>
      (right.candidate.coldStartAdjustedScore ?? 0) -
        (left.candidate.coldStartAdjustedScore ?? 0) ||
      left.index - right.index
    );
  const authorCounts = new Map<string, number>();
  const lastAuthorRank = new Map<string, number>();
  const scoreById = new Map<string, number>();
  const contextById = new Map<string, NonNullable<TweetCandidate['slateContext']>>();
  const persistCachedContexts = hasCachedPosts &&
    candidates.every((candidate) => candidate.slateContext !== undefined);

  for (const [poolRank, { candidate }] of sorted.entries()) {
    const occurrence = authorCounts.get(candidate.authorId) ?? 0;
    const previousRank = lastAuthorRank.get(candidate.authorId);
    authorCounts.set(candidate.authorId, occurrence + 1);
    lastAuthorRank.set(candidate.authorId, poolRank);
    const preDiversityScore = candidate.coldStartAdjustedScore ?? 0;
    const multiplier = weights.enableAuthorDiversity
      ? (1 - weights.authorDiversityFloor) * Math.pow(weights.authorDiversityDecay, occurrence) +
        weights.authorDiversityFloor
      : 1;
    scoreById.set(candidate.id, preDiversityScore * multiplier);
    contextById.set(candidate.id, {
      k: occurrence,
      poolRank,
      poolRankGap: previousRank === undefined ? undefined : poolRank - previousRank,
      fatigue: 0,
      preDiversityScore,
    });
  }

  return candidates.map((candidate) => ({
    ...candidate,
    diversityAdjustedScore: scoreById.get(candidate.id) ?? candidate.coldStartAdjustedScore ?? 0,
    slateContext: hasCachedPosts
      ? (persistCachedContexts ? candidate.slateContext : undefined)
      : contextById.get(candidate.id),
  }));
}

export function runRankingScorer(
  candidates: TweetCandidate[],
  weights: WeightConfig,
  context: FilterContext
): { result: ScorerResult; updatedCandidates: TweetCandidate[] } {
  const weightedCandidates = candidates.map((candidate) => {
    const breakdown = computeWeightedScore(candidate, weights, context.viewerFollowerCount);
    return {
      ...candidate,
      rawWeightedScore: breakdown.combined,
      weightedScore: context.cachedPostIds.length >= CACHED_POSTS_MIN_COUNT
        ? candidate.weightedScore ?? breakdown.score : breakdown.score,
    };
  });
  const coldStartedCandidates = applyAuthorColdStart(weightedCandidates, weights, context);
  const diversityCandidates = weights.enableVMRanker ? applyAuthorDiversity(
    coldStartedCandidates,
    weights,
    context.cachedPostIds.length >= CACHED_POSTS_MIN_COUNT
  ) : coldStartedCandidates.map((candidate) => ({ ...candidate, diversityAdjustedScore: candidate.coldStartAdjustedScore }));
  const effectiveOonFactor = getEffectiveOonFactor(context, weights);
  const updatedCandidates = diversityCandidates.map((candidate) => {
    const oonApplies = weights.enableVMRanker && (candidate.inNetwork === false || (
      candidate.inNetwork === true &&
      weights.enableOonRescoreForInNetworkRepliesRetweets &&
      Boolean(candidate.inReplyToTweetId || candidate.originalTweetId)
    ));
    const finalScore = (candidate.diversityAdjustedScore ?? 0) * (
      oonApplies ? effectiveOonFactor : 1
    );

    return { ...candidate, finalScore };
  });

  return {
    result: {
      scorerId: 'vm_ranker',
      scorerName: weights.enableVMRanker ? 'VMRanker' : 'VMRanker (local fallback)',
      summary: {
        valueModelMode: weights.enableVMRanker ? 'cached-home-mixer-weighted' : 'local-weighted-fallback',
        weightSource: 'home-mixer/params/param.rs',
        coldStartPolicy: 'seeded-beta-thompson-top-2',
        mpnScoring: false,
        authorColdStartEnabled: weights.enableAuthorColdStart,
        authorColdStartBoosted: updatedCandidates.filter((candidate) => candidate.coldStartBoosted).length,
        authorDiversityEnabled: weights.enableVMRanker && weights.enableAuthorDiversity,
        effectiveOonFactor,
      },
      candidateScores: updatedCandidates.map((candidate) => ({
        candidateId: candidate.id,
        scores: {
          rawCombinedScore: candidate.rawWeightedScore ?? 0,
          weightedScore: candidate.weightedScore ?? 0,
          coldStartAdjustedScore: candidate.coldStartAdjustedScore ?? 0,
          coldStartBoosted: candidate.coldStartBoosted ? 1 : 0,
          diversityAdjustedScore: candidate.diversityAdjustedScore ?? 0,
          effectiveOonFactor: candidate.finalScore === candidate.diversityAdjustedScore
            ? 1
            : effectiveOonFactor,
        },
        finalScore: candidate.finalScore ?? 0,
      })),
    },
    updatedCandidates,
  };
}

function deterministicFallbackEmbedding(
  candidate: TweetCandidate,
  dimension = RANKING_CONSTANTS.vmRankerEmbeddingDimension
): number[] {
  const seed = hashString(candidate.originalTweetId || candidate.id) || 1;
  const values = Array.from({ length: dimension }, (_, index) => {
    const value = hashString(`${seed}:${index}`) / 0x7fffffff;
    return value * 2 - 1;
  });
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (norm <= EPSILON) {
    return [1, ...Array.from({ length: dimension - 1 }, () => 0)];
  }
  return values.map((value) => value / norm);
}

function cosine(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denominator > EPSILON ? dot / denominator : 0;
}

function greedyDpp(kernel: number[][], topK: number): number[] {
  const size = kernel.length;
  if (size === 0 || topK === 0) return [];

  const maxItems = Math.min(topK, size);
  const selected: number[] = [];
  const available = Array.from({ length: size }, () => true);
  let first = 0;
  let firstValue = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < size; index += 1) {
    if (kernel[index][index] > firstValue) {
      firstValue = kernel[index][index];
      first = index;
    }
  }

  selected.push(first);
  available[first] = false;
  const cholesky = Array.from({ length: maxItems }, () => Array.from({ length: size }, () => 0));
  const firstRoot = Math.sqrt(firstValue);
  if (firstRoot > EPSILON) {
    for (let index = 0; index < size; index += 1) {
      cholesky[0][index] = kernel[first][index] / firstRoot;
    }
  }

  for (let selection = 1; selection < maxItems; selection += 1) {
    let bestIndex = 0;
    let bestVolume = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < size; index += 1) {
      if (!available[index]) continue;
      let conditionalVariance = kernel[index][index];
      for (let prior = 0; prior < selection; prior += 1) {
        conditionalVariance -= cholesky[prior][index] ** 2;
      }
      if (conditionalVariance > bestVolume) {
        bestVolume = conditionalVariance;
        bestIndex = index;
      }
    }

    if (bestVolume <= EPSILON) break;
    selected.push(bestIndex);
    available[bestIndex] = false;
    const root = Math.sqrt(bestVolume);
    for (let index = 0; index < size; index += 1) {
      let remainder = kernel[bestIndex][index];
      for (let prior = 0; prior < selection; prior += 1) {
        remainder -= cholesky[prior][bestIndex] * cholesky[prior][index];
      }
      cholesky[selection][index] = remainder / root;
    }
  }

  return selected;
}

export function runVMRanker(
  candidates: TweetCandidate[],
  weights: WeightConfig,
  context?: FilterContext
): { result: ScorerResult; updatedCandidates: TweetCandidate[] } {
  if (context?.topicIds.length && !RANKING_DEFAULTS.topicDppEnabled) {
    return {
      updatedCandidates: candidates,
      result: {
        scorerId: 'vm_ranker', scorerName: 'VMRanker',
        summary: { dppEnabled: false, dppSkipReason: 'topic-request-default' },
        candidateScores: candidates.map((candidate) => ({ candidateId: candidate.id, scores: {}, finalScore: candidate.finalScore ?? 0 })),
      },
    };
  }
  const pool = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.finalScore !== undefined)
    .sort((left, right) =>
      (right.candidate.finalScore ?? 0) - (left.candidate.finalScore ?? 0) ||
      left.index - right.index
    )
    .slice(0, weights.vmRankerMaxSelectedRank);

  if (!pool.length) {
    const updatedCandidates = candidates.map((candidate) => ({
      ...candidate,
      finalScore: 0,
      vmRankerSelected: false,
    }));
    return {
      result: {
        scorerId: 'vm_ranker',
        scorerName: 'VMRanker DPP',
        summary: { poolSize: 0, selectedCount: 0 },
        candidateScores: updatedCandidates.map((candidate) => ({
          candidateId: candidate.id,
          scores: { beforeVM: 0, selected: 0 },
          finalScore: 0,
        })),
      },
      updatedCandidates,
    };
  }

  const maxScore = Math.max(pool[0].candidate.finalScore ?? 0, EPSILON);
  const theta = Math.min(Math.max(weights.vmRankerTheta, 0), 1 - EPSILON);
  const alpha = theta / (2 * (1 - theta));
  const embeddings = pool.map(({ candidate }) =>
    candidate.embedding?.length ? candidate.embedding : deterministicFallbackEmbedding(candidate)
  );
  const quality = pool.map(({ candidate }) =>
    Math.exp(alpha * ((candidate.finalScore ?? 0) / maxScore))
  );
  const kernel = pool.map((_, leftIndex) => pool.map((__, rightIndex) =>
    quality[leftIndex] * quality[rightIndex] * (
      leftIndex === rightIndex ? 1 : cosine(embeddings[leftIndex], embeddings[rightIndex])
    )
  ));
  const selectedPoolIndexes = greedyDpp(kernel, weights.vmRankerTopK);
  const selectedIds = new Set(selectedPoolIndexes.map((index) => pool[index].candidate.id));
  const updatedCandidates = candidates.map((candidate) => ({
    ...candidate,
    finalScore: selectedIds.has(candidate.id) ? candidate.finalScore ?? 0 : 0,
    vmRankerSelected: selectedIds.has(candidate.id),
  }));

  return {
    result: {
      scorerId: 'vm_ranker',
      scorerName: 'VMRanker DPP',
      summary: {
        dppEnabled: true,
        theta,
        topK: weights.vmRankerTopK,
        maxSelectedRank: weights.vmRankerMaxSelectedRank,
        poolSize: pool.length,
        selectedCount: selectedIds.size,
        scoreRescaling: 'unchanged-selected-zero-unselected',
      },
      candidateScores: updatedCandidates.map((candidate) => ({
        candidateId: candidate.id,
        scores: {
          beforeVM: candidates.find((item) => item.id === candidate.id)?.finalScore ?? 0,
          selected: candidate.vmRankerSelected ? 1 : 0,
        },
        finalScore: candidate.finalScore ?? 0,
      })),
    },
    updatedCandidates,
  };
}

export function runAllScorers(
  candidates: TweetCandidate[],
  weights: WeightConfig,
  context: FilterContext
): { results: ScorerResult[]; finalCandidates: TweetCandidate[] } {
  const results: ScorerResult[] = [runPhoenixScorer(candidates)];
  const ranking = runRankingScorer(candidates, weights, context);
  const vm = weights.enableVMRanker
    ? runVMRanker(ranking.updatedCandidates, weights, context)
    : undefined;
  results.push({
    ...ranking.result,
    summary: { ...ranking.result.summary, ...vm?.result.summary },
    candidateScores: vm?.result.candidateScores ?? ranking.result.candidateScores,
  });

  const finalCandidates = [...(vm?.updatedCandidates ?? ranking.updatedCandidates)].sort(
    (left, right) => (right.finalScore ?? 0) - (left.finalScore ?? 0)
  );
  return { results, finalCandidates };
}

export function getScorerById(id: string) {
  return SCORERS.find((scorer) => scorer.id === id);
}
