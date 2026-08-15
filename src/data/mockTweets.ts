import type {
  FilterContext,
  RankingScenario,
  RelatedPostFixture,
  TweetCandidate,
  TweetInput,
} from '@/core/types';
import { FILTER_DEFAULTS, RANKING_CONSTANTS } from '@/data/upstreamSnapshot';
import { createSeededRandom, simulatePhoenixScores } from '@/utils/scoring';
import { generateSnowflakeIdFromAge } from '@/utils/snowflake';

const CURRENT_USER_ID = '999';

const AUTHORS = [
  { id: '101', name: 'Tech News', followers: 1_500_000, verified: true, avatar: '🤖' },
  { id: '102', name: 'Sarah Dev', followers: 45_000, verified: true, avatar: '👩‍💻' },
  { id: '103', name: 'AI Researcher', followers: 250_000, verified: true, avatar: '🧪' },
  { id: '104', name: 'John Doe', followers: 1_200, verified: false, avatar: '👤' },
  { id: '105', name: 'Startup Founder', followers: 85_000, verified: true, avatar: '🚀' },
  { id: '106', name: 'Crypto Analyst', followers: 500_000, verified: false, avatar: '📈' },
  { id: '107', name: 'Designer Pro', followers: 120_000, verified: true, avatar: '🎨' },
  { id: '108', name: 'Data Scientist', followers: 75_000, verified: true, avatar: '📊' },
  { id: '109', name: 'Meme Lab', followers: 350_000, verified: false, avatar: '😂' },
  { id: '110', name: 'Indie Builder', followers: 640, verified: false, avatar: '🧰' },
  { id: '14160928', name: 'News Anchor', followers: 2_000_000, verified: true, avatar: '📺' },
  { id: CURRENT_USER_ID, name: 'You', followers: 3_200, verified: false, avatar: '🙂' },
] as const;

const FOLLOWED_AUTHOR_IDS = new Set(['101', '102', '103', '105', '107', '110']);
const IN_NETWORK_AUTHORS = AUTHORS.filter((author) =>
  author.id === CURRENT_USER_ID || FOLLOWED_AUTHOR_IDS.has(author.id)
);
const OUT_OF_NETWORK_AUTHORS = AUTHORS.filter((author) =>
  author.id !== CURRENT_USER_ID && !FOLLOWED_AUTHOR_IDS.has(author.id)
);

const TWEET_CONTENTS = [
  { content: 'Just shipped a new feature! 🚀 The team worked hard on this. Here is the demo.', hasImage: true, hasVideo: false },
  { content: 'Breaking: A major technology company announced a product reorganization.', hasImage: false, hasVideo: false },
  { content: 'The future of AI is about augmenting people, not replacing them. Thoughts?', hasImage: false, hasVideo: false },
  { content: 'New tutorial: building a recommendation system from scratch. Full walkthrough video.', hasImage: false, hasVideo: true, videoDurationMs: 270_000 },
  { content: 'This chart shows why climate trends matter now.', hasImage: true, hasVideo: false },
  { content: 'I interviewed 100 senior engineers. Here are the top five skills. 🧵', hasImage: false, hasVideo: false },
  { content: 'Just released my new open-source project. Feedback welcome!', hasImage: true, hasVideo: false },
  { content: 'Market volatility is back. Here is my analysis thread.', hasImage: true, hasVideo: false },
  { content: 'Can someone explain why this works in development but fails in production?', hasImage: false, hasVideo: false },
  { content: 'Beautiful sunset from the office today 🌅', hasImage: true, hasVideo: false },
  { content: 'New AI research paper reports gains on three benchmarks.', hasImage: true, hasVideo: false },
  { content: 'Quick thread on common code review mistakes 👇', hasImage: false, hasVideo: false },
  { content: 'Anyone else feeling burned out? Taking a mental-health day.', hasImage: false, hasVideo: false },
  { content: 'Live product demo this evening. Join us.', hasImage: false, hasVideo: true, videoDurationMs: 45_000 },
  { content: 'This meme is too accurate 😂💀', hasImage: true, hasVideo: false },
  { content: 'Critical vulnerability in a popular npm package. Patch now.', hasImage: false, hasVideo: false },
  { content: 'Crypto markets are volatile today. Risk management matters.', hasImage: false, hasVideo: false },
  { content: 'Giveaway alert! Reply to enter.', hasImage: false, hasVideo: false },
  { content: 'Spoiler: the new episode ends with a major twist.', hasImage: false, hasVideo: false },
  { content: 'Graphic violence footage is circulating today. Avoid resharing it.', hasImage: false, hasVideo: true, videoDurationMs: 18_000 },
] as const;

export const TOPICS = {
  scienceTechnology: '1000000000000000001',
  entertainment: '1000000000000000002',
  businessFinanceCategory: '1000000000000000003',
  ai: '1925953013547450368',
  software: '1925953040130953216',
  businessFinance: '1925949659857530880',
  crypto: '1925949693290295298',
  moviesTv: '1925949788068909057',
  news: '1925949634972626944',
  mentalHealth: '1925953421338726400',
} as const;

function random(seed: number): number {
  return createSeededRandom(seed * 7_919 + 17)();
}

function inferTopicIds(content: string): string[] {
  const text = content.toLowerCase();
  const topics = new Set<string>();
  if (text.includes('ai') || text.includes('recommendation') || text.includes('research')) topics.add(TOPICS.ai);
  if (text.includes('code') || text.includes('npm') || text.includes('engineer') || text.includes('development')) topics.add(TOPICS.software);
  if (text.includes('market') || text.includes('startup')) topics.add(TOPICS.businessFinance);
  if (text.includes('crypto')) topics.add(TOPICS.crypto);
  if (text.includes('video') || text.includes('demo') || text.includes('episode')) topics.add(TOPICS.moviesTv);
  if (text.includes('mental')) topics.add(TOPICS.mentalHealth);
  if (topics.size === 0) topics.add(TOPICS.news);
  return [...topics];
}

function topicEmbedding(topicIds: string[], seed: number): number[] {
  const anchors: Record<string, number[]> = {
    [TOPICS.ai]: [1, 0.8, 0.1, 0, 0, 0, 0, 0],
    [TOPICS.software]: [0.9, 1, 0.1, 0, 0, 0, 0, 0],
    [TOPICS.businessFinance]: [0, 0.1, 1, 0.8, 0, 0, 0, 0],
    [TOPICS.crypto]: [0, 0.1, 0.9, 1, 0, 0, 0, 0],
    [TOPICS.moviesTv]: [0, 0, 0, 0.1, 1, 0.7, 0, 0],
    [TOPICS.news]: [0.2, 0.2, 0.3, 0.2, 0.2, 0.2, 1, 0.4],
    [TOPICS.mentalHealth]: [0, 0, 0, 0, 0.2, 0.2, 0.4, 1],
  };
  const base = anchors[topicIds[0]] || anchors[TOPICS.news];
  const rng = createSeededRandom(seed);
  const vector = Array.from(
    { length: RANKING_CONSTANTS.vmRankerEmbeddingDimension },
    (_, index) => (base[index] || 0) + (rng() - 0.5) * 0.01
  );
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map((value) => value / norm);
}

export function generateMockTweet(
  index: number,
  hoursAgo?: number,
  inNetwork?: boolean
): TweetCandidate {
  const networkMembership = inNetwork ?? random(index + 19) > 0.4;
  const authorPool = networkMembership ? IN_NETWORK_AUTHORS : OUT_OF_NETWORK_AUTHORS;
  const author = authorPool[index % authorPool.length];
  const tweetContent = TWEET_CONTENTS[index % TWEET_CONTENTS.length];
  const ageHours = hoursAgo ?? random(index + 7) * 120;
  const id = generateSnowflakeIdFromAge(ageHours, index * 4_099 + 97);
  const input: TweetInput = {
    content: tweetContent.content,
    hasMedia: tweetContent.hasVideo ? 'video' : tweetContent.hasImage ? 'image' : 'none',
    videoDurationMs: 'videoDurationMs' in tweetContent ? tweetContent.videoDurationMs : undefined,
    authorType: author.verified ? (author.followers > 100_000 ? 'influencer' : 'verified') : 'normal',
    followerCount: author.followers,
  };
  const phoenixScores = simulatePhoenixScores(input, index * 12_345 + 99);
  const filteredTopicIds = inferTopicIds(tweetContent.content);
  const isQuote = random(index + 31) > 0.82;
  const quotedAuthor = isQuote ? AUTHORS[(index + 3) % AUTHORS.length] : undefined;
  const risky = tweetContent.content.toLowerCase().includes('graphic violence');
  const lowRisk = !risky && random(index + 181) > 0.86;
  const safetyLabels = risky
    ? ['GROK_SFA', 'PTOS_REVIEWED', 'GORE_AND_VIOLENCE_HIGH_PRECISION']
    : lowRisk
      ? ['GROK_SFA', 'PTOS_REVIEWED', 'NSFA_LIMITED_INVENTORY']
      : ['GROK_SFA', 'PTOS_REVIEWED'];
  const viewCount = Math.floor(random(index + 193) * 12_000);

  return {
    id,
    content: tweetContent.content,
    authorId: author.id,
    authorName: author.name,
    authorFollowers: author.followers,
    authorVerified: author.verified,
    authorAvatar: author.avatar,
    hasImage: tweetContent.hasImage,
    hasVideo: tweetContent.hasVideo,
    videoDurationMs: 'videoDurationMs' in tweetContent ? tweetContent.videoDurationMs : undefined,
    createdAt: Date.now() - ageHours * 3_600_000,
    inNetwork: networkMembership,
    conversationId: undefined,
    ancestors: [],
    ancestorUserIds: [],
    isRetweet: false,
    quotedTweetId: isQuote
      ? generateSnowflakeIdFromAge(ageHours + 12, index * 2_059 + 31)
      : undefined,
    quotedAuthorId: quotedAuthor?.id,
    visibilityAction: 'allow',
    dropAncillaryPosts: false,
    authorBlocksViewer: false,
    quotedAuthorBlocksViewer: false,
    filteredTopicIds,
    unfilteredTopicIds: [...new Set([...filteredTopicIds, TOPICS.news])],
    followingRepliedUserIds: [],
    languageCode: index % 13 === 0 ? 'es' : 'en',
    favoriteCount: Math.floor(random(index + 157) * 12_000),
    replyCount: Math.floor(random(index + 163) * 1_800),
    repostCount: Math.floor(random(index + 167) * 3_000),
    quoteCount: Math.floor(random(index + 173) * 900),
    viewCount,
    bookmarkCount: Math.floor(random(index + 175) * 700),
    isMutualFollowAuthor: FOLLOWED_AUTHOR_IDS.has(author.id) && index % 9 === 0,
    authorFollowsViewer: index % 9 === 0,
    nsfwAuthor: risky,
    brandSafetyVerdict: risky ? 'medium_risk' : lowRisk ? 'low_risk' : 'safe',
    safetyLabels,
    visibilityFeatures: risky ? { tweetNsfwAdmin: true } : { authorState: 'active' },
    semanticIds: filteredTopicIds,
    embedding: topicEmbedding(filteredTopicIds, index * 271 + 3),
    quotedVideoDurationMs: isQuote && random(index + 191) > 0.5 ? 45_000 : undefined,
    phoenixScores,
    filtered: false,
  };
}

function enrichRelationships(tweets: TweetCandidate[]): TweetCandidate[] {
  const enriched = tweets.map((tweet) => ({ ...tweet }));
  for (let index = 0; index < enriched.length; index += 1) {
    const rootIndex = Math.floor(index / 4) * 4;
    const root = enriched[rootIndex];
    if (index !== rootIndex && random(index + 41) > 0.3) {
      enriched[index].conversationId = root.id;
      enriched[index].ancestors = [root.id];
      enriched[index].ancestorUserIds = [root.authorId];
      enriched[index].inReplyToTweetId = root.id;
    }

    if (index > 2 && random(index + 53) > 0.86) {
      const original = enriched[Math.floor(random(index + 67) * index)];
      enriched[index].isRetweet = true;
      enriched[index].originalTweetId = original.id;
      enriched[index].retweetedAuthorId = original.authorId;
      enriched[index].inReplyToTweetId = undefined;
      enriched[index].conversationId = original.conversationId;
      enriched[index].ancestors = original.ancestors;
      enriched[index].ancestorUserIds = original.ancestorUserIds;
    }

    if (random(index + 79) > 0.92) enriched[index].subscriptionAuthorId = enriched[index].authorId;
    if (random(index + 109) > 0.985) enriched[index].authorBlocksViewer = true;
    if (enriched[index].quotedTweetId && random(index + 113) > 0.98) {
      enriched[index].quotedAuthorBlocksViewer = true;
    }
  }

  const byId = new Map(enriched.map((tweet) => [tweet.id, tweet]));
  for (const tweet of enriched) {
    const relatedIds = [
      ...(tweet.ancestors || []),
      tweet.quotedTweetId,
      tweet.originalTweetId,
    ].filter((id): id is string => Boolean(id));
    const relatedPosts: Record<string, RelatedPostFixture> = {};
    for (const id of relatedIds) {
      const related = byId.get(id);
      if (!related) {
        relatedPosts[id] = {
          id,
          authorId: id === tweet.quotedTweetId ? tweet.quotedAuthorId || '0' : '0',
          hasImage: false,
          hasVideo: false,
          isRetweet: false,
          safetyLabels: ['GROK_SFA', 'PTOS_REVIEWED'],
          visibilityFeatures: { authorState: 'active' },
        };
        continue;
      }
      relatedPosts[id] = {
        id: related.id,
        authorId: related.authorId,
        hasImage: related.hasImage,
        hasVideo: related.hasVideo,
        isRetweet: related.isRetweet,
        safetyLabels: related.safetyLabels,
        nsfwAuthor: related.nsfwAuthor,
        visibilityFeatures: related.visibilityFeatures,
      };
    }
    tweet.relatedPosts = relatedPosts;
  }
  return enriched;
}

export function generateMockTweets(count: number, inNetworkRatio = 0.6): TweetCandidate[] {
  return enrichRelationships(Array.from({ length: count }, (_, index) =>
    generateMockTweet(index, random(index + 149) * 120, random(index + 131) < inNetworkRatio)
  ));
}

export const RANKING_SCENARIOS: RankingScenario[] = [
  {
    id: 'following_feed',
    name: 'In-network heavy',
    nameZh: '关注内为主',
    description: 'Mostly posts from followed accounts',
    descriptionZh: '以关注账号内容为主',
    candidateCount: 60,
    inNetworkRatio: 0.82,
  },
  {
    id: 'for_you',
    name: 'For You default',
    nameZh: 'For You 默认',
    description: 'Published primary defaults with mixed inventory',
    descriptionZh: '公开主默认值与混合候选池',
    candidateCount: 90,
    inNetworkRatio: 0.45,
  },
  {
    id: 'discovery',
    name: 'Topic request',
    nameZh: '话题请求',
    description: 'Normal topic request using PhoenixTopicsSource',
    descriptionZh: '使用 PhoenixTopicsSource 的普通话题请求',
    candidateCount: 90,
    inNetworkRatio: 0.25,
  },
];

export function generateScenarioTweets(scenario: RankingScenario): TweetCandidate[] {
  return generateMockTweets(scenario.candidateCount, scenario.inNetworkRatio);
}

export function getDefaultFilterContext(
  candidates: TweetCandidate[] = [],
  scenario?: RankingScenario
): FilterContext {
  const isForYou = scenario?.id !== 'following_feed';
  return {
    currentUserId: CURRENT_USER_ID,
    blockedUsers: ['109'],
    mutedUsers: ['104'],
    mutedKeywords: ['crypto', 'giveaway', 'spoiler'],
    followedAuthorIds: [...FOLLOWED_AUTHOR_IDS],
    subscribedAuthorIds: ['101', '103', '14160928'],
    seenTweetIds: candidates.slice(0, 2).map((candidate) => candidate.id),
    servedTweetIds: candidates.slice(2, 4).map((candidate) => candidate.id),
    bloomSeenTweetIds: candidates.slice(4, 5).map((candidate) => candidate.id),
    cachedPostIds: [],
    inNetworkOnly: false,
    isBottomRequest: scenario?.id === 'discovery',
    hasPostEngagementSignals: true,
    currentTime: Date.now(),
    maxTweetAgeHours: FILTER_DEFAULTS.maxPostAgeHours,
    impressedTweetIds: candidates.slice(5, 7).map((candidate) => candidate.id),
    topicIds: scenario?.id === 'discovery' ? [TOPICS.ai] : [],
    excludedTopicIds: scenario?.id === 'for_you' ? [TOPICS.crypto] : [],
    isBulkTopicRequest: false,
    excludeVideos: false,
    userAccountAgeSeconds: scenario?.id === 'for_you' ? 5 * 86_400 : 180 * 86_400,
    followedCount: scenario?.id === 'for_you' ? 18 : 240,
    viewerFollowerCount: 3_200,
    enableServedFilterAllRequests: FILTER_DEFAULTS.enableServedFilterAllRequests,
    enableNewUserMinEngagementFilter: FILTER_DEFAULTS.newUserMinEngagement.enabled,
    newUserMinEngagementMetric: FILTER_DEFAULTS.newUserMinEngagement.metric,
    newUserMinEngagementUseRatio: FILTER_DEFAULTS.newUserMinEngagement.useRatio,
    newUserMinEngagementThreshold: FILTER_DEFAULTS.newUserMinEngagement.threshold,
    newUserMinEngagementMaxAccountAgeSecs: FILTER_DEFAULTS.newUserMinEngagement.maxAccountAgeSecs,
    newUserMinEngagementMaxResurrectionAgeSecs: FILTER_DEFAULTS.newUserMinEngagement.maxResurrectionAgeSecs,
    enableInventoryHoldout: FILTER_DEFAULTS.inventoryHoldout.enabled,
    inventoryHoldoutOriginalsPercent: FILTER_DEFAULTS.inventoryHoldout.originalsPercent,
    inventoryHoldoutRepliesPercent: FILTER_DEFAULTS.inventoryHoldout.repliesPercent,
    inventoryHoldoutRetweetsPercent: FILTER_DEFAULTS.inventoryHoldout.retweetsPercent,
    engagedSemanticIds: [TOPICS.ai, TOPICS.software],
    whoToFollowEligible: isForYou,
    feedSurveyEligible: isForYou,
    adFixtures: isForYou
      ? Array.from({ length: 8 }, (_, index) => ({
          id: `fixture-ad-${index}`,
          insertPosition: 1 + index * 3,
          brandSafetyRisk: 'unknown' as const,
          handles: [],
          keywords: [],
        }))
      : [],
    promptCount: isForYou ? 1 : 0,
    jetfuelFrameCount: 0,
    viewerLoggedOut: false,
    viewerAge: { status: 'known', age: 25 },
    viewerAccountCountryCode: 'cn',
    viewerCountryCode: 'cn',
    ipAddress: '',
    viewerAllowsSensitiveMedia: false,
  };
}
