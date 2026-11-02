import type {
  AdFixture,
  BrandSafetyVerdict,
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

const HIGH_RISK_LABELS = new Set([
  'NSFW_HIGH_PRECISION',
  'NSFW_HIGH_RECALL',
  'GORE_AND_VIOLENCE_HIGH_PRECISION',
  'PDNA',
  'EGREGIOUS_NSFW',
  'SOFT_NSFW',
]);

const MEDIUM_RISK_LABELS = new Set([
  'NSFA_HIGH_PRECISION',
  'NSFA_KEYWORDS_HIGH_PRECISION',
  'NSFW_REPORTED_HEURISTICS',
  'GORE_AND_VIOLENCE_REPORTED_HEURISTICS',
  'NSFW_CARD_IMAGE',
  'DO_NOT_AMPLIFY',
  'MALICIOUS_URL',
  'NSFA_COMMUNITY_NOTE',
  'GROK_NSFA',
  'NSFW_TEXT',
]);

const LOW_RISK_LABELS = new Set([
  'NSFA_LIMITED_INVENTORY',
  'GROK_NSFA_LIMITED',
  'NSFA_HIGH_RECALL',
]);

const VERDICT_SEVERITY: Record<BrandSafetyVerdict, number> = {
  unspecified: 0,
  safe: 1,
  low_risk: 2,
  medium_risk: 3,
  high_risk: 4,
};

function worstVerdict(left: BrandSafetyVerdict, right: BrandSafetyVerdict): BrandSafetyVerdict {
  return VERDICT_SEVERITY[left] >= VERDICT_SEVERITY[right] ? left : right;
}

function verdictForLabels(
  id: string,
  safetyLabels: readonly string[] = []
): BrandSafetyVerdict {
  // The pinned defaults select the legacy verdict path, not the V2 label table.
  const labels = new Set(safetyLabels.map((label) => label.toUpperCase()));
  if ([...HIGH_RISK_LABELS].some((label) => labels.has(label))) return 'high_risk';
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

  if (candidate.nsfwAuthorAds) verdict = worstVerdict(verdict, 'high_risk');
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
  return candidate.brandSafetyVerdict === 'medium_risk' ||
    candidate.brandSafetyVerdict === 'high_risk';
}

function isHighRisk(candidate: TweetCandidate): boolean {
  return candidate.brandSafetyVerdict === 'high_risk';
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

/** Slot positions and neighbour swaps follow SlotSpreadAdsBlender. */
function slotSpread(
  scoredPosts: TweetCandidate[],
  ads: AdFixture[]
): FeedItem[] {
  const postItems = scoredPosts.map(createPostItem);
  const postCount = scoredPosts.length;
  if (ads.length === 0 || postCount < MIN_POSTS_FOR_ADS) return postItems;

  const sensitive = (ad: AdFixture) => ad.brandSafetyRisk === 'low' || ad.brandSafetyRisk === 'ias';
  const safe = scoredPosts.filter((post) => !hasAvoid(post) && post.brandSafetyVerdict !== 'low_risk').length;
  const low = scoredPosts.filter((post) => post.brandSafetyVerdict === 'low_risk').length;
  const medium = scoredPosts.filter((post) => post.brandSafetyVerdict === 'medium_risk').length;
  const spacing = requestedSpacing(ads);
  const pageSlots = Math.min(
    Math.floor((postCount - 2) / spacing) + 1,
    Math.floor((BLENDING_DEFAULTS.resultSize - 2 + spacing) / (spacing + 1))
  );
  const safeSlots = Math.min(Math.floor((safe + low) / 2),
    Math.floor(safe / 2) + ads.filter((ad) => !sensitive(ad)).length) +
    Math.min(ads.filter((ad) => ad.brandSafetyRisk === 'high').length, Math.floor(medium / 2));
  const slotCount = Math.min(pageSlots, ads.length, safeSlots);
  if (slotCount === 0) return postItems;

  const shown = Math.min(postCount, BLENDING_DEFAULTS.resultSize - slotCount);
  const surplus = Math.max(0, shown - ((slotCount - 1) * spacing + 2));
  const perGap = Math.floor(surplus / slotCount);
  const remainder = surplus % slotCount;
  const slots: number[] = [];
  let slotPosition = 0;
  for (let index = 0; index < slotCount; index += 1) {
    slots.push(slotPosition);
    slotPosition += spacing + perGap + Number(index >= slotCount - remainder);
  }

  const order = scoredPosts.map((_, index) => index);
  const used = scoredPosts.map(() => false);
  const sensitiveAfter = Array<number>(ads.length + 1).fill(0);
  for (let index = ads.length - 1; index >= 0; index -= 1) {
    sensitiveAfter[index] = sensitiveAfter[index + 1] + Number(sensitive(ads[index]));
  }
  let safeFree = safe;
  let lowFree = low;
  const adBefore = new Map<number, AdFixture>();

  for (const [adIndex, ad] of ads.entries()) {
    if (adBefore.size >= slotCount) break;
    if (ad.brandSafetyRisk !== 'high' && safeFree + lowFree < 2) continue;
    if (sensitive(ad) && safeFree < 2) continue;

    const above = slots[adBefore.size];
    const below = above + 1;
    const slotsLeft = slotCount - adBefore.size - 1;
    const preferLow = !sensitive(ad) && lowFree > 0 &&
      Math.floor(safeFree / 2) < Math.min(slotsLeft, sensitiveAfter[adIndex + 1]);
    const pick = (target: number, exclude: number[]): number | undefined => {
      for (const lowOnly of preferLow ? [true, false] : [false]) {
        const usable = (position: number) => {
          if (used[position] || exclude.includes(position)) return false;
          const post = scoredPosts[order[position]];
          if (lowOnly && post.brandSafetyVerdict !== 'low_risk') return false;
          return !isHighRisk(post) &&
            (post.brandSafetyVerdict !== 'medium_risk' || ad.brandSafetyRisk === 'high') &&
            !lowRiskAdRejected(ad, post, post) && !handleRejected(ad, post, post) &&
            !keywordRejected(ad, post, post);
        };
        // Equal distances prefer the preceding post, as in the upstream nearest search.
        for (let distance = 0; distance < postCount; distance += 1) {
          const lower = target - distance;
          if (lower >= 0 && usable(lower)) return lower;
          const upper = target + distance;
          if (distance > 0 && upper < postCount && usable(upper)) return upper;
        }
      }
    };
    const first = pick(above, [below]);
    if (first === undefined) continue;
    const second = pick(below, [above, first]);
    if (second === undefined) continue;
    [order[above], order[first]] = [order[first], order[above]];
    [order[below], order[second]] = [order[second], order[below]];
    for (const position of [above, below]) {
      used[position] = true;
      const verdict = scoredPosts[order[position]].brandSafetyVerdict;
      if (verdict === 'low_risk') lowFree -= 1;
      else if (!hasAvoid(scoredPosts[order[position]])) safeFree -= 1;
    }
    adBefore.set(below, ad);
  }
  if (adBefore.size === 0) return postItems;
  const items: FeedItem[] = [];
  for (const [position, postIndex] of order.entries()) {
    const ad = adBefore.get(position);
    if (ad) items.push(createAdItem(ad));
    items.push(createPostItem(scoredPosts[postIndex]));
  }

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
  const organicAndAds = slotSpread(
    dedupedPosts,
    BLENDING_DEFAULTS.enableAds ? context.adFixtures : []
  );
  const feedItems = insertModules(organicAndAds, context).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  return {
    blenderId: BLENDING_DEFAULTS.adsBlender,
    blenderName: 'BlenderSelector / SlotSpreadAdsBlender',
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
