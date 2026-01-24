import { TweetCandidate, WeightConfig, ScorerResult } from '@/core/types';
import { computeWeightedScore } from '@/utils/scoring';

// Scorer configurations
export const SCORERS = [
  {
    id: 'phoenix',
    name: 'Phoenix ML Scorer',
    nameZh: 'Phoenix 机器学习评分器',
    description: 'Predicts 18 user behaviors using ML model',
    descriptionZh: '使用机器学习模型预测 18 种用户行为',
  },
  {
    id: 'weighted',
    name: 'Weighted Sum Scorer',
    nameZh: '加权求和评分器',
    description: 'Combines Phoenix scores with configurable weights',
    descriptionZh: '使用可配置的权重组合 Phoenix 分数',
  },
  {
    id: 'author_diversity',
    name: 'Author Diversity Scorer',
    nameZh: '作者多样性评分器',
    description: 'Applies decay to same-author tweets',
    descriptionZh: '对同一作者的推文应用衰减惩罚',
  },
  {
    id: 'oon',
    name: 'OON Balance Scorer',
    nameZh: '内外网平衡评分器',
    description: 'Balances in-network vs out-of-network content',
    descriptionZh: '平衡关注者内容和推荐内容',
  },
];

// Phoenix scorer - scores are already in candidates from simulation
export function runPhoenixScorer(candidates: TweetCandidate[]): ScorerResult {
  return {
    scorerId: 'phoenix',
    scorerName: 'Phoenix ML Scorer',
    candidateScores: candidates.map(c => ({
      candidateId: c.id,
      scores: { ...c.phoenixScores },
      finalScore: Object.values(c.phoenixScores).reduce((a, b) => a + b, 0) / 19,
    })),
  };
}

// Weighted sum scorer
export function runWeightedScorer(
  candidates: TweetCandidate[],
  weights: WeightConfig
): { result: ScorerResult; updatedCandidates: TweetCandidate[] } {
  const updatedCandidates = candidates.map(candidate => {
    const weightedScore = computeWeightedScore(candidate.phoenixScores, weights);
    return {
      ...candidate,
      weightedScore,
    };
  });

  return {
    result: {
      scorerId: 'weighted',
      scorerName: 'Weighted Sum Scorer',
      candidateScores: updatedCandidates.map(c => ({
        candidateId: c.id,
        scores: { weightedScore: c.weightedScore || 0 },
        finalScore: c.weightedScore || 0,
      })),
    },
    updatedCandidates,
  };
}

// Author diversity scorer
// Formula: multiplier = (1 - floor) * decay^position + floor
export function runAuthorDiversityScorer(
  candidates: TweetCandidate[],
  decay: number,
  floor: number
): { result: ScorerResult; updatedCandidates: TweetCandidate[] } {
  // Sort by weighted score first
  const sorted = [...candidates].sort(
    (a, b) => (b.weightedScore || 0) - (a.weightedScore || 0)
  );

  const authorCounts = new Map<string, number>();
  const updatedCandidates: TweetCandidate[] = [];

  for (const candidate of sorted) {
    const count = authorCounts.get(candidate.authorId) || 0;
    authorCounts.set(candidate.authorId, count + 1);

    // Apply diversity penalty
    const multiplier = (1 - floor) * Math.pow(decay, count) + floor;
    const diversityAdjustedScore = (candidate.weightedScore || 0) * multiplier;

    updatedCandidates.push({
      ...candidate,
      diversityAdjustedScore,
    });
  }

  return {
    result: {
      scorerId: 'author_diversity',
      scorerName: 'Author Diversity Scorer',
      candidateScores: updatedCandidates.map(c => ({
        candidateId: c.id,
        scores: {
          originalScore: c.weightedScore || 0,
          diversityMultiplier:
            (c.diversityAdjustedScore || 0) / (c.weightedScore || 1),
          diversityAdjustedScore: c.diversityAdjustedScore || 0,
        },
        finalScore: c.diversityAdjustedScore || 0,
      })),
    },
    updatedCandidates,
  };
}

// Out of Network (OON) balance scorer
export function runOONScorer(
  candidates: TweetCandidate[],
  oonFactor: number
): { result: ScorerResult; updatedCandidates: TweetCandidate[] } {
  const updatedCandidates = candidates.map(candidate => {
    const baseScore = candidate.diversityAdjustedScore || candidate.weightedScore || 0;

    // Apply OON factor if tweet is from out of network
    const finalScore = candidate.inNetwork ? baseScore : baseScore * oonFactor;

    return {
      ...candidate,
      finalScore,
    };
  });

  return {
    result: {
      scorerId: 'oon',
      scorerName: 'OON Balance Scorer',
      candidateScores: updatedCandidates.map(c => ({
        candidateId: c.id,
        scores: {
          isInNetwork: c.inNetwork ? 1 : 0,
          oonMultiplier: c.inNetwork ? 1 : oonFactor,
          beforeOON: c.diversityAdjustedScore || c.weightedScore || 0,
          afterOON: c.finalScore || 0,
        },
        finalScore: c.finalScore || 0,
      })),
    },
    updatedCandidates,
  };
}

// Run all scorers in sequence
export function runAllScorers(
  candidates: TweetCandidate[],
  weights: WeightConfig
): {
  results: ScorerResult[];
  finalCandidates: TweetCandidate[];
} {
  const results: ScorerResult[] = [];

  // Phoenix scorer
  const phoenixResult = runPhoenixScorer(candidates);
  results.push(phoenixResult);

  // Weighted scorer
  const { result: weightedResult, updatedCandidates: weightedCandidates } =
    runWeightedScorer(candidates, weights);
  results.push(weightedResult);

  // Author diversity scorer
  const { result: diversityResult, updatedCandidates: diversityCandidates } =
    runAuthorDiversityScorer(
      weightedCandidates,
      weights.authorDiversityDecay,
      weights.authorDiversityFloor
    );
  results.push(diversityResult);

  // OON scorer
  const { result: oonResult, updatedCandidates: finalCandidates } = runOONScorer(
    diversityCandidates,
    weights.oonWeightFactor
  );
  results.push(oonResult);

  // Sort by final score
  finalCandidates.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

  return { results, finalCandidates };
}

// Get scorer by ID
export function getScorerById(id: string) {
  return SCORERS.find(s => s.id === id);
}
