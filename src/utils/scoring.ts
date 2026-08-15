import type { PhoenixScores, TweetCandidate, TweetInput, WeightConfig } from '@/core/types';
import { RANKING_CONSTANTS } from '@/data/upstreamSnapshot';

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function generateSeedFromInput(tweet: TweetInput): number {
  return hashString(
    `${tweet.content}|${tweet.hasMedia}|${tweet.authorType}|${tweet.followerCount}|${tweet.videoDurationMs || 0}`
  );
}

export function createSeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Produces deterministic synthetic values for the published Phoenix output heads.
 * This is deliberately not presented as inference from X's open-source model weights.
 */
export function simulatePhoenixScores(tweet: TweetInput, seed?: number): PhoenixScores {
  const rng = createSeededRandom(seed ?? generateSeedFromInput(tweet));
  let baseEngagement = 0.3;

  if (tweet.content.length > 200) baseEngagement += 0.1;
  else if (tweet.content.length > 100) baseEngagement += 0.05;
  else if (tweet.content.length < 20) baseEngagement -= 0.05;

  if (tweet.hasMedia === 'video') baseEngagement += 0.2;
  else if (tweet.hasMedia === 'image') baseEngagement += 0.15;

  const authorBoost = tweet.authorType === 'influencer'
    ? 0.15
    : tweet.authorType === 'verified'
      ? 0.08
      : 0;
  const followerInfluence = Math.log10(tweet.followerCount + 1) / 7;
  let contentQuality = 0;

  if (tweet.content.includes('?')) contentQuality += 0.05;
  if (/[!]{2,}/.test(tweet.content)) contentQuality -= 0.02;
  if ((tweet.content.match(/@\w+/g)?.length || 0) > 3) contentQuality -= 0.05;
  if ((tweet.content.match(/#\w+/g)?.length || 0) > 5) contentQuality -= 0.08;

  const emojiCount = (tweet.content.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > 0 && emojiCount <= 3) contentQuality += 0.03;
  else if (emojiCount > 5) contentQuality -= 0.03;

  const engagement = clamp(baseEngagement + authorBoost + followerInfluence + contentQuality);
  const favoriteScore = clamp(engagement + (rng() - 0.5) * 0.15);
  const replyScore = clamp(
    engagement * 0.6 + (rng() - 0.5) * 0.1 + (tweet.content.includes('?') ? 0.1 : 0)
  );
  const retweetScore = clamp(engagement * 0.7 + (rng() - 0.5) * 0.12);
  const photoExpandScore = tweet.hasMedia === 'image'
    ? clamp(0.5 + (rng() - 0.5) * 0.2)
    : 0.05;
  const videoOpenScore = tweet.hasMedia === 'video'
    ? clamp(0.55 + (rng() - 0.5) * 0.2)
    : 0.01;
  const clickScore = clamp(engagement * 0.4 + (rng() - 0.5) * 0.1);
  const openLinkScore = clamp(clickScore * 0.55 + (rng() - 0.5) * 0.08);
  const profileClickScore = clamp(engagement * 0.3 + (rng() - 0.5) * 0.08 + authorBoost);

  let vqvBoost = 0;
  if (tweet.hasMedia === 'video' && tweet.videoDurationMs) {
    const durationSeconds = tweet.videoDurationMs / 1_000;
    if (durationSeconds >= 30 && durationSeconds <= 60) vqvBoost = 0.15;
    else if (durationSeconds <= 180) vqvBoost = 0.1;
    else vqvBoost = 0.05;
  }

  const vqvScore = tweet.hasMedia === 'video'
    ? clamp(0.4 + vqvBoost + (rng() - 0.5) * 0.15)
    : 0.02;
  const shareScore = clamp(engagement * 0.4 + (rng() - 0.5) * 0.1);
  const shareViaDmScore = clamp(engagement * 0.2 + (rng() - 0.5) * 0.08);
  const shareViaCopyLinkScore = clamp(engagement * 0.25 + (rng() - 0.5) * 0.08);
  const dwellScore = clamp(0.3 + tweet.content.length / 1_000 + (rng() - 0.5) * 0.1);
  const quoteScore = clamp(engagement * 0.3 + (rng() - 0.5) * 0.08);
  const quotedClickScore = clamp(0.2 + (rng() - 0.5) * 0.1);
  const quotedVqvScore = tweet.hasMedia === 'video'
    ? clamp(vqvScore * 0.45 + (rng() - 0.5) * 0.08)
    : clamp(quoteScore * 0.18 + (rng() - 0.5) * 0.04);
  const followAuthorScore = clamp(engagement * 0.15 + authorBoost * 0.5 + (rng() - 0.5) * 0.05);
  const postUnexploredScore = clamp(0.55 - followerInfluence * 0.35 + (rng() - 0.5) * 0.2);

  const baseNegative = 0.05 - contentQuality * 0.5;
  const notInterestedScore = clamp(baseNegative + (rng() - 0.5) * 0.05, 0, 0.3);
  const blockAuthorScore = clamp(baseNegative * 0.3 + (rng() - 0.5) * 0.02, 0, 0.15);
  const muteAuthorScore = clamp(baseNegative * 0.5 + (rng() - 0.5) * 0.03, 0, 0.2);
  const reportScore = clamp(baseNegative * 0.2 + (rng() - 0.5) * 0.01, 0, 0.1);
  const notDwelledScore = clamp(0.22 - dwellScore * 0.25 + (rng() - 0.5) * 0.08, 0, 0.35);

  // Upstream scoring consumes these continuous outputs in seconds.
  const dwellTime = Math.max(
    0.5,
    tweet.content.length * 0.05 + (tweet.hasMedia !== 'none' ? 2 : 0) + rng()
  );
  const clickDwellTime = Math.max(0.25, dwellTime * clickScore * (0.7 + rng() * 0.6));
  const activeSecs5mResidualNorm = clamp((dwellTime + clickDwellTime) / 60 + (rng() - 0.5) * 0.1);

  return {
    favoriteScore,
    replyScore,
    retweetScore,
    photoExpandScore,
    videoOpenScore,
    clickScore,
    openLinkScore,
    profileClickScore,
    vqvScore,
    shareScore,
    shareViaDmScore,
    shareViaCopyLinkScore,
    dwellScore,
    quoteScore,
    quotedClickScore,
    quotedVqvScore,
    followAuthorScore,
    postUnexploredScore,
    notInterestedScore,
    blockAuthorScore,
    muteAuthorScore,
    reportScore,
    notDwelledScore,
    dwellTime,
    clickDwellTime,
    activeSecs5mResidualNorm,
  };
}

export interface WeightedScoreBreakdown {
  positive: number;
  negative: number;
  combined: number;
  score: number;
  vqvEligible: boolean;
  quotedVqvEligible: boolean;
  bidirectionalBoostEligible: boolean;
}

function apply(value: number | undefined, weight: number): number {
  return (value ?? 0) * weight;
}

/** Mirrors RankingScorer::compute_weighted_parts and offset_score. */
export function computeWeightedScore(
  candidate: TweetCandidate,
  weights: WeightConfig,
  viewerFollowerCount: number
): WeightedScoreBreakdown {
  const scores = candidate.phoenixScores;
  const bidirectionalBoostEligible =
    !candidate.inReplyToTweetId &&
    !candidate.originalTweetId &&
    candidate.isMutualFollowAuthor === true;
  const replyWeight = weights.replyWeight + (
    bidirectionalBoostEligible ? weights.bidirectionalFollowReplyWeightBoost : 0
  );
  const dwellWeight = weights.dwellWeight + (
    bidirectionalBoostEligible ? weights.bidirectionalFollowDwellWeightBoost : 0
  );
  const vqvEligible =
    viewerFollowerCount < RANKING_CONSTANTS.maxViewerFollowersForVqv &&
    (candidate.videoDurationMs ?? 0) > weights.minVideoDurationMs;
  const quotedVqvEligible =
    !weights.enableQuotedVqvDurationCheck ||
    (candidate.quotedVideoDurationMs ?? 0) > weights.minVideoDurationMs;
  const postUnexploredActive = !weights.postUnexploredInNetworkOnly || candidate.inNetwork;

  let dwellTimeTerm = apply(scores.dwellTime, weights.dwellTimeWeight);
  if (weights.enableMultiplicativePostUnexplored && postUnexploredActive) {
    dwellTimeTerm *= 1 + scores.postUnexploredScore * weights.multiplicativePostUnexploredAlpha;
  }

  let clickDwellTime = scores.clickDwellTime;
  if (weights.enableClickDwellLowFavRatePenalty) {
    const baseline = Math.max(weights.clickDwellLowFavRatePenaltyBaseline, Number.EPSILON);
    const multiplier = clamp(
      Math.pow(scores.favoriteScore / baseline, weights.clickDwellLowFavRatePenaltyAlpha),
      weights.clickDwellLowFavRatePenaltyFloor,
      weights.clickDwellLowFavRatePenaltyCap
    );
    clickDwellTime *= multiplier;
  }

  const terms = [
    apply(scores.favoriteScore, weights.favoriteWeight),
    apply(scores.replyScore, replyWeight),
    apply(scores.retweetScore, weights.retweetWeight),
    apply(scores.photoExpandScore, weights.photoExpandWeight),
    apply(scores.videoOpenScore, weights.videoOpenWeight),
    apply(scores.clickScore, weights.clickWeight),
    apply(scores.openLinkScore, weights.openLinkWeight),
    apply(scores.profileClickScore, weights.profileClickWeight),
    apply(scores.vqvScore, vqvEligible ? weights.vqvWeight : 0),
    apply(scores.shareScore, weights.shareWeight),
    apply(scores.shareViaDmScore, weights.shareViaDmWeight),
    apply(scores.shareViaCopyLinkScore, weights.shareViaCopyLinkWeight),
    apply(scores.dwellScore, dwellWeight),
    apply(scores.quoteScore, weights.quoteWeight),
    apply(scores.quotedClickScore, weights.quotedClickWeight),
    apply(scores.quotedVqvScore, quotedVqvEligible ? weights.quotedVqvWeight : 0),
    dwellTimeTerm,
    apply(clickDwellTime, weights.clickDwellTimeWeight),
    apply(scores.activeSecs5mResidualNorm, weights.activeSecs5mResidualNormWeight),
    apply(scores.followAuthorScore, weights.followAuthorWeight),
    apply(scores.notInterestedScore, weights.notInterestedWeight),
    apply(scores.blockAuthorScore, weights.blockAuthorWeight),
    apply(scores.muteAuthorScore, weights.muteAuthorWeight),
    apply(scores.reportScore, weights.reportWeight),
    apply(scores.notDwelledScore, weights.notDwelledWeight),
    weights.enableMultiplicativePostUnexplored || !postUnexploredActive
      ? 0
      : apply(scores.postUnexploredScore, weights.postUnexploredWeight),
  ];

  let positive = 0;
  let negative = 0;
  for (const term of terms) {
    if (term >= 0) positive += term;
    else negative -= term;
  }

  const combined = positive - negative;
  const configuredPositiveWeightSum =
    weights.favoriteWeight +
    weights.replyWeight +
    weights.retweetWeight +
    weights.photoExpandWeight +
    weights.videoOpenWeight +
    weights.clickWeight +
    weights.openLinkWeight +
    weights.profileClickWeight +
    weights.vqvWeight +
    weights.shareWeight +
    weights.shareViaDmWeight +
    weights.shareViaCopyLinkWeight +
    weights.dwellWeight +
    weights.quoteWeight +
    weights.quotedClickWeight +
    weights.quotedVqvWeight +
    weights.followAuthorWeight +
    (weights.enableMultiplicativePostUnexplored ? 0 : weights.postUnexploredWeight);
  const configuredNegativeWeightSum = -(
    weights.notInterestedWeight +
    weights.blockAuthorWeight +
    weights.muteAuthorWeight +
    weights.reportWeight +
    weights.notDwelledWeight
  );
  const totalWeightSum = configuredPositiveWeightSum + configuredNegativeWeightSum;
  const score = totalWeightSum === 0
    ? Math.max(combined, 0)
    : combined < 0
      ? ((combined + configuredNegativeWeightSum) / totalWeightSum) * weights.negativeScoresOffset
      : combined + weights.negativeScoresOffset;

  return {
    positive,
    negative,
    combined,
    score,
    vqvEligible,
    quotedVqvEligible,
    bidirectionalBoostEligible,
  };
}

// A synthetic UI summary, not an upstream ranking score or reach prediction.
export function calculateHeatScore(scores: PhoenixScores): number {
  const positiveSum =
    scores.favoriteScore +
    scores.retweetScore * 1.5 +
    scores.replyScore * 0.8 +
    scores.shareScore * 1.2 +
    scores.followAuthorScore * 2 +
    scores.vqvScore;
  const negativePenalty =
    scores.notInterestedScore * 2 +
    scores.blockAuthorScore * 3 +
    scores.muteAuthorScore * 2.5 +
    scores.reportScore * 4 +
    scores.notDwelledScore * 1.5;
  return clamp((positiveSum - negativePenalty) / 7.5 * 100, 0, 100);
}

export function getHeatLevel(score: number): {
  level: 'low' | 'medium' | 'high' | 'viral';
  label: string;
  labelZh: string;
  color: string;
} {
  if (score >= 80) return { level: 'viral', label: 'High synthetic score', labelZh: '高模拟分', color: '#EF4444' };
  if (score >= 60) return { level: 'high', label: 'Above average', labelZh: '偏高', color: '#F97316' };
  if (score >= 40) return { level: 'medium', label: 'Average', labelZh: '中等', color: '#EAB308' };
  return { level: 'low', label: 'Below average', labelZh: '偏低', color: '#22C55E' };
}

type DisplayScoreKey = Exclude<
  keyof PhoenixScores,
  'dwellTime' | 'clickDwellTime' | 'activeSecs5mResidualNorm'
>;

export const SCORE_LABELS: Record<DisplayScoreKey, {
  name: string;
  nameZh: string;
  type: 'positive' | 'negative';
}> = {
  favoriteScore: { name: 'Like', nameZh: '点赞', type: 'positive' },
  replyScore: { name: 'Reply', nameZh: '回复', type: 'positive' },
  retweetScore: { name: 'Repost', nameZh: '转帖', type: 'positive' },
  photoExpandScore: { name: 'Photo Expand', nameZh: '图片展开', type: 'positive' },
  videoOpenScore: { name: 'Video Open', nameZh: '打开视频', type: 'positive' },
  clickScore: { name: 'Post Click', nameZh: '点击帖子', type: 'positive' },
  openLinkScore: { name: 'Open Link', nameZh: '打开链接', type: 'positive' },
  profileClickScore: { name: 'Profile Click', nameZh: '点击主页', type: 'positive' },
  vqvScore: { name: 'Video Quality View', nameZh: '视频质量观看', type: 'positive' },
  shareScore: { name: 'Share', nameZh: '分享', type: 'positive' },
  shareViaDmScore: { name: 'Share via DM', nameZh: '私信分享', type: 'positive' },
  shareViaCopyLinkScore: { name: 'Copy Link', nameZh: '复制链接', type: 'positive' },
  dwellScore: { name: 'Dwell', nameZh: '停留', type: 'positive' },
  quoteScore: { name: 'Quote', nameZh: '引用', type: 'positive' },
  quotedClickScore: { name: 'Quoted Click', nameZh: '点击引用', type: 'positive' },
  quotedVqvScore: { name: 'Quoted VQV', nameZh: '引用视频观看', type: 'positive' },
  followAuthorScore: { name: 'Follow', nameZh: '关注', type: 'positive' },
  postUnexploredScore: { name: 'Post Unexplored', nameZh: '未充分探索', type: 'positive' },
  notInterestedScore: { name: 'Not Interested', nameZh: '不感兴趣', type: 'negative' },
  blockAuthorScore: { name: 'Block', nameZh: '屏蔽', type: 'negative' },
  muteAuthorScore: { name: 'Mute', nameZh: '静音', type: 'negative' },
  reportScore: { name: 'Report', nameZh: '举报', type: 'negative' },
  notDwelledScore: { name: 'Not Dwelled', nameZh: '未停留', type: 'negative' },
};

export const CONTINUOUS_OUTPUT_LABELS = {
  dwellTime: { name: 'Continuous Dwell', nameZh: '连续停留时长', unit: 's' },
  clickDwellTime: { name: 'Click Dwell', nameZh: '点击后停留时长', unit: 's' },
  activeSecs5mResidualNorm: {
    name: 'Active Seconds 5m Residual Norm',
    nameZh: '五分钟活跃秒数残差归一值',
    unit: '',
  },
} as const;
