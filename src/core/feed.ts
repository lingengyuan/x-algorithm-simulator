import { FeedBlendResult, FeedItem, FilterContext, TweetCandidate } from '@/core/types';

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
    description: 'A prompt module inserted after enough organic context is available.',
    descriptionZh: '在已有足够自然内容后插入的互动提示模块。',
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
  const feedItems: FeedItem[] = [];
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

  feedItems.push(createPushToHomeItem(feedItems.length + 1));

  let adInserted = false;
  let whoToFollowInserted = false;
  let promptInserted = false;

  for (const postItem of postItems) {
    feedItems.push({
      ...postItem,
      rank: feedItems.length + 1,
    });

    const organicPostsSoFar = feedItems.filter((item) => item.type === 'post').length;
    const previousPost = postItem.tweet;

    if (!adInserted && organicPostsSoFar >= 2 && isBrandSafeForAdGap(previousPost)) {
      feedItems.push(createAdItem(feedItems.length + 1));
      adInserted = true;
    }

    if (!whoToFollowInserted && organicPostsSoFar >= 4) {
      feedItems.push(createWhoToFollowItem(feedItems.length + 1));
      whoToFollowInserted = true;
    }

    if (!promptInserted && organicPostsSoFar >= 6) {
      feedItems.push(createPromptItem(feedItems.length + 1));
      promptInserted = true;
    }

    if (feedItems.length >= topK) {
      break;
    }
  }

  const finalItems = feedItems.slice(0, topK).map((item, index) => ({
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
