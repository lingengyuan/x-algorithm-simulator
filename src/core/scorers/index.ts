import { TweetCandidate, WeightConfig, ScorerResult, FilterContext } from '@/core/types';
import {
  computePostAgeBucketMs,
  computeWeightedScore,
  normalizeContinuousValueMs,
} from '@/utils/scoring';

export const SCORERS = [
  {
    id: 'phoenix',
    name: 'Phoenix Scorer Approximation',
    nameZh: 'Phoenix 评分近似模拟',
    description: 'Uses local behavior predictions in place of the open-source Phoenix model runtime',
    descriptionZh: '用本地行为预测近似替代 Phoenix 模型运行结果',
  },
  {
    id: 'ranking',
    name: 'RankingScorer',
    nameZh: '排序评分器',
    description: 'Combines weights, author diversity, and context-aware OON balance',
    descriptionZh: '融合权重、作者多样性和场景化关注外平衡',
  },
  {
    id: 'vm_ranker',
    name: 'VMRanker Approximation',
    nameZh: 'VM 重排近似模拟',
    description: 'Shows where VMRanker reranking occurs with a local approximation',
    descriptionZh: '用本地近似规则展示 VMRanker 重排所处位置',
  },
];

function maxOrZero(values: number[]): number {
  return values.length ? Math.max(...values) : 0;
}

function minOrZero(values: number[]): number {
  return values.length ? Math.min(...values) : 0;
}

export function runPhoenixScorer(candidates: TweetCandidate[]): ScorerResult {
  const historyTokenCount = 3;
  const candidateStartOffset = historyTokenCount + 1;
  const sequenceLength = candidateStartOffset + candidates.length;
  const impressionTimestampMs = Date.now();
  const ageBuckets = candidates.map((candidate) =>
    computePostAgeBucketMs(impressionTimestampMs, candidate.createdAt)
  );
  const normalizedDwellTimes = candidates.map((candidate) =>
    normalizeContinuousValueMs(candidate.phoenixScores.dwellTime)
  );
  const normalizedClickDwellTimes = candidates.map((candidate) =>
    normalizeContinuousValueMs(candidate.phoenixScores.clickDwellTime)
  );

  return {
    scorerId: 'phoenix',
    scorerName: 'Phoenix Scorer Approximation',
    summary: {
      historyTokenCount,
      candidateStartOffset,
      sequenceLength,
      candidateToCandidateAttention: 0,
      candidateSelfAttention: 1,
      candidateUserHistoryAttention: 1,
      postAgeGranularityMinutes: 60,
      postAgeMaxMinutes: 4800,
      postAgeBucketMin: minOrZero(ageBuckets),
      postAgeBucketMax: maxOrZero(ageBuckets),
      continuousNormScaleSeconds: 30,
      normalizedDwellTimeMax: maxOrZero(normalizedDwellTimes),
      normalizedClickDwellTimeMax: maxOrZero(normalizedClickDwellTimes),
    },
    candidateScores: candidates.map((c, index) => ({
      candidateId: c.id,
      scores: {
        ...c.phoenixScores,
        candidateToCandidateAttention: 0,
        candidateSelfAttention: 1,
        candidateUserHistoryAttention: 1,
        postAgeBucket: ageBuckets[index],
        normalizedDwellTime: normalizedDwellTimes[index],
        normalizedClickDwellTime: normalizedClickDwellTimes[index],
      },
      finalScore: (
        c.phoenixScores.favoriteScore +
        c.phoenixScores.replyScore +
        c.phoenixScores.retweetScore +
        c.phoenixScores.photoExpandScore +
        c.phoenixScores.clickScore +
        c.phoenixScores.profileClickScore +
        c.phoenixScores.vqvScore +
        c.phoenixScores.shareScore +
        c.phoenixScores.shareViaDmScore +
        c.phoenixScores.shareViaCopyLinkScore +
        c.phoenixScores.dwellScore +
        c.phoenixScores.quoteScore +
        c.phoenixScores.quotedClickScore +
        c.phoenixScores.quotedVqvScore +
        c.phoenixScores.followAuthorScore -
        c.phoenixScores.notInterestedScore -
        c.phoenixScores.blockAuthorScore -
        c.phoenixScores.muteAuthorScore -
        c.phoenixScores.reportScore -
        c.phoenixScores.notDwelledScore
      ) / 20,
    })),
  };
}

function getEffectiveOonFactor(context: FilterContext, weights: WeightConfig): number {
  if (context.topicIds.length > 0) {
    return weights.topicOonWeightFactor;
  }

  const isEligibleNewUser =
    context.isNewUser &&
    context.userAccountAgeDays <= 30 &&
    context.followedCount >= 10;

  if (isEligibleNewUser) {
    return weights.newUserOonWeightFactor;
  }

  return weights.oonWeightFactor;
}

export function normalizeRankingScore(candidate: TweetCandidate, rawScore: number): number {
  const nonNegativeScore = Math.max(0, rawScore);
  const compressedScore = Math.log1p(nonNegativeScore);
  const sourceMultiplier = candidate.sourceType === 'phoenix_topics'
    ? 1.06
    : candidate.sourceType === 'phoenix_moe'
      ? 1.03
      : 1;
  const brandSafetyMultiplier = candidate.brandSafetyRisk === 'high'
    ? 0.72
    : candidate.brandSafetyRisk === 'medium'
      ? 0.9
      : 1;

  return compressedScore * sourceMultiplier * brandSafetyMultiplier;
}

function applyAuthorDiversity(
  candidates: TweetCandidate[],
  decay: number,
  floor: number
): Map<string, number> {
  const sorted = [...candidates].sort(
    (a, b) => (b.weightedScore || 0) - (a.weightedScore || 0)
  );
  const authorCounts = new Map<string, number>();
  const adjustedById = new Map<string, number>();

  for (const candidate of sorted) {
    const count = authorCounts.get(candidate.authorId) || 0;
    authorCounts.set(candidate.authorId, count + 1);
    const multiplier = (1 - floor) * Math.pow(decay, count) + floor;
    adjustedById.set(candidate.id, (candidate.weightedScore || 0) * multiplier);
  }

  return adjustedById;
}

export function runRankingScorer(
  candidates: TweetCandidate[],
  weights: WeightConfig,
  context: FilterContext
): { result: ScorerResult; updatedCandidates: TweetCandidate[] } {
  const weightedCandidates = candidates.map((candidate) => ({
    ...candidate,
    rawWeightedScore: computeWeightedScore(
      candidate.phoenixScores,
      weights,
      candidate.videoDurationMs,
      candidate.quotedVideoDurationMs
    ),
  })).map((candidate) => ({
    ...candidate,
    weightedScore: normalizeRankingScore(candidate, candidate.rawWeightedScore),
  }));

  const diversityScores = applyAuthorDiversity(
    weightedCandidates,
    weights.authorDiversityDecay,
    weights.authorDiversityFloor
  );
  const effectiveOon = getEffectiveOonFactor(context, weights);

  const updatedCandidates = weightedCandidates.map((candidate) => {
    const diversityAdjustedScore = diversityScores.get(candidate.id) || candidate.weightedScore || 0;
    const finalScore = candidate.inNetwork
      ? diversityAdjustedScore
      : diversityAdjustedScore * effectiveOon;

    return {
      ...candidate,
      diversityAdjustedScore,
      finalScore,
    };
  });

  return {
    result: {
      scorerId: 'ranking',
      scorerName: 'RankingScorer',
      candidateScores: updatedCandidates.map((c) => ({
        candidateId: c.id,
        scores: {
          rawWeightedScore: c.rawWeightedScore || 0,
          weightedScore: c.weightedScore || 0,
          diversityAdjustedScore: c.diversityAdjustedScore || 0,
          effectiveOonFactor: c.inNetwork ? 1 : effectiveOon,
        },
        finalScore: c.finalScore || 0,
      })),
    },
    updatedCandidates,
  };
}

function computeValueModelScore(candidate: TweetCandidate): number {
  const engagementScale =
    Math.log10(
      (candidate.favoriteCount || 0) +
      (candidate.replyCount || 0) * 2 +
      (candidate.repostCount || 0) * 2 +
      (candidate.quoteCount || 0) * 2 +
      10
    ) / 6;
  const mutualBoost = candidate.mutualFollowJaccard || 0;
  const mediaBoost = candidate.hasImage || candidate.hasVideo ? 0.06 : 0;
  const replyBoost = candidate.followingRepliedUserIds?.length ? 0.05 : 0;
  const brandSafetyPenalty = candidate.brandSafetyRisk === 'high'
    ? 0.25
    : candidate.brandSafetyRisk === 'medium'
      ? 0.1
      : 0;
  const skipPenalty = candidate.phoenixScores.notDwelledScore * 0.35;

  return Math.max(0, engagementScale + mutualBoost + mediaBoost + replyBoost - brandSafetyPenalty - skipPenalty);
}

export function runVMRanker(
  candidates: TweetCandidate[],
  weights: WeightConfig
): { result: ScorerResult; updatedCandidates: TweetCandidate[] } {
  const blend = weights.vmRankerBlendFactor;

  const updatedCandidates = candidates.map((candidate) => {
    const baseScore = candidate.finalScore || 0;
    const valueModelScore = computeValueModelScore(candidate);
    const finalScore = baseScore * (1 - blend) + (baseScore + valueModelScore) * blend;

    return {
      ...candidate,
      finalScore,
    };
  });

  return {
    result: {
      scorerId: 'vm_ranker',
      scorerName: 'VMRanker Approximation',
      candidateScores: updatedCandidates.map((c) => ({
        candidateId: c.id,
        scores: {
          beforeVM: candidates.find((candidate) => candidate.id === c.id)?.finalScore || 0,
          valueModelScore: computeValueModelScore(c),
          blend,
        },
        finalScore: c.finalScore || 0,
      })),
    },
    updatedCandidates,
  };
}

export function runAllScorers(
  candidates: TweetCandidate[],
  weights: WeightConfig,
  context: FilterContext
): {
  results: ScorerResult[];
  finalCandidates: TweetCandidate[];
} {
  const results: ScorerResult[] = [];

  const phoenixResult = runPhoenixScorer(candidates);
  results.push(phoenixResult);

  const { result: rankingResult, updatedCandidates: rankingCandidates } =
    runRankingScorer(candidates, weights, context);
  results.push(rankingResult);

  const { result: vmResult, updatedCandidates: finalCandidates } =
    weights.enableVMRanker && weights.vmRankerBlendFactor > 0
      ? runVMRanker(rankingCandidates, weights)
      : { result: undefined, updatedCandidates: rankingCandidates };

  if (vmResult) {
    results.push(vmResult);
  }

  finalCandidates.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

  return { results, finalCandidates };
}

export function getScorerById(id: string) {
  return SCORERS.find((s) => s.id === id);
}
