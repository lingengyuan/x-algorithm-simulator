import { TweetCandidate, TweetInput, RankingScenario } from '@/core/types';
import { generateSnowflakeId, generateSnowflakeIdFromAge } from '@/utils/snowflake';
import { simulatePhoenixScores } from '@/utils/scoring';

// Mock author data
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
];

// Mock tweet contents
const TWEET_CONTENTS = [
  { content: 'Just shipped a new feature! 🚀 The team worked incredibly hard on this. Check out the demo at the link below.', hasImage: true, hasVideo: false },
  { content: 'Breaking: Major tech company announces layoffs affecting 10% of workforce. More details coming soon.', hasImage: false, hasVideo: false },
  { content: 'Hot take: The future of AI is not about replacing humans, but augmenting human capabilities. What do you think?', hasImage: false, hasVideo: false },
  { content: 'New tutorial: Building a recommendation system from scratch. 45 minute video walkthrough.', hasImage: false, hasVideo: true, videoDurationMs: 2700000 },
  { content: 'This chart shows why we need to pay attention to climate change NOW.', hasImage: true, hasVideo: false },
  { content: 'I interviewed 100 senior engineers. Here are the 5 skills they all have in common: 🧵', hasImage: false, hasVideo: false },
  { content: 'Just released my new open source project! Would love your feedback.', hasImage: true, hasVideo: false },
  { content: 'The market is going crazy today. Here\'s my analysis on what\'s happening.', hasImage: true, hasVideo: false },
  { content: 'Can someone explain why my code works in development but not in production? 😭', hasImage: false, hasVideo: false },
  { content: 'Beautiful sunset from my office window today 🌅', hasImage: true, hasVideo: false },
  { content: 'New research paper just dropped! We achieved state-of-the-art results on 3 benchmarks.', hasImage: true, hasVideo: false },
  { content: 'Quick thread on the most common mistakes I see in code reviews: 👇', hasImage: false, hasVideo: false },
  { content: 'Anyone else feeling burned out? Taking a mental health day today.', hasImage: false, hasVideo: false },
  { content: 'Live demo of our new product! Come join us.', hasImage: false, hasVideo: true, videoDurationMs: 45000 },
  { content: 'This meme is too accurate 😂💀', hasImage: true, hasVideo: false },
  { content: '10 years ago I quit my job to start a company. Today we just hit $1B valuation. Never give up on your dreams.', hasImage: false, hasVideo: false },
  { content: 'Unpopular opinion: TypeScript is overrated for small projects.', hasImage: false, hasVideo: false },
  { content: 'Just discovered this amazing productivity hack that saves me 2 hours every day!', hasImage: false, hasVideo: false },
  { content: 'Building in public, day 47: Finally got my first paying customer! 🎉', hasImage: true, hasVideo: false },
  { content: 'The new iPhone is disappointing. Here\'s why I\'m switching to Android.', hasImage: false, hasVideo: false },
  { content: 'PSA: There\'s a critical security vulnerability in a popular npm package. Update now!', hasImage: false, hasVideo: false },
  { content: 'My cat just figured out how to open doors. We\'re doomed.', hasImage: true, hasVideo: false },
  { content: 'Attended an amazing conference today. The future of tech is bright!', hasImage: true, hasVideo: false },
  { content: 'Why do recruiters always reach out on Friday afternoons? 🤔', hasImage: false, hasVideo: false },
  { content: 'Just finished reading "Clean Code". Every developer should read this book.', hasImage: true, hasVideo: false },
];

// Generate a random mock tweet candidate
export function generateMockTweet(
  index: number,
  hoursAgo?: number,
  inNetwork?: boolean
): TweetCandidate {
  const author = AUTHORS[index % AUTHORS.length];
  const tweetContent = TWEET_CONTENTS[index % TWEET_CONTENTS.length];

  const ageHours = hoursAgo ?? Math.random() * 168; // 0-7 days
  const id = generateSnowflakeIdFromAge(ageHours);

  const tweetInput: TweetInput = {
    content: tweetContent.content,
    hasMedia: tweetContent.hasVideo ? 'video' : tweetContent.hasImage ? 'image' : 'none',
    videoDurationMs: tweetContent.videoDurationMs,
    authorType: author.verified ? (author.followers > 100000 ? 'influencer' : 'verified') : 'normal',
    followerCount: author.followers,
  };

  // Use index as seed for reproducible scores
  const phoenixScores = simulatePhoenixScores(tweetInput, index * 12345);

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
    inNetwork: inNetwork ?? Math.random() > 0.4,
    isRetweet: Math.random() > 0.85,
    originalTweetId: undefined,
    phoenixScores,
    filtered: false,
  };
}

// Generate multiple mock tweets
export function generateMockTweets(count: number, inNetworkRatio: number = 0.6): TweetCandidate[] {
  const tweets: TweetCandidate[] = [];

  for (let i = 0; i < count; i++) {
    const inNetwork = Math.random() < inNetworkRatio;
    const hoursAgo = Math.random() * 120; // 0-5 days
    tweets.push(generateMockTweet(i, hoursAgo, inNetwork));
  }

  return tweets;
}

// Predefined ranking scenarios
export const RANKING_SCENARIOS: RankingScenario[] = [
  {
    id: 'following_feed',
    name: 'Following Feed',
    nameZh: '关注动态',
    description: 'Timeline with mostly followed accounts',
    descriptionZh: '主要来自已关注账号的时间线',
    candidateCount: 30,
    inNetworkRatio: 0.8,
  },
  {
    id: 'for_you',
    name: 'For You',
    nameZh: '推荐内容',
    description: 'Algorithmic recommendations mix',
    descriptionZh: '算法推荐的混合内容',
    candidateCount: 50,
    inNetworkRatio: 0.4,
  },
  {
    id: 'trending',
    name: 'Trending Topics',
    nameZh: '热门话题',
    description: 'Popular content from around the platform',
    descriptionZh: '来自平台各处的热门内容',
    candidateCount: 40,
    inNetworkRatio: 0.2,
  },
];

// Generate tweets for a specific scenario
export function generateScenarioTweets(scenario: RankingScenario): TweetCandidate[] {
  return generateMockTweets(scenario.candidateCount, scenario.inNetworkRatio);
}

// Default filter context for simulation
export function getDefaultFilterContext(): {
  currentUserId: string;
  blockedUsers: string[];
  mutedUsers: string[];
  seenTweetIds: string[];
  currentTime: number;
} {
  return {
    currentUserId: 'current_user',
    blockedUsers: ['blocked_author_1'],
    mutedUsers: ['muted_author_1'],
    seenTweetIds: [],
    currentTime: Date.now(),
  };
}
