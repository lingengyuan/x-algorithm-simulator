import { PhoenixScores, TweetInput, WeightConfig } from '@/core/types';

// Clamp value between 0 and 1
function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

// Simple hash function for strings
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Generate consistent seed from TweetInput
function generateSeedFromInput(tweet: TweetInput): number {
  const seedStr = `${tweet.content}|${tweet.hasMedia}|${tweet.authorType}|${tweet.followerCount}|${tweet.videoDurationMs || 0}`;
  return hashString(seedStr);
}

// Seeded random for reproducible results
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// Simulate Phoenix ML model scores based on tweet features
// Uses content-based seeding for consistent results with same input
export function simulatePhoenixScores(tweet: TweetInput, seed?: number): PhoenixScores {
  // Always use a seed for consistent results - derive from content if not provided
  const actualSeed = seed !== undefined ? seed : generateSeedFromInput(tweet);
  const rng = seededRandom(actualSeed);

  // Base engagement probability based on content
  let baseEngagement = 0.3;

  // Content length factor
  const contentLength = tweet.content.length;
  if (contentLength > 200) baseEngagement += 0.1;
  else if (contentLength > 100) baseEngagement += 0.05;
  else if (contentLength < 20) baseEngagement -= 0.05;

  // Media factor
  if (tweet.hasMedia === 'video') {
    baseEngagement += 0.2;
  } else if (tweet.hasMedia === 'image') {
    baseEngagement += 0.15;
  }

  // Author type factor
  let authorBoost = 0;
  if (tweet.authorType === 'influencer') {
    authorBoost = 0.15;
  } else if (tweet.authorType === 'verified') {
    authorBoost = 0.08;
  }

  // Follower influence (logarithmic scale)
  const followerInfluence = Math.log10(tweet.followerCount + 1) / 7;

  // Content quality heuristics
  let contentQuality = 0;

  // Check for engagement-boosting patterns
  if (tweet.content.includes('?')) contentQuality += 0.05;  // Questions increase replies
  if (/[!]{2,}/.test(tweet.content)) contentQuality -= 0.02;  // Multiple exclamations
  if ((tweet.content.match(/@\w+/g)?.length || 0) > 3) contentQuality -= 0.05;  // Too many mentions
  if ((tweet.content.match(/#\w+/g)?.length || 0) > 5) contentQuality -= 0.08;  // Too many hashtags

  // Emoji usage (moderate is good)
  const emojiCount = (tweet.content.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > 0 && emojiCount <= 3) contentQuality += 0.03;
  else if (emojiCount > 5) contentQuality -= 0.03;

  // Calculate individual scores with variance
  const engagement = clamp(baseEngagement + authorBoost + followerInfluence + contentQuality);

  // Video duration factor for VQV
  let vqvBoost = 0;
  if (tweet.hasMedia === 'video' && tweet.videoDurationMs) {
    const durationSec = tweet.videoDurationMs / 1000;
    // Optimal duration is 30-60 seconds
    if (durationSec >= 30 && durationSec <= 60) vqvBoost = 0.15;
    else if (durationSec > 60 && durationSec <= 180) vqvBoost = 0.1;
    else if (durationSec > 180) vqvBoost = 0.05;
    else vqvBoost = 0.05;
  }

  // Generate scores with correlation and variance
  const favoriteScore = clamp(engagement + (rng() - 0.5) * 0.15);
  const replyScore = clamp(engagement * 0.6 + (rng() - 0.5) * 0.1 + (tweet.content.includes('?') ? 0.1 : 0));
  const retweetScore = clamp(engagement * 0.7 + (rng() - 0.5) * 0.12);
  const photoExpandScore = tweet.hasMedia === 'image' ? clamp(0.5 + (rng() - 0.5) * 0.2) : 0.05;
  const clickScore = clamp(engagement * 0.4 + (rng() - 0.5) * 0.1);
  const profileClickScore = clamp(engagement * 0.3 + (rng() - 0.5) * 0.08 + authorBoost);
  const vqvScore = tweet.hasMedia === 'video' ? clamp(0.4 + vqvBoost + (rng() - 0.5) * 0.15) : 0.02;
  const shareScore = clamp(engagement * 0.4 + (rng() - 0.5) * 0.1);
  const shareViaDmScore = clamp(engagement * 0.2 + (rng() - 0.5) * 0.08);
  const shareViaCopyLinkScore = clamp(engagement * 0.25 + (rng() - 0.5) * 0.08);
  const dwellScore = clamp(0.3 + contentLength / 1000 + (rng() - 0.5) * 0.1);
  const quoteScore = clamp(engagement * 0.3 + (rng() - 0.5) * 0.08);
  const quotedClickScore = clamp(0.2 + (rng() - 0.5) * 0.1);
  const followAuthorScore = clamp(engagement * 0.15 + authorBoost * 0.5 + (rng() - 0.5) * 0.05);

  // Negative signals (should be low for good content)
  const baseNegative = 0.05 - contentQuality * 0.5;
  const notInterestedScore = clamp(baseNegative + (rng() - 0.5) * 0.05, 0, 0.3);
  const blockAuthorScore = clamp(baseNegative * 0.3 + (rng() - 0.5) * 0.02, 0, 0.15);
  const muteAuthorScore = clamp(baseNegative * 0.5 + (rng() - 0.5) * 0.03, 0, 0.2);
  const reportScore = clamp(baseNegative * 0.2 + (rng() - 0.5) * 0.01, 0, 0.1);

  // Expected dwell time in ms
  const dwellTime = Math.max(500, contentLength * 50 + (tweet.hasMedia !== 'none' ? 2000 : 0) + rng() * 1000);

  return {
    favoriteScore,
    replyScore,
    retweetScore,
    photoExpandScore,
    clickScore,
    profileClickScore,
    vqvScore,
    shareScore,
    shareViaDmScore,
    shareViaCopyLinkScore,
    dwellScore,
    quoteScore,
    quotedClickScore,
    followAuthorScore,
    notInterestedScore,
    blockAuthorScore,
    muteAuthorScore,
    reportScore,
    dwellTime,
  };
}

// Calculate weighted score from Phoenix scores
export function computeWeightedScore(
  scores: PhoenixScores,
  weights: WeightConfig,
  videoDurationMs?: number
): number {
  const vqvWeight = videoDurationMs && videoDurationMs > weights.minVideoDurationMs
    ? weights.vqvWeight
    : 0;

  const positive =
    scores.favoriteScore * weights.favoriteWeight +
    scores.replyScore * weights.replyWeight +
    scores.retweetScore * weights.retweetWeight +
    scores.photoExpandScore * weights.photoExpandWeight +
    scores.clickScore * weights.clickWeight +
    scores.profileClickScore * weights.profileClickWeight +
    scores.vqvScore * vqvWeight +
    scores.shareScore * weights.shareWeight +
    scores.shareViaDmScore * weights.shareViaDmWeight +
    scores.shareViaCopyLinkScore * weights.shareViaCopyLinkWeight +
    scores.dwellScore * weights.dwellWeight +
    scores.quoteScore * weights.quoteWeight +
    scores.quotedClickScore * weights.quotedClickWeight +
    scores.followAuthorScore * weights.followAuthorWeight +
    scores.dwellTime * weights.dwellTimeWeight;

  const negative =
    scores.notInterestedScore * weights.notInterestedWeight +
    scores.blockAuthorScore * weights.blockAuthorWeight +
    scores.muteAuthorScore * weights.muteAuthorWeight +
    scores.reportScore * weights.reportWeight;

  const combined = positive + negative;
  const negativeWeightsMagnitude =
    Math.abs(weights.notInterestedWeight) +
    Math.abs(weights.blockAuthorWeight) +
    Math.abs(weights.muteAuthorWeight) +
    Math.abs(weights.reportWeight);
  const positiveWeightsSum =
    weights.favoriteWeight +
    weights.replyWeight +
    weights.retweetWeight +
    weights.photoExpandWeight +
    weights.clickWeight +
    weights.profileClickWeight +
    vqvWeight +
    weights.shareWeight +
    weights.shareViaDmWeight +
    weights.shareViaCopyLinkWeight +
    weights.dwellWeight +
    weights.quoteWeight +
    weights.quotedClickWeight +
    weights.followAuthorWeight +
    Math.abs(weights.dwellTimeWeight);
  const weightSum = positiveWeightsSum + negativeWeightsMagnitude;

  if (weightSum === 0) {
    return Math.max(combined, 0);
  }

  if (combined < 0) {
    return ((combined + negativeWeightsMagnitude) / weightSum) * weights.negativeScoresOffset;
  }

  return combined + weights.negativeScoresOffset;
}

// Calculate heat score (0-100) for UI display
export function calculateHeatScore(scores: PhoenixScores): number {
  // Weighted combination of positive signals
  const positiveSum =
    scores.favoriteScore * 1.0 +
    scores.retweetScore * 1.5 +
    scores.replyScore * 0.8 +
    scores.shareScore * 1.2 +
    scores.followAuthorScore * 2.0 +
    scores.vqvScore * 1.0;

  // Penalty from negative signals
  const negativePenalty =
    scores.notInterestedScore * 2.0 +
    scores.blockAuthorScore * 3.0 +
    scores.muteAuthorScore * 2.5 +
    scores.reportScore * 4.0;

  // Normalize to 0-100 scale
  const rawScore = (positiveSum - negativePenalty) / 7.5 * 100;

  return clamp(rawScore, 0, 100);
}

// Get heat score level
export function getHeatLevel(score: number): {
  level: 'low' | 'medium' | 'high' | 'viral';
  label: string;
  labelZh: string;
  color: string;
} {
  if (score >= 80) {
    return { level: 'viral', label: 'Viral Potential', labelZh: '爆款潜力', color: '#EF4444' };
  } else if (score >= 60) {
    return { level: 'high', label: 'High', labelZh: '高热度', color: '#F97316' };
  } else if (score >= 40) {
    return { level: 'medium', label: 'Medium', labelZh: '中等热度', color: '#EAB308' };
  } else {
    return { level: 'low', label: 'Low', labelZh: '低热度', color: '#22C55E' };
  }
}

// Score labels for display
export const SCORE_LABELS: Record<keyof Omit<PhoenixScores, 'dwellTime'>, {
  name: string;
  nameZh: string;
  type: 'positive' | 'negative';
}> = {
  favoriteScore: { name: 'Like', nameZh: '点赞', type: 'positive' },
  replyScore: { name: 'Reply', nameZh: '回复', type: 'positive' },
  retweetScore: { name: 'Retweet', nameZh: '转发', type: 'positive' },
  photoExpandScore: { name: 'Photo Expand', nameZh: '图片展开', type: 'positive' },
  clickScore: { name: 'Click', nameZh: '点击', type: 'positive' },
  profileClickScore: { name: 'Profile Click', nameZh: '点击主页', type: 'positive' },
  vqvScore: { name: 'Video Quality View', nameZh: '视频质量观看', type: 'positive' },
  shareScore: { name: 'Share', nameZh: '分享', type: 'positive' },
  shareViaDmScore: { name: 'Share via DM', nameZh: '私信分享', type: 'positive' },
  shareViaCopyLinkScore: { name: 'Copy Link', nameZh: '复制链接', type: 'positive' },
  dwellScore: { name: 'Dwell', nameZh: '停留', type: 'positive' },
  quoteScore: { name: 'Quote', nameZh: '引用', type: 'positive' },
  quotedClickScore: { name: 'Quoted Click', nameZh: '点击引用', type: 'positive' },
  followAuthorScore: { name: 'Follow', nameZh: '关注', type: 'positive' },
  notInterestedScore: { name: 'Not Interested', nameZh: '不感兴趣', type: 'negative' },
  blockAuthorScore: { name: 'Block', nameZh: '屏蔽', type: 'negative' },
  muteAuthorScore: { name: 'Mute', nameZh: '静音', type: 'negative' },
  reportScore: { name: 'Report', nameZh: '举报', type: 'negative' },
};
