import { FeedBlendResult, FeedItem, FilterContext, TweetCandidate } from '@/core/types';

const MIN_POSTS_FOR_ADS = 5;
const DEFAULT_AD_INSERT_AFTER_POSTS = 3;
const WHO_TO_FOLLOW_POSITION = 5;

function createPostItem(tweet: TweetCandidate, rank: number): FeedItem {
  return {
    id: `post-${tweet.id}`,
    type: 'post',
    rank,
    tweet,
    score: tweet.finalScore,
    label: 'Post',
    labelZh: '帖子',
    title: tweet.authorName,
    titleZh: tweet.authorName,
    description: tweet.content,
    descriptionZh: tweet.content,
    source: 'ScoredPostsSource',
  };
}

function createPushToHomeItem(rank: number): FeedItem {
  return {
    id: 'module-push-to-home',
    type: 'push_to_home',
    rank,
    label: 'Pinned Module',
    labelZh: '置顶模块',
    title: 'Push-to-home module',
    titleZh: 'Push-to-home 模块',
    description: 'Pinned module inserted before the organic feed when available.',
    descriptionZh: '可用时插入到自然内容前的置顶模块。',
    source: 'PushToHomeSource',
  };
}

function createAdItem(rank: number): FeedItem {
  return {
    id: `module-ad-${rank}`,
    type: 'ad',
    rank,
    label: 'Ad',
    labelZh: '广告',
    title: 'Brand-safe promoted post',
    titleZh: '品牌安全广告内容',
    description: 'Inserted with a safe organic gap instead of being ranked as a normal post.',
    descriptionZh: '按安全间隔插入，不作为普通帖子参与排序。',
    source: 'AdsSource',
  };
}

function createWhoToFollowItem(rank: number): FeedItem {
  return {
    id: 'module-who-to-follow',
    type: 'who_to_follow',
    rank,
    label: 'Who to follow',
    labelZh: '推荐关注',
    title: 'Suggested accounts',
    titleZh: '推荐关注账号',
    description: 'A follow recommendation module blended into the timeline.',
    descriptionZh: '混入时间线的关注推荐模块。',
    source: 'WhoToFollowSource',
  };
}

function createPromptItem(rank: number): FeedItem {
  return {
    id: 'module-prompt',
    type: 'prompt',
    rank,
    label: 'Prompt',
    labelZh: '提示',
    title: 'Conversation starter',
    titleZh: '互动提示',
    description: 'A prompt module inserted near the start of the blended timeline.',
    descriptionZh: '插入到混排首页流前部的互动提示模块。',
    source: 'PromptsSource',
  };
}

function isBrandSafeForAdGap(tweet?: TweetCandidate): boolean {
  if (!tweet) {
    return true;
  }

  return tweet.brandSafetyRisk !== 'high' && !tweet.visibilityFiltered && !tweet.safetyLabels?.length;
}

export function buildForYouFeed(
  rankedPosts: TweetCandidate[],
  context: FilterContext,
  topK: number
): FeedBlendResult {
  const postItems = rankedPosts.map((tweet, index) => createPostItem(tweet, index + 1));

  if (!context.includeForYouModules) {
    const items = postItems.slice(0, topK).map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    return {
      blenderId: 'post_only_feed',
      blenderName: 'ScoredPosts timeline',
      postCount: items.length,
      adCount: 0,
      whoToFollowCount: 0,
      promptCount: 0,
      pushToHomeCount: 0,
      feedItems: items,
    };
  }

  const blended: FeedItem[] = [];
  const shouldInsertAd = postItems.length >= MIN_POSTS_FOR_ADS;
  let adInserted = false;

  for (const postItem of postItems) {
    blended.push({
      ...postItem,
      rank: blended.length + 1,
    });

    const organicPostsSoFar = blended.filter((item) => item.type === 'post').length;
    if (
      shouldInsertAd &&
      !adInserted &&
      organicPostsSoFar >= DEFAULT_AD_INSERT_AFTER_POSTS &&
      isBrandSafeForAdGap(postItem.tweet)
    ) {
      blended.push(createAdItem(blended.length + 1));
      adInserted = true;
    }
  }

  blended.splice(0, 0, createPromptItem(1));
  const whoToFollowIndex = Math.min(Math.max(WHO_TO_FOLLOW_POSITION - 1, 0), blended.length);
  blended.splice(whoToFollowIndex, 0, createWhoToFollowItem(whoToFollowIndex + 1));
  blended.splice(0, 0, createPushToHomeItem(1));

  const finalItems = blended.slice(0, topK).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  return {
    blenderId: 'for_you_blender',
    blenderName: 'ForYou BlenderSelector approximation',
    postCount: finalItems.filter((item) => item.type === 'post').length,
    adCount: finalItems.filter((item) => item.type === 'ad').length,
    whoToFollowCount: finalItems.filter((item) => item.type === 'who_to_follow').length,
    promptCount: finalItems.filter((item) => item.type === 'prompt').length,
    pushToHomeCount: finalItems.filter((item) => item.type === 'push_to_home').length,
    feedItems: finalItems,
  };
}
