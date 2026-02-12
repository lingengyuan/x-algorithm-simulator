import { TweetCandidate, TweetInput, RankingScenario, FilterContext } from '@/core/types';
import { generateSnowflakeIdFromAge } from '@/utils/snowflake';
import { simulatePhoenixScores } from '@/utils/scoring';

const AUTHORS = [
  { id: 'author_1', name: 'Tech News', followers: 1500000, verified: true, avatar: '🤖' },
  { id: 'author_2', name: 'Sarah Dev', followers: 45000, verified: true, avatar: '👩‍💻' },
  { id: 'author_3', name: 'AI Researcher', followers: 250000, verified: true, avatar: '🧪' },
  { id: 'author_4', name: 'John Doe', followers: 1200, verified: false, avatar: '👤' },
  { id: 'author_5', name: 'StartupFounder', followers: 85000, verified: true, avatar: '🚀' },
  { id: 'author_6', name: 'Crypto Whale', followers: 500000, verified: false, avatar: '🐳' },
  { id: 'author_7', name: 'Designer Pro', followers: 120000, verified: true, avatar: '🎨' },
  { id: 'author_8', name: 'Data Scientist', followers: 75000, verified: true, avatar: '📊' },
  { id: 'author_9', name: 'Meme Lord', followers: 350000, verified: false, avatar: '😂' },
  { id: 'author_10', name: 'News Anchor', followers: 2000000, verified: true, avatar: '📺' },
  { id: 'current_user', name: 'You', followers: 3200, verified: false, avatar: '🙂' },
];

const TWEET_CONTENTS = [
  { content: 'Just shipped a new feature! 🚀 The team worked incredibly hard on this. Check out the demo below.', hasImage: true, hasVideo: false },
  { content: 'Breaking: Major tech company announces layoffs affecting 10% of workforce.', hasImage: false, hasVideo: false },
  { content: 'Hot take: The future of AI is about augmenting humans, not replacing them. Thoughts?', hasImage: false, hasVideo: false },
  { content: 'New tutorial: Building a recommendation system from scratch. Full walkthrough video.', hasImage: false, hasVideo: true, videoDurationMs: 270000 },
  { content: 'This chart shows why climate trends matter now.', hasImage: true, hasVideo: false },
  { content: 'I interviewed 100 senior engineers. Here are the top 5 skills. 🧵', hasImage: false, hasVideo: false },
  { content: 'Just released my new open-source project. Feedback welcome!', hasImage: true, hasVideo: false },
  { content: 'Market volatility is back. Here is my analysis thread.', hasImage: true, hasVideo: false },
  { content: 'Can someone explain why this works in dev but fails in prod?', hasImage: false, hasVideo: false },
  { content: 'Beautiful sunset from the office today 🌅', hasImage: true, hasVideo: false },
  { content: 'New research paper dropped with SOTA gains on three benchmarks.', hasImage: true, hasVideo: false },
  { content: 'Quick thread on common code review mistakes 👇', hasImage: false, hasVideo: false },
  { content: 'Anyone else feeling burned out? Taking a mental health day.', hasImage: false, hasVideo: false },
  { content: 'Live product demo this evening. Join us.', hasImage: false, hasVideo: true, videoDurationMs: 45000 },
  { content: 'This meme is too accurate 😂💀', hasImage: true, hasVideo: false },
  { content: 'PSA: Critical vulnerability in a popular npm package. Patch now.', hasImage: false, hasVideo: false },
  { content: 'Crypto markets are wild today. Risk management matters.', hasImage: false, hasVideo: false },
  { content: 'Giveaway alert! Reply to win a laptop.', hasImage: false, hasVideo: false },
  { content: 'Spoiler: this new episode ends with a huge twist.', hasImage: false, hasVideo: false },
  { content: 'Graphic violence footage circulating today. Please avoid resharing.', hasImage: false, hasVideo: false },
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

function pickAuthor(index: number) {
  return AUTHORS[index % AUTHORS.length];
}

function pickContent(index: number) {
  return TWEET_CONTENTS[index % TWEET_CONTENTS.length];
}

export function generateMockTweet(
  index: number,
  hoursAgo?: number,
  inNetwork?: boolean
): TweetCandidate {
  const author = pickAuthor(index);
  const tweetContent = pickContent(index);
  const randomAge = seededRandom(index + 7) * 168; // 0-7 days
  const ageHours = hoursAgo ?? randomAge;

  const id = generateSnowflakeIdFromAge(ageHours);
  const tweetInput: TweetInput = {
    content: tweetContent.content,
    hasMedia: tweetContent.hasVideo ? 'video' : tweetContent.hasImage ? 'image' : 'none',
    videoDurationMs: tweetContent.videoDurationMs,
    authorType: author.verified ? (author.followers > 100000 ? 'influencer' : 'verified') : 'normal',
    followerCount: author.followers,
  };

  const phoenixScores = simulatePhoenixScores(tweetInput, index * 12345 + 99);

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
    videoDurationMs: tweetContent.videoDurationMs,
    createdAt: Date.now() - ageHours * 60 * 60 * 1000,
    inNetwork: inNetwork ?? seededRandom(index + 19) > 0.4,
    servedType: undefined,
    conversationId: undefined,
    ancestors: [],
    isRetweet: false,
    originalTweetId: undefined,
    subscriptionAuthorId: undefined,
    visibilityFiltered: false,
    phoenixScores,
    filtered: false,
  };
}

function enrichConversationAndRetweets(tweets: TweetCandidate[]): TweetCandidate[] {
  const enriched = tweets.map((tweet) => ({ ...tweet }));

  for (let i = 0; i < enriched.length; i++) {
    const convoBucket = Math.floor(i / 4);
    const defaultConversationId = `conversation_${convoBucket}`;

    if (seededRandom(i + 41) > 0.3) {
      enriched[i].conversationId = defaultConversationId;
      enriched[i].ancestors = [defaultConversationId];
    }

    // deterministic retweet simulation
    if (i > 2 && seededRandom(i + 53) > 0.84) {
      const originalIndex = Math.floor(seededRandom(i + 67) * i);
      const original = enriched[originalIndex];
      const conversationId = original.conversationId || defaultConversationId;
      enriched[i].isRetweet = true;
      enriched[i].originalTweetId = original.id;
      enriched[i].conversationId = conversationId;
      enriched[i].ancestors = [conversationId];
    }

    // deterministic subscription-only marker
    if (seededRandom(i + 79) > 0.9) {
      enriched[i].subscriptionAuthorId = enriched[i].authorId;
    }

    // deterministic VF-style drop signal
    if (seededRandom(i + 97) > 0.975) {
      enriched[i].visibilityFiltered = true;
    }
  }

  return enriched;
}

export function generateMockTweets(count: number, inNetworkRatio = 0.6): TweetCandidate[] {
  const tweets: TweetCandidate[] = [];

  for (let i = 0; i < count; i++) {
    const inNetwork = seededRandom(i + 131) < inNetworkRatio;
    const hoursAgo = seededRandom(i + 149) * 120; // 0-5 days
    tweets.push(generateMockTweet(i, hoursAgo, inNetwork));
  }

  return enrichConversationAndRetweets(tweets);
}

export const RANKING_SCENARIOS: RankingScenario[] = [
  {
    id: 'following_feed',
    name: 'Following Feed',
    nameZh: '关注动态',
    description: 'Mostly in-network content from followed accounts',
    descriptionZh: '以关注网络内容为主',
    candidateCount: 40,
    inNetworkRatio: 0.82,
  },
  {
    id: 'for_you',
    name: 'For You',
    nameZh: '推荐内容',
    description: 'Balanced in-network and out-of-network recommendations',
    descriptionZh: '内外网平衡推荐流',
    candidateCount: 60,
    inNetworkRatio: 0.45,
  },
  {
    id: 'discovery',
    name: 'Discovery Heavy',
    nameZh: '探索型推荐',
    description: 'Out-of-network heavy recommendation distribution',
    descriptionZh: '外网探索占比更高',
    candidateCount: 60,
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
  const seenTweetIds = candidates.slice(0, 2).map((candidate) => candidate.id);
  const servedTweetIds = candidates.slice(2, 4).map((candidate) => candidate.id);

  return {
    currentUserId: 'current_user',
    blockedUsers: ['author_9'],
    mutedUsers: ['author_4'],
    mutedKeywords: ['crypto', 'giveaway', 'spoiler'],
    followedAuthorIds: ['author_1', 'author_2', 'author_3', 'author_5', 'author_7'],
    subscribedAuthorIds: ['author_1', 'author_3', 'author_10'],
    seenTweetIds,
    servedTweetIds,
    bloomSeenTweetIds: candidates.slice(4, 5).map((candidate) => candidate.id),
    inNetworkOnly: scenario?.id === 'following_feed',
    isBottomRequest: scenario?.id === 'discovery',
    currentTime: Date.now(),
    maxTweetAgeHours: 24 * 7,
  };
}
