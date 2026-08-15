import type {
  AdFixture,
  FeedBlendResult,
  FeedItem,
  FilterContext,
  TweetCandidate,
} from '@/core/types';
import { BLENDING_DEFAULTS } from '@/data/upstreamSnapshot';
import { containsKeywordSequence, tokenizePostText } from '@/utils/textTokens';

const MIN_POSTS_FOR_ADS = 5;
const DEFAULT_REQUESTED_SPACING = 3;
const PTOS_CUTOFF_TWEET_ID = 2_054_275_414_225_846_272n;

const MEDIUM_RISK_LABELS = new Set([
  'NSFW_HIGH_PRECISION',
  'NSFW_HIGH_RECALL',
  'NSFA_HIGH_PRECISION',
  'NSFA_KEYWORDS_HIGH_PRECISION',
  'GORE_AND_VIOLENCE_HIGH_PRECISION',
  'NSFW_REPORTED_HEURISTICS',
  'GORE_AND_VIOLENCE_REPORTED_HEURISTICS',
  'NSFW_CARD_IMAGE',
  'DO_NOT_AMPLIFY',
  'MALICIOUS_URL',
  'NSFA_COMMUNITY_NOTE',
  'PDNA',
  'EGREGIOUS_NSFW',
  'GROK_NSFA',
  'NSFW_TEXT',
]);

const LOW_RISK_LABELS = new Set([
  'NSFA_LIMITED_INVENTORY',
  'GROK_NSFA_LIMITED',
  'NSFA_HIGH_RECALL',
]);

export function computeBrandSafetyVerdict(
  candidate: TweetCandidate
): NonNullable<TweetCandidate['brandSafetyVerdict']> {
  return hydrateBrandSafety(candidate).verdict ?? 'medium_risk';
}

type BrandSafetyVerdict = NonNullable<TweetCandidate['brandSafetyVerdict']>;

const VERDICT_SEVERITY: Record<BrandSafetyVerdict, number> = {
  unspecified: 0,
  safe: 1,
  low_risk: 2,
  medium_risk: 3,
};

function worstVerdict(left: BrandSafetyVerdict, right: BrandSafetyVerdict): BrandSafetyVerdict {
  return VERDICT_SEVERITY[left] >= VERDICT_SEVERITY[right] ? left : right;
}

function verdictForLabels(
  id: string,
  safetyLabels: readonly string[] = []
): BrandSafetyVerdict {
  const labels = new Set(safetyLabels.map((label) => label.toUpperCase()));
  if ([...MEDIUM_RISK_LABELS].some((label) => labels.has(label))) return 'medium_risk';

  const scoredByGrok = labels.has('GROK_SFA') || labels.has('GROK_NSFA_LIMITED');
  if (!scoredByGrok) return 'medium_risk';

  try {
    if (BigInt(id) >= PTOS_CUTOFF_TWEET_ID && !labels.has('PTOS_REVIEWED')) {
      return 'medium_risk';
    }
  } catch {
    return 'unspecified';
  }

  if ([...LOW_RISK_LABELS].some((label) => labels.has(label))) return 'low_risk';
  return 'safe';
}

export function hydrateBrandSafety(candidate: TweetCandidate): {
  verdict: TweetCandidate['brandSafetyVerdict'];
  safetyLabels: string[];
} {
  const primaryId = candidate.originalTweetId || candidate.id;
  const primary = candidate.originalTweetId ? candidate.relatedPosts?.[primaryId] : undefined;
  const primaryLabels = primary?.safetyLabels || (
    candidate.originalTweetId ? [] : candidate.safetyLabels || []
  );
  if (primary?.brandSafetyLookupFailed || candidate.brandSafetyLookupFailed) {
    return {
      verdict: candidate.brandSafetyVerdict,
      safetyLabels: [...(candidate.safetyLabels || [])],
    };
  }
  let verdict = verdictForLabels(primaryId, primaryLabels);
  const combinedLabels = [...primaryLabels];

  const relatedIds = [candidate.quotedTweetId, ...(candidate.ancestors || [])]
    .filter((id): id is string => Boolean(id));
  for (const id of relatedIds) {
    const related = candidate.relatedPosts?.[id];
    const relatedLabels = related?.safetyLabels || [];
    verdict = worstVerdict(
      verdict,
      related?.brandSafetyLookupFailed ? 'medium_risk' : verdictForLabels(id, relatedLabels)
    );
    combinedLabels.push(...relatedLabels);
  }

  if (candidate.nsfwAuthorAds) verdict = worstVerdict(verdict, 'medium_risk');
  return {
    verdict,
    safetyLabels: [...new Set(combinedLabels.map((label) => label.toUpperCase()))].sort(),
  };
}

function createPostItem(tweet: TweetCandidate): FeedItem {
  return {
    id: `post-${tweet.id}`,
    type: 'post',
    rank: 0,
    tweet,
    score: tweet.finalScore,
    label: tweet.visibilityAction === 'interstitial' ? 'Post · Interstitial' : 'Post',
    labelZh: tweet.visibilityAction === 'interstitial' ? '帖子 · 警示遮罩' : '帖子',
    title: tweet.authorName,
    titleZh: tweet.authorName,
    description: tweet.content,
    descriptionZh: tweet.content,
    source: 'ScoredPostsSource',
    sourceZh: '帖子排序来源',
  };
}

function createModuleItem(
  type: Exclude<FeedItem['type'], 'post'>,
  id: string,
  title: string,
  titleZh: string,
  source: string
): FeedItem {
  const labels: Record<Exclude<FeedItem['type'], 'post'>, [string, string]> = {
    ad: ['Ad', '广告'],
    who_to_follow: ['Who to follow', '推荐关注'],
    prompt: ['Prompt', '提示'],
    push_to_home: ['Push to home', '置顶回流'],
    frame: ['Jetfuel frame', 'Jetfuel 框架'],
    feed_survey: ['Feed survey', '信息流问卷'],
  };
  return {
    id,
    type,
    rank: 0,
    label: labels[type][0],
    labelZh: labels[type][1],
    title,
    titleZh,
    description: `${source} fixture`,
    descriptionZh: `${source} 测试数据`,
    source,
    sourceZh: source,
  };
}

function createAdItem(ad: AdFixture): FeedItem {
  return createModuleItem(
    'ad',
    `module-ad-${ad.id}`,
    'Promoted post fixture',
    '推广内容测试数据',
    'AdsSource'
  );
}

function hasAvoid(candidate: TweetCandidate): boolean {
  return candidate.brandSafetyVerdict === 'medium_risk';
}

function requestedSpacing(ads: readonly AdFixture[]): number {
  if (ads.length < 2) return DEFAULT_REQUESTED_SPACING;
  const positions = ads.slice(0, 4)
    .map((ad) => ad.insertPosition)
    .sort((left, right) => left - right);
  const positiveDiffs = positions.slice(1)
    .map((position, index) => position - positions[index])
    .filter((difference) => difference > 0);
  const minimum = positiveDiffs.length ? Math.min(...positiveDiffs) : undefined;
  return minimum !== undefined && minimum >= 3 ? minimum : DEFAULT_REQUESTED_SPACING;
}

function lowRiskAdRejected(
  ad: AdFixture,
  above: TweetCandidate,
  below: TweetCandidate
): boolean {
  if (ad.brandSafetyRisk !== 'low' && ad.brandSafetyRisk !== 'ias') return false;
  return above.brandSafetyVerdict === 'low_risk' || below.brandSafetyVerdict === 'low_risk';
}

function handleRejected(
  ad: AdFixture,
  above: TweetCandidate,
  below: TweetCandidate
): boolean {
  if (!ad.handles.length) return false;
  const handles = new Set(ad.handles.filter((id) => id !== '0'));
  const matches = (post: TweetCandidate) => [
    post.authorId,
    post.retweetedAuthorId,
    post.quotedAuthorId,
    ...(post.ancestorUserIds || []),
  ].some((id) => Boolean(id && handles.has(id)));
  return matches(above) || matches(below);
}

function keywordRejected(
  ad: AdFixture,
  above: TweetCandidate,
  below: TweetCandidate
): boolean {
  const keywords = ad.keywords.map(tokenizePostText).filter((tokens) => tokens.length > 0);
  if (!keywords.length) return false;
  return [above, below].some((post) => {
    const postTokens = tokenizePostText(post.content);
    return keywords.some((keyword) => containsKeywordSequence(postTokens, keyword));
  });
}

/** Mirrors the pinned PartitionOrganicAdsBlender over explicit local ad fixtures. */
function partitionOrganic(
  scoredPosts: TweetCandidate[],
  ads: AdFixture[]
): FeedItem[] {
  const postItems = scoredPosts.map(createPostItem);
  const postCount = scoredPosts.length;
  if (ads.length === 0 || postCount < MIN_POSTS_FOR_ADS) return postItems;

  const safeCount = scoredPosts.filter((post) => !hasAvoid(post)).length;
  const expectedFromSpacing = Math.floor(
    Math.max(0, postCount - 1) / requestedSpacing(ads)
  );
  const actualAds = Math.min(ads.length, expectedFromSpacing, Math.floor(safeCount / 2));
  if (actualAds === 0) return postItems;

  const safe = scoredPosts.filter((post) => !hasAvoid(post));
  const unsafe = scoredPosts.filter(hasAvoid);
  const groupSize = Math.floor(safe.length / actualAds);
  const remainingSafe = safe.map((post) => post as TweetCandidate | undefined);
  const triples: Array<{ ad: AdFixture; above: TweetCandidate; below: TweetCandidate }> = [];

  let group = 0;
  for (const ad of ads) {
    if (group >= actualAds) break;
    const start = group * groupSize;
    const above = remainingSafe[start];
    const below = remainingSafe[start + 1];
    if (!above || !below) break;
    if (
      lowRiskAdRejected(ad, above, below) ||
      handleRejected(ad, above, below) ||
      keywordRejected(ad, above, below)
    ) {
      continue;
    }
    remainingSafe[start] = undefined;
    remainingSafe[start + 1] = undefined;
    triples.push({ ad, above, below });
    group += 1;
  }

  if (!triples.length) {
    return [...remainingSafe.filter((post): post is TweetCandidate => Boolean(post)), ...unsafe]
      .sort((left, right) => (right.finalScore ?? 0) - (left.finalScore ?? 0))
      .map(createPostItem);
  }

  const filler = [
    ...remainingSafe.filter((post): post is TweetCandidate => Boolean(post)),
    ...unsafe,
  ].sort((left, right) => (right.finalScore ?? 0) - (left.finalScore ?? 0));
  const fillerPerGap = Math.floor(filler.length / triples.length);
  const remainder = filler.length % triples.length;
  let fillerIndex = 0;
  const items: FeedItem[] = [];

  triples.forEach((triple, index) => {
    items.push(createPostItem(triple.above), createAdItem(triple.ad), createPostItem(triple.below));
    const count = fillerPerGap + (index >= triples.length - remainder ? 1 : 0);
    for (let offset = 0; offset < count && fillerIndex < filler.length; offset += 1) {
      items.push(createPostItem(filler[fillerIndex]));
      fillerIndex += 1;
    }
  });

  const truncated = items.slice(0, BLENDING_DEFAULTS.resultSize);
  if (truncated.at(-1)?.type === 'ad') truncated.pop();
  return truncated;
}

function insertModules(items: FeedItem[], context: FilterContext): FeedItem[] {
  const blended = [...items];

  if (BLENDING_DEFAULTS.enablePrompts) {
    for (let index = 0; index < context.promptCount; index += 1) {
      blended.splice(index, 0, createModuleItem(
        'prompt',
        `module-prompt-${index}`,
        'Conversation starter',
        '互动提示',
        'PromptsSource'
      ));
    }
  }

  if (BLENDING_DEFAULTS.enableWhoToFollow && context.whoToFollowEligible) {
    const index = Math.min(BLENDING_DEFAULTS.whoToFollowPosition - 1, blended.length);
    blended.splice(index, 0, createModuleItem(
      'who_to_follow',
      'module-who-to-follow',
      'Suggested accounts',
      '推荐关注账号',
      'WhoToFollowSource'
    ));
  }

  if (context.pushToHomeTweetId) {
    blended.unshift(createModuleItem(
      'push_to_home',
      `module-push-to-home-${context.pushToHomeTweetId}`,
      'Push-to-home post',
      '置顶回流帖子',
      'PushToHomeSource'
    ));
  }

  if (BLENDING_DEFAULTS.enableJetfuelFrames) {
    const frameCount = Math.min(
      context.jetfuelFrameCount,
      BLENDING_DEFAULTS.maxJetfuelFramesPerResponse
    );
    for (let index = 0; index < frameCount; index += 1) {
      const slot = Math.min((index + 1) * 4, blended.length);
      blended.splice(slot, 0, createModuleItem(
        'frame',
        `module-frame-${index}`,
        'Jetfuel frame',
        'Jetfuel 框架',
        'JetfuelFrameSource'
      ));
    }
  }

  if (BLENDING_DEFAULTS.enableFeedSurvey && context.feedSurveyEligible) {
    const index = Math.min(BLENDING_DEFAULTS.feedSurveyPosition - 1, blended.length);
    blended.splice(index, 0, createModuleItem(
      'feed_survey',
      'module-feed-survey',
      'Feed survey',
      '信息流问卷',
      'FeedSurveySource'
    ));
  }

  return blended.slice(0, BLENDING_DEFAULTS.resultSize + BLENDING_DEFAULTS.feedModuleSlots +
    BLENDING_DEFAULTS.maxJetfuelFramesPerResponse);
}

function count(items: FeedItem[], type: FeedItem['type']): number {
  return items.filter((item) => item.type === type).length;
}

export function buildForYouFeed(
  rankedPosts: TweetCandidate[],
  context: FilterContext
): FeedBlendResult {
  // ScoredPostsServer serializes missing values before For You consumes the posts.
  const scoredPostCandidates = rankedPosts.map((post) => ({
    ...post,
    inNetwork: post.inNetwork ?? false,
    brandSafetyVerdict: post.brandSafetyVerdict ?? 'medium_risk',
  }));
  const dedupedPosts = context.pushToHomeTweetId
    ? scoredPostCandidates.filter((post) =>
        post.id !== context.pushToHomeTweetId && post.originalTweetId !== context.pushToHomeTweetId
      )
    : scoredPostCandidates;
  const organicAndAds = partitionOrganic(
    dedupedPosts,
    BLENDING_DEFAULTS.enableAds ? context.adFixtures : []
  );
  const feedItems = insertModules(organicAndAds, context).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  return {
    blenderId: BLENDING_DEFAULTS.adsBlender,
    blenderName: 'BlenderSelector / PartitionOrganicAdsBlender',
    postCount: count(feedItems, 'post'),
    adCount: count(feedItems, 'ad'),
    whoToFollowCount: count(feedItems, 'who_to_follow'),
    promptCount: count(feedItems, 'prompt'),
    pushToHomeCount: count(feedItems, 'push_to_home'),
    frameCount: count(feedItems, 'frame'),
    feedSurveyCount: count(feedItems, 'feed_survey'),
    feedItems,
  };
}
