import { TweetCandidate, FilterContext, FilterConfig, FilterResult } from '@/core/types';
import { getAgeInDays, getAgeInHours } from '@/utils/snowflake';

// Filter definitions with simulation logic
export const FILTERS: FilterConfig[] = [
  {
    id: 'drop_duplicates',
    name: 'DropDuplicatesFilter',
    nameZh: '去重过滤器',
    description: 'Remove duplicate tweets from the same conversation',
    descriptionZh: '移除来自同一对话的重复推文',
    enabled: true,
  },
  {
    id: 'age',
    name: 'AgeFilter',
    nameZh: '时效过滤器',
    description: 'Filter tweets older than 7 days',
    descriptionZh: '过滤超过7天的旧推文',
    enabled: true,
  },
  {
    id: 'self_tweet',
    name: 'SelfTweetFilter',
    nameZh: '自己推文过滤器',
    description: 'Remove user\'s own tweets from timeline',
    descriptionZh: '从时间线移除自己发布的推文',
    enabled: true,
  },
  {
    id: 'blocked_author',
    name: 'BlockedAuthorFilter',
    nameZh: '已屏蔽作者过滤器',
    description: 'Remove tweets from blocked users',
    descriptionZh: '移除被屏蔽用户的推文',
    enabled: true,
  },
  {
    id: 'muted_author',
    name: 'MutedAuthorFilter',
    nameZh: '已静音作者过滤器',
    description: 'Remove tweets from muted users',
    descriptionZh: '移除被静音用户的推文',
    enabled: true,
  },
  {
    id: 'seen_tweets',
    name: 'SeenTweetsFilter',
    nameZh: '已看推文过滤器',
    description: 'Remove tweets user has already seen',
    descriptionZh: '移除用户已经看过的推文',
    enabled: true,
  },
  {
    id: 'nsfw',
    name: 'NSFWFilter',
    nameZh: '敏感内容过滤器',
    description: 'Filter sensitive/adult content based on user settings',
    descriptionZh: '根据用户设置过滤敏感/成人内容',
    enabled: true,
  },
  {
    id: 'low_quality',
    name: 'LowQualityFilter',
    nameZh: '低质量内容过滤器',
    description: 'Filter low quality or spam-like content',
    descriptionZh: '过滤低质量或类似垃圾信息的内容',
    enabled: true,
  },
  {
    id: 'conversation_depth',
    name: 'ConversationDepthFilter',
    nameZh: '对话深度过滤器',
    description: 'Filter deeply nested replies (depth > 3)',
    descriptionZh: '过滤深度嵌套的回复（深度 > 3）',
    enabled: true,
  },
  {
    id: 'retweet_of_seen',
    name: 'RetweetOfSeenFilter',
    nameZh: '已看内容转发过滤器',
    description: 'Filter retweets of already seen content',
    descriptionZh: '过滤已看内容的转发',
    enabled: true,
  },
  {
    id: 'author_diversity',
    name: 'AuthorDiversityPreFilter',
    nameZh: '作者多样性预过滤器',
    description: 'Limit tweets from same author in initial pool',
    descriptionZh: '限制初始候选池中同一作者的推文数量',
    enabled: true,
  },
  {
    id: 'negative_feedback',
    name: 'NegativeFeedbackFilter',
    nameZh: '负面反馈过滤器',
    description: 'Filter content with high negative feedback signals',
    descriptionZh: '过滤具有高负面反馈信号的内容',
    enabled: true,
  },
];

// Filter implementation functions
const filterFunctions: Record<string, (candidate: TweetCandidate, context: FilterContext, candidates?: TweetCandidate[]) => boolean> = {
  drop_duplicates: (candidate, _context, candidates) => {
    if (!candidates || !candidate.conversationId) return true;
    // Keep only the first tweet in each conversation
    const firstInConvo = candidates.find(c =>
      c.conversationId === candidate.conversationId && !c.filtered
    );
    return !firstInConvo || firstInConvo.id === candidate.id;
  },

  age: (candidate) => {
    const ageDays = getAgeInDays(candidate.id);
    return ageDays <= 7;
  },

  self_tweet: (candidate, context) => {
    return candidate.authorId !== context.currentUserId;
  },

  blocked_author: (candidate, context) => {
    return !context.blockedUsers.includes(candidate.authorId);
  },

  muted_author: (candidate, context) => {
    return !context.mutedUsers.includes(candidate.authorId);
  },

  seen_tweets: (candidate, context) => {
    return !context.seenTweetIds.includes(candidate.id);
  },

  nsfw: (candidate) => {
    // Simulate NSFW detection
    const nsfwKeywords = ['nsfw', 'explicit', '18+', 'adult'];
    const contentLower = candidate.content.toLowerCase();
    return !nsfwKeywords.some(kw => contentLower.includes(kw));
  },

  low_quality: (candidate) => {
    // Simulate quality scoring
    const content = candidate.content;

    // Too short
    if (content.length < 5) return false;

    // All caps (shouting)
    if (content === content.toUpperCase() && content.length > 10) return false;

    // Too many hashtags
    const hashtags = content.match(/#\w+/g) || [];
    if (hashtags.length > 10) return false;

    // Excessive mentions
    const mentions = content.match(/@\w+/g) || [];
    if (mentions.length > 10) return false;

    // Spam-like patterns
    if (/(.)\1{5,}/.test(content)) return false; // Repeated characters

    return true;
  },

  conversation_depth: (candidate) => {
    // Simulate conversation depth check
    // In real system, this would check reply chain depth
    return Math.random() > 0.05; // 5% chance of filtering
  },

  retweet_of_seen: (candidate, context) => {
    if (!candidate.isRetweet || !candidate.originalTweetId) return true;
    return !context.seenTweetIds.includes(candidate.originalTweetId);
  },

  author_diversity: (candidate, _context, candidates) => {
    if (!candidates) return true;
    // Limit to 3 tweets per author in initial pool
    const authorTweets = candidates.filter(
      c => c.authorId === candidate.authorId && !c.filtered
    );
    const index = authorTweets.findIndex(c => c.id === candidate.id);
    return index < 3;
  },

  negative_feedback: (candidate) => {
    const scores = candidate.phoenixScores;
    // Filter if negative signals are too high
    const negativeSum =
      scores.notInterestedScore +
      scores.blockAuthorScore * 2 +
      scores.muteAuthorScore * 1.5 +
      scores.reportScore * 3;
    return negativeSum < 0.5;
  },
};

// Run a single filter
export function runFilter(
  filterId: string,
  candidates: TweetCandidate[],
  context: FilterContext
): FilterResult {
  const filterConfig = FILTERS.find(f => f.id === filterId);
  if (!filterConfig || !filterConfig.enabled) {
    return {
      filterId,
      filterName: filterConfig?.name || filterId,
      inputCount: candidates.length,
      outputCount: candidates.length,
      filteredCandidates: [],
      passedCandidates: candidates,
    };
  }

  const filterFn = filterFunctions[filterId];
  if (!filterFn) {
    return {
      filterId,
      filterName: filterConfig.name,
      inputCount: candidates.length,
      outputCount: candidates.length,
      filteredCandidates: [],
      passedCandidates: candidates,
    };
  }

  const passedCandidates: TweetCandidate[] = [];
  const filteredCandidates: TweetCandidate[] = [];

  for (const candidate of candidates) {
    if (candidate.filtered) {
      // Already filtered by previous filter
      filteredCandidates.push(candidate);
      continue;
    }

    const passed = filterFn(candidate, context, candidates);
    if (passed) {
      passedCandidates.push(candidate);
    } else {
      filteredCandidates.push({
        ...candidate,
        filtered: true,
        filteredBy: filterId,
        filterReason: filterConfig.description,
      });
    }
  }

  return {
    filterId,
    filterName: filterConfig.name,
    inputCount: candidates.length,
    outputCount: passedCandidates.length,
    filteredCandidates,
    passedCandidates,
  };
}

// Run all filters in sequence
export function runAllFilters(
  candidates: TweetCandidate[],
  context: FilterContext,
  enabledFilterIds?: string[]
): { results: FilterResult[]; finalCandidates: TweetCandidate[] } {
  const results: FilterResult[] = [];
  let currentCandidates = [...candidates];

  for (const filter of FILTERS) {
    if (enabledFilterIds && !enabledFilterIds.includes(filter.id)) {
      continue;
    }

    const result = runFilter(filter.id, currentCandidates, context);
    results.push(result);

    // Update candidates for next filter
    currentCandidates = result.passedCandidates;
  }

  return { results, finalCandidates: currentCandidates };
}

// Get filter by ID
export function getFilterById(id: string): FilterConfig | undefined {
  return FILTERS.find(f => f.id === id);
}
