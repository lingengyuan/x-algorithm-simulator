/// <reference types="node" />

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { FilterContext, PhoenixScores, TweetCandidate } from '@/core/types';
import { PRE_SCORING_FILTERS, POST_SELECTION_FILTERS, runFilter } from '@/core/filters';
import { buildForYouFeed, hydrateBrandSafety } from '@/core/feed';
import { runPipeline } from '@/core/pipeline';
import { runRankingScorer, runVMRanker } from '@/core/scorers';
import {
  createTweetTypeMetrics,
  TWEET_TYPE_BITS,
  tweetTypeBitIsSet,
} from '@/core/tweetTypeMetrics';
import { evaluateVisibility, hydrateVisibility } from '@/core/visibility';
import { DEFAULT_WEIGHTS, formatWeight } from '@/data/defaultWeights';
import { generateMockTweet, generateMockTweets, getDefaultFilterContext, RANKING_SCENARIOS } from '@/data/mockTweets';
import {
  ALL_PRODUCTION_TOPIC_IDS,
  BRAZIL_2026_ELECTION_USER_IDS,
  TOPIC_CATEGORY_MAP,
  UPSTREAM_TOPIC_IDS,
  expandSupertopic,
} from '@/data/upstreamPolicyData';
import {
  BLENDING_DEFAULTS,
  CACHED_POSTS_MIN_COUNT,
  RANKING_CONSTANTS,
  UPSTREAM_SNAPSHOT,
} from '@/data/upstreamSnapshot';
import { computeWeightedScore, CONTINUOUS_OUTPUT_LABELS, SCORE_LABELS } from '@/utils/scoring';
import { generateSnowflakeIdFromAge } from '@/utils/snowflake';

const zeroScores = (): PhoenixScores => ({
  favoriteScore: 0,
  replyScore: 0,
  retweetScore: 0,
  photoExpandScore: 0,
  videoOpenScore: 0,
  clickScore: 0,
  openLinkScore: 0,
  profileClickScore: 0,
  vqvScore: 0,
  shareScore: 0,
  shareViaDmScore: 0,
  shareViaCopyLinkScore: 0,
  dwellScore: 0,
  quoteScore: 0,
  quotedClickScore: 0,
  quotedVqvScore: 0,
  followAuthorScore: 0,
  postUnexploredScore: 0,
  notInterestedScore: 0,
  blockAuthorScore: 0,
  muteAuthorScore: 0,
  reportScore: 0,
  notDwelledScore: 0,
  dwellTime: 0,
  clickDwellTime: 0,
  activeSecs5mResidualNorm: 0,
});

function candidate(index = 0, overrides: Partial<TweetCandidate> = {}): TweetCandidate {
  return {
    ...generateMockTweet(index, 1, true),
    authorId: `${100 + index}`,
    phoenixScores: zeroScores(),
    safetyLabels: ['GROK_SFA', 'PTOS_REVIEWED'],
    brandSafetyVerdict: 'safe',
    filtered: false,
    ...overrides,
  };
}

function context(candidates: TweetCandidate[] = []): FilterContext {
  return {
    ...getDefaultFilterContext(candidates),
    blockedUsers: [],
    mutedUsers: [],
    mutedKeywords: [],
    followedAuthorIds: [],
    seenTweetIds: [],
    servedTweetIds: [],
    bloomSeenTweetIds: [],
    impressedTweetIds: [],
    excludedTopicIds: [],
    topicIds: [],
    whoToFollowEligible: false,
    adFixtures: [],
    promptCount: 0,
  };
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

describe('pinned upstream snapshot', () => {
  it('uses the reviewed commit and current primary defaults', () => {
    expect(UPSTREAM_SNAPSHOT.shortCommit).toBe('c65aa17');
    expect(DEFAULT_WEIGHTS.enableVMRanker).toBe(true);
    expect(DEFAULT_WEIGHTS.vmRankerTheta).toBe(0.65);
    expect(DEFAULT_WEIGHTS.vmRankerTopK).toBe(50);
    expect(BLENDING_DEFAULTS.resultSize).toBe(35);
    expect(BLENDING_DEFAULTS.topKPosts).toBe(50);
    expect(CACHED_POSTS_MIN_COUNT).toBe(500);
    expect(Object.keys(SCORE_LABELS)).toHaveLength(23);
    expect(Object.keys(CONTINUOUS_OUTPUT_LABELS)).toHaveLength(3);
  });

  it('keeps the exact published filter order', () => {
    expect(PRE_SCORING_FILTERS.map((filter) => filter.name)).toEqual([
      'DropDuplicatesFilter',
      'CoreDataHydrationFilter',
      'AgeFilter',
      'SelfTweetFilter',
      'OONRetweetReplyFilter',
      'OONNsfwSimclustersFilter',
      'RetweetDeduplicationFilter',
      'IneligibleSubscriptionFilter',
      'PreviouslySeenPostsFilter',
      'PreviouslySeenPostsBackupFilter',
      'PreviouslyServedPostsFilter',
      'MutedKeywordFilter',
      'AuthorSocialgraphFilter',
      'Brazil2026ElectionFilter',
      'VideoFilter',
      'TopicIdsFilter',
      'NewUserMinEngagementFilter',
      'InventoryHoldoutFilter',
    ]);
    expect(POST_SELECTION_FILTERS.map((filter) => filter.name)).toEqual([
      'VFFilter',
      'AncillaryVFFilter',
      'DedupConversationFilter',
    ]);
  });
});

describe('RankingScorer weighted path', () => {
  it('applies the published positive and continuous terms without log compression', () => {
    const item = candidate(1, {
      phoenixScores: { ...zeroScores(), favoriteScore: 1, dwellTime: 10 },
    });
    const result = computeWeightedScore(item, DEFAULT_WEIGHTS, 0);
    expect(result.combined).toBeCloseTo(0.54, 12);
    expect(result.score).toBeCloseTo(0.541, 12);
  });

  it('applies the negative score offset formula', () => {
    const item = candidate(2, {
      phoenixScores: { ...zeroScores(), reportScore: 1 },
    });
    const result = computeWeightedScore(item, DEFAULT_WEIGHTS, 0);
    const positiveWeightSum = 43.32;
    const negativeWeightSum = 367.22;
    const expected = (-234 + negativeWeightSum) /
      (positiveWeightSum + negativeWeightSum) * 0.001;
    expect(result.score).toBeCloseTo(expected, 12);
  });

  it('gates VQV and bidirectional reply boost exactly', () => {
    const boosted = candidate(3, {
      isMutualFollowAuthor: true,
      videoDurationMs: 10_001,
      phoenixScores: { ...zeroScores(), replyScore: 1, vqvScore: 1 },
    });
    expect(computeWeightedScore(boosted, DEFAULT_WEIGHTS, 9_999).score).toBeCloseTo(20.051, 12);
    expect(computeWeightedScore(boosted, DEFAULT_WEIGHTS, 10_000).score).toBeCloseTo(20.001, 12);

    const reply = { ...boosted, inReplyToTweetId: '1' };
    expect(computeWeightedScore(reply, DEFAULT_WEIGHTS, 10_000).score).toBeCloseTo(5.001, 12);
  });

  it('does not mark an out-of-network fixture author as a mutual follow', () => {
    const fixtures = generateMockTweets(30, 0);
    expect(fixtures.filter((item) => item.inNetwork === false && item.isMutualFollowAuthor))
      .toHaveLength(0);
  });

  it('uses post-unexplored additively for in-network posts only by default', () => {
    const item = candidate(4, {
      inNetwork: true,
      phoenixScores: { ...zeroScores(), postUnexploredScore: 1 },
    });
    expect(computeWeightedScore(item, DEFAULT_WEIGHTS, 0).score).toBeCloseTo(0.021, 12);
    expect(computeWeightedScore({ ...item, inNetwork: false }, DEFAULT_WEIGHTS, 0).score)
      .toBeCloseTo(0.001, 12);
    expect(computeWeightedScore({ ...item, inNetwork: undefined }, DEFAULT_WEIGHTS, 0).score)
      .toBeCloseTo(0.001, 12);
  });

  it('does not treat a missing in-network value as out-of-network', () => {
    const unknown = candidate(5, {
      inNetwork: undefined,
      originalTweetId: '123',
      servedType: 'for_you_simclusters',
      nsfwAuthor: true,
      favoriteCount: 0,
      viewCount: 1,
    });
    const request = {
      ...context([unknown]),
      enableNewUserMinEngagementFilter: true,
      newUserMinEngagementThreshold: 100,
      userAccountAgeSeconds: 0,
    };

    expect(runFilter('oon_retweet_reply', [unknown], request).passedCandidates).toHaveLength(1);
    expect(runFilter('oon_nsfw_simclusters', [unknown], request).passedCandidates).toHaveLength(1);
    expect(runFilter('new_user_min_engagement', [unknown], request).passedCandidates)
      .toHaveLength(1);

    const ranked = runRankingScorer([unknown], {
      ...DEFAULT_WEIGHTS,
      enableAuthorColdStart: false,
      enableAuthorDiversity: false,
    }, request).updatedCandidates[0];
    expect(ranked.finalScore).toBe(ranked.diversityAdjustedScore);
  });

  it('boosts the best eligible low-impression author to the published slot', () => {
    const items = Array.from({ length: 30 }, (_, index) => candidate(100 + index, {
      id: `${1_000 + index}`,
      authorId: `${2_000 + index}`,
      authorFollowers: index === 20 ? 640 : 50_000,
      viewCount: index === 20 ? 25 : 5_000,
      inNetwork: true,
      phoenixScores: { ...zeroScores(), favoriteScore: (30 - index) / 30 },
    }));
    const result = runRankingScorer(items, {
      ...DEFAULT_WEIGHTS,
      enableAuthorDiversity: false,
    }, context(items));
    const boosted = result.updatedCandidates.find((item) => item.id === '1020');
    const expectedTarget = computeWeightedScore(items[15], DEFAULT_WEIGHTS, 0).score;

    expect(boosted?.coldStartBoosted).toBe(true);
    expect(boosted?.weightedScore).toBeCloseTo(
      computeWeightedScore(items[20], DEFAULT_WEIGHTS, 0).score,
      12
    );
    expect(boosted?.coldStartAdjustedScore).toBeCloseTo(expectedTarget, 12);
  });

  it('breaks an eligible cold-start score tie with the larger source index', () => {
    const items = Array.from({ length: 20 }, (_, index) => candidate(400 + index, {
      authorFollowers: index === 1 || index === 2 ? 100 : 50_000,
      viewCount: index === 1 || index === 2 ? 10 : 5_000,
      inNetwork: true,
      phoenixScores: { ...zeroScores(), favoriteScore: 0.5 },
    }));
    const result = runRankingScorer(items, {
      ...DEFAULT_WEIGHTS,
      enableAuthorDiversity: false,
    }, context(items));

    expect(result.updatedCandidates[1].coldStartBoosted).not.toBe(true);
    expect(result.updatedCandidates[2].coldStartBoosted).toBe(true);
  });

  it('formats small continuous weights at their configured precision', () => {
    expect(formatWeight(0.004, 0.001)).toBe('0.004');
    expect(formatWeight(0.005, 0.001)).toBe('0.005');
  });
});

describe('published filters and visibility', () => {
  it('pins the complete public topic taxonomy and Brazil election list', () => {
    expect(Object.keys(UPSTREAM_TOPIC_IDS)).toHaveLength(119);
    expect(ALL_PRODUCTION_TOPIC_IDS).toContain(UPSTREAM_TOPIC_IDS.XAI_STOCKS_ECONOMY);
    expect(BRAZIL_2026_ELECTION_USER_IDS.size).toBe(665);
    expect(BRAZIL_2026_ELECTION_USER_IDS.has('40053694')).toBe(true);
    expect(BRAZIL_2026_ELECTION_USER_IDS.has('21069302')).toBe(true);
    expect(BRAZIL_2026_ELECTION_USER_IDS.has('1355216660068761606')).toBe(true);

    const topicIds = Object.entries(UPSTREAM_TOPIC_IDS)
      .sort(([left], [right]) => left.localeCompare(right));
    const categories = Object.entries(TOPIC_CATEGORY_MAP)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([topicId, children]) => [topicId, [...children].sort()]);
    const supertopics = Object.values(UPSTREAM_TOPIC_IDS)
      .sort()
      .map((topicId) => [topicId, [...expandSupertopic(topicId)].sort()]);

    // Full canonical snapshots from x-algorithm@c65aa17; any ID or mapping drift must fail.
    expect(sha256({
      topicIds,
      categories,
      supertopics,
      allProduction: [...ALL_PRODUCTION_TOPIC_IDS].sort(),
    })).toBe('babd14cf39cdc7e1c2d0e5f5faafb17a076ffd38d5784a068f444e68ad236ab6');
    expect(sha256([...BRAZIL_2026_ELECTION_USER_IDS].sort()))
      .toBe('fccf0aa457964eb1d8a0e4e05babb3c90d76e7d0d8c5e2379b2e7fc66eebd437');
  });

  it('matches muted token sequences without substring or hashtag false positives', () => {
    const items = [
      candidate(501, { content: '#LAUNCH day' }),
      candidate(502, { content: 'support launch movement' }),
      candidate(503, { content: 'a crypto scam warning' }),
      candidate(504, { content: 'crypto is useful; scam artists are not' }),
      candidate(505, { content: 'cafe culture and cryptography' }),
    ];
    const hashtag = runFilter('muted_keyword', items, {
      ...context(items),
      mutedKeywords: ['#launch'],
    });
    expect(hashtag.filteredCandidates.map((item) => item.id)).toEqual([items[0].id]);

    const phraseAndAccent = runFilter('muted_keyword', items, {
      ...context(items),
      mutedKeywords: ['crypto scam', 'café'],
    });
    expect(phraseAndAccent.filteredCandidates.map((item) => item.id)).toEqual([
      items[2].id,
      items[4].id,
    ]);
  });

  it('applies the complete Brazil list to authors and related authors with follow exemption', () => {
    const listed = '40053694';
    const items = [
      candidate(510, { authorId: listed }),
      candidate(511, { retweetedAuthorId: listed }),
      candidate(512, { quotedAuthorId: listed }),
      candidate(513, { ancestorUserIds: [listed] }),
      candidate(514, { authorId: '42' }),
    ];
    expect(runFilter('brazil_2026_election', items, context(items)).passedCandidates)
      .toEqual([items[4]]);
    expect(runFilter('brazil_2026_election', items, {
      ...context(items),
      followedAuthorIds: [listed],
    }).outputCount).toBe(items.length);
  });

  it('uses canonical category, supertopic, bulk, and excluded-topic expansion', () => {
    const ai = candidate(520, {
      filteredTopicIds: [UPSTREAM_TOPIC_IDS.XAI_AI],
      unfilteredTopicIds: [UPSTREAM_TOPIC_IDS.XAI_AI],
    });
    const popViaMusic = candidate(521, {
      filteredTopicIds: [UPSTREAM_TOPIC_IDS.XAI_MUSIC],
      unfilteredTopicIds: [UPSTREAM_TOPIC_IDS.XAI_POP],
    });
    const news = candidate(522, {
      filteredTopicIds: [UPSTREAM_TOPIC_IDS.XAI_NEWS],
      unfilteredTopicIds: [UPSTREAM_TOPIC_IDS.XAI_NEWS],
    });
    const noTopics = candidate(523, { filteredTopicIds: [], unfilteredTopicIds: [] });
    const aggregate = candidate(524, {
      filteredTopicIds: [UPSTREAM_TOPIC_IDS.SCIENCE_TECHNOLOGY],
      unfilteredTopicIds: [UPSTREAM_TOPIC_IDS.SCIENCE_TECHNOLOGY],
    });

    expect(runFilter('topic_ids', [ai], {
      ...context([ai]),
      topicIds: [UPSTREAM_TOPIC_IDS.SCIENCE_TECHNOLOGY],
    }).outputCount).toBe(1);
    expect(runFilter('topic_ids', [popViaMusic], {
      ...context([popViaMusic]),
      topicIds: [UPSTREAM_TOPIC_IDS.XAI_POP],
    }).outputCount).toBe(1);
    expect(runFilter('topic_ids', [ai, news, noTopics], {
      ...context([ai, news, noTopics]),
      topicIds: [UPSTREAM_TOPIC_IDS.XAI_AI],
      isBulkTopicRequest: true,
    }).passedCandidates.map((item) => item.id)).toEqual([ai.id, noTopics.id]);
    expect(runFilter('topic_ids', [ai, aggregate, noTopics], {
      ...context([ai, aggregate, noTopics]),
      excludedTopicIds: [UPSTREAM_TOPIC_IDS.SCIENCE_TECHNOLOGY],
    }).outputCount).toBe(0);
  });

  it('checks only tweet, reposted-original, and reply-parent IDs for seen history', () => {
    const item = candidate(5, { ancestors: ['42'], inReplyToTweetId: '43' });
    const ancestorOnly = runFilter('previously_seen_posts', [item], {
      ...context([item]),
      seenTweetIds: ['42'],
    });
    expect(ancestorOnly.outputCount).toBe(1);

    const replyParent = runFilter('previously_seen_posts', [item], {
      ...context([item]),
      seenTweetIds: ['43'],
    });
    expect(replyParent.outputCount).toBe(0);
  });

  it('drops OON replies and every reply with missing ancestors', () => {
    const parent = candidate(6);
    const outOfNetworkReply = candidate(7, {
      inNetwork: false,
      inReplyToTweetId: parent.id,
      ancestors: [parent.id],
    });
    const malformedInNetworkReply = candidate(8, {
      inNetwork: true,
      inReplyToTweetId: parent.id,
      ancestors: [],
    });
    expect(runFilter('oon_retweet_reply', [outOfNetworkReply, malformedInNetworkReply], context()).outputCount)
      .toBe(0);
  });

  it('retains interstitials in VFFilter but drops visibility drops', () => {
    const sensitive = candidate(9, {
      inNetwork: true,
      hasImage: true,
      safetyLabels: ['GROK_SFA', 'PTOS_REVIEWED', 'NSFW_HIGH_PRECISION'],
    });
    const baseContext = context([sensitive]);
    const interstitial = evaluateVisibility(sensitive, baseContext);
    expect(interstitial.action).toBe('interstitial');
    expect(runFilter('vf', [{ ...sensitive, visibilityAction: 'interstitial' }], baseContext).outputCount)
      .toBe(1);

    const oon = { ...sensitive, inNetwork: false };
    expect(evaluateVisibility(oon, baseContext).action).toBe('drop');
    expect(runFilter('vf', [{ ...oon, visibilityAction: 'drop' }], baseContext).outputCount)
      .toBe(0);
  });

  it('uses account country before request country for no-stated-age NSFW gating', () => {
    const sensitive = candidate(91, {
      inNetwork: true,
      hasImage: true,
      safetyLabels: ['GROK_SFA', 'PTOS_REVIEWED', 'NSFW_HIGH_PRECISION'],
    });
    const baseContext = {
      ...context([sensitive]),
      viewerAge: { status: 'not_stated' } as const,
      viewerCountryCode: 'kr',
      viewerAccountCountryCode: 'us',
      viewerAllowsSensitiveMedia: true,
    };

    expect(evaluateVisibility(sensitive, baseContext).action).toBe('allow');
    expect(evaluateVisibility(sensitive, {
      ...baseContext,
      viewerAccountCountryCode: 'kr',
      viewerCountryCode: 'us',
    }).action).toBe('drop');
  });

  it('fails open for unknown age and interstitials NSFW authors on retweets', () => {
    const sensitiveRetweet = candidate(93, {
      inNetwork: true,
      isRetweet: true,
      hasImage: true,
      nsfwAuthor: true,
      visibilityFeatures: { authorState: 'active', authorNsfwUser: true },
      safetyLabels: ['GROK_SFA', 'PTOS_REVIEWED'],
    });
    const unknownAge = {
      ...context([sensitiveRetweet]),
      viewerAge: { status: 'unknown' } as const,
      viewerAccountCountryCode: 'kr',
      viewerAllowsSensitiveMedia: true,
    };
    expect(evaluateVisibility(sensitiveRetweet, unknownAge).action).toBe('allow');
    expect(evaluateVisibility(sensitiveRetweet, {
      ...unknownAge,
      viewerAllowsSensitiveMedia: false,
    })).toMatchObject({
      action: 'interstitial',
      decidedBy: 'NsfwAuthorInterstitialRule',
    });
  });

  it('does not grant the self-view exclusive-content exemption to retweets', () => {
    const selfRetweet = candidate(97, {
      authorId: context().currentUserId,
      inNetwork: true,
      isRetweet: true,
      originalTweetId: '123',
      visibilityFeatures: {
        authorState: 'active',
        exclusiveContent: true,
        viewerCanSeeExclusiveContent: false,
      },
    });
    expect(evaluateVisibility(selfRetweet, context([selfRetweet]))).toMatchObject({
      action: 'drop',
      decidedBy: 'DropExclusiveTweetContentRule',
    });
    expect(evaluateVisibility({
      ...selfRetweet,
      isRetweet: false,
    }, context([selfRetweet])).action).toBe('allow');
  });

  it('evaluates quote, ancestor, and retweet-original visibility fixtures', () => {
    const relatedDrop = {
      id: '1000',
      authorId: '77',
      hasImage: false,
      hasVideo: false,
      isRetweet: false,
      safetyLabels: ['SPAM'],
    };
    const withQuote = candidate(94, {
      quotedTweetId: relatedDrop.id,
      relatedPosts: { [relatedDrop.id]: relatedDrop },
    });
    expect(hydrateVisibility([withQuote], context([withQuote]))[0].dropAncillaryPosts).toBe(true);

    const tombstonedAncestor = candidate(95, {
      ancestors: [relatedDrop.id],
      tombstoneAncestorIds: [relatedDrop.id],
      relatedPosts: { [relatedDrop.id]: relatedDrop },
    });
    expect(hydrateVisibility([tombstonedAncestor], context([tombstonedAncestor]))[0]
      .dropAncillaryPosts).toBe(false);

    const retweet = candidate(96, {
      originalTweetId: relatedDrop.id,
      isRetweet: true,
      relatedPosts: { [relatedDrop.id]: relatedDrop },
    });
    expect(hydrateVisibility([retweet], context([retweet]))[0].dropAncillaryPosts).toBe(true);
  });

  it('reports the published author-state rule names', () => {
    const suspended = candidate(92, {
      visibilityFeatures: { authorState: 'suspended' },
    });
    expect(evaluateVisibility(suspended, context([suspended])).decidedBy)
      .toBe('SuspendedAuthorRule');
  });

  it('uses the smallest ancestor ID as the conversation key', () => {
    const low = candidate(10, { id: '100', ancestors: ['20', '10'], finalScore: 1 });
    const high = candidate(11, { id: '101', ancestors: ['10'], finalScore: 2 });
    const result = runFilter('dedup_conversation', [low, high], context());
    expect(result.passedCandidates.map((item) => item.id)).toEqual(['101']);
  });
});

describe('VMRanker and For You blending', () => {
  it('uses the retweet original and worst related-post brand-safety verdict', () => {
    const retweet = candidate(600, {
      id: '2054275414225846273',
      isRetweet: true,
      originalTweetId: '2054275414225846274',
      safetyLabels: ['GROK_SFA', 'PTOS_REVIEWED'],
      relatedPosts: {
        '2054275414225846274': {
          id: '2054275414225846274',
          authorId: '22',
          hasImage: false,
          hasVideo: false,
          isRetweet: false,
          safetyLabels: ['GROK_SFA', 'PTOS_REVIEWED', 'NSFW_TEXT'],
        },
      },
    });
    expect(hydrateBrandSafety(retweet).verdict).toBe('medium_risk');

    const quote = candidate(601, {
      quotedTweetId: '2054275414225846275',
      relatedPosts: {
        '2054275414225846275': {
          id: '2054275414225846275',
          authorId: '23',
          hasImage: false,
          hasVideo: false,
          isRetweet: false,
          safetyLabels: ['GROK_SFA', 'PTOS_REVIEWED', 'NSFA_LIMITED_INVENTORY'],
        },
      },
    });
    expect(hydrateBrandSafety(quote).verdict).toBe('low_risk');
    expect(hydrateBrandSafety({ ...quote, nsfwAuthorAds: true }).verdict).toBe('medium_risk');
    expect(hydrateBrandSafety({ ...quote, brandSafetyLookupFailed: true }).verdict)
      .toBe('safe');
    expect(hydrateBrandSafety({
      ...quote,
      brandSafetyLookupFailed: true,
      brandSafetyVerdict: undefined,
      safetyLabels: [],
    }).verdict).toBeUndefined();
    const existingLabels = ['ptos_reviewed', 'GROK_SFA', 'ptos_reviewed'];
    expect(hydrateBrandSafety({
      ...quote,
      brandSafetyLookupFailed: true,
      safetyLabels: existingLabels,
    }).safetyLabels).toEqual(existingLabels);

    const failed = candidate(602, {
      brandSafetyLookupFailed: true,
      brandSafetyVerdict: undefined,
      inNetwork: undefined,
    });
    const serialized = buildForYouFeed([failed], context([failed])).feedItems[0].tweet;
    expect(serialized).toMatchObject({
      brandSafetyVerdict: 'medium_risk',
      inNetwork: false,
    });
  });

  it('uses DPP diversity and leaves unselected scores at zero', () => {
    const items = [
      candidate(12, { id: '1', finalScore: 3, embedding: [1, 0] }),
      candidate(13, { id: '2', finalScore: 2.9, embedding: [1, 0] }),
      candidate(14, { id: '3', finalScore: 2, embedding: [0, 1] }),
    ];
    const result = runVMRanker(items, { ...DEFAULT_WEIGHTS, vmRankerTopK: 2 });
    const selected = result.updatedCandidates.filter((item) => item.vmRankerSelected);
    expect(selected.map((item) => item.id)).toEqual(['1', '3']);
    expect(result.updatedCandidates.find((item) => item.id === '2')?.finalScore).toBe(0);
  });

  it('excludes candidates without a score from the VMRanker DPP pool', () => {
    const scored = candidate(15, { id: '10', finalScore: 1, embedding: [1, 0] });
    const unscored = candidate(16, { id: '11', finalScore: undefined, embedding: [0, 1] });
    const result = runVMRanker([scored, unscored], { ...DEFAULT_WEIGHTS, vmRankerTopK: 2 });
    expect(result.result.summary?.poolSize).toBe(1);
    expect(result.updatedCandidates[1]).toMatchObject({
      finalScore: 0,
      vmRankerSelected: false,
    });
    const emptyPool = runVMRanker([unscored], { ...DEFAULT_WEIGHTS, vmRankerTopK: 2 });
    expect(emptyPool.result.summary).toMatchObject({ poolSize: 0, selectedCount: 0 });
    expect(emptyPool.updatedCandidates[0]).toMatchObject({
      finalScore: 0,
      vmRankerSelected: false,
    });
  });

  it('uses full-size deterministic fixture embeddings so DPP can fill Top K', () => {
    const items = generateMockTweets(60, 0.5).map((item, index) => ({
      ...item,
      finalScore: 60 - index,
    }));
    const result = runVMRanker(items, DEFAULT_WEIGHTS);

    expect(items[0].embedding).toHaveLength(RANKING_CONSTANTS.vmRankerEmbeddingDimension);
    expect(result.updatedCandidates.filter((item) => item.vmRankerSelected)).toHaveLength(50);
  });

  it('partitions safe organic posts around the published ad budget', () => {
    const posts = Array.from({ length: 12 }, (_, index) => candidate(20 + index, {
      finalScore: 12 - index,
      brandSafetyVerdict: index >= 10 ? 'medium_risk' : 'safe',
    }));
    const adFixtures = Array.from({ length: 8 }, (_, index) => ({
      id: `${index}`,
      insertPosition: 1 + index * 3,
      brandSafetyRisk: 'unknown' as const,
      handles: [],
      keywords: [],
    }));
    const feed = buildForYouFeed(posts, { ...context(posts), adFixtures });
    expect(feed.adCount).toBe(3);
    expect(feed.postCount).toBe(12);
    feed.feedItems.forEach((item, index) => {
      if (item.type !== 'ad') return;
      expect(feed.feedItems[index - 1]?.tweet?.brandSafetyVerdict).not.toBe('medium_risk');
      expect(feed.feedItems[index + 1]?.tweet?.brandSafetyVerdict).not.toBe('medium_risk');
    });
  });

  it('uses ad spacing and retries rejected BSR, handle, and keyword fixtures', () => {
    const posts = Array.from({ length: 12 }, (_, index) => candidate(650 + index, {
      content: index === 1 ? 'blocked launch topic' : `safe post ${index}`,
      finalScore: 12 - index,
      brandSafetyVerdict: index === 0 ? 'low_risk' : 'safe',
    }));
    const rejected = [
      {
        id: 'bsr', insertPosition: 1, brandSafetyRisk: 'low' as const,
        handles: [], keywords: [],
      },
      {
        id: 'handle', insertPosition: 5, brandSafetyRisk: 'unknown' as const,
        handles: [posts[0].authorId], keywords: [],
      },
      {
        id: 'keyword', insertPosition: 9, brandSafetyRisk: 'unknown' as const,
        handles: [], keywords: ['launch'],
      },
      {
        id: 'accepted', insertPosition: 13, brandSafetyRisk: 'unknown' as const,
        handles: [], keywords: [],
      },
    ];
    const feed = buildForYouFeed(posts, { ...context(posts), adFixtures: rejected });
    expect(feed.feedItems.filter((item) => item.type === 'ad').map((item) => item.id))
      .toEqual(['module-ad-accepted']);
  });
});

describe('end-to-end component inventory', () => {
  it('creates the exact TweetTypeMetrics bitset bytes', () => {
    const item = candidate(680, {
      id: generateSnowflakeIdFromAge(0.25, 88),
      authorFollowers: 99,
      originalTweetId: '1',
      inReplyToTweetId: '2',
      subscriptionAuthorId: '3',
      finalScore: 1,
      ancestors: ['4'],
      inNetwork: true,
      videoDurationMs: 10_000,
    });
    const bytes = createTweetTypeMetrics(item, {
      ...context([item]),
      currentTime: Date.now(),
      servedTweetIds: [],
    });
    expect(bytes).toHaveLength(39);
    [
      TWEET_TYPE_BITS.anyCandidate,
      TWEET_TYPE_BITS.retweet,
      TWEET_TYPE_BITS.reply,
      TWEET_TYPE_BITS.video,
      TWEET_TYPE_BITS.subscriptionPost,
      TWEET_TYPE_BITS.nearEmpty,
      TWEET_TYPE_BITS.emptyRequest,
      TWEET_TYPE_BITS.hasAncestors,
      TWEET_TYPE_BITS.fullScoringSucceeded,
      TWEET_TYPE_BITS.servedSizeLessThan20,
      TWEET_TYPE_BITS.servedSizeLessThan10,
      TWEET_TYPE_BITS.servedSizeLessThan5,
      TWEET_TYPE_BITS.inNetwork,
      TWEET_TYPE_BITS.videoLte10Sec,
      TWEET_TYPE_BITS.tweetAgeLte30Minutes,
      TWEET_TYPE_BITS.tweetAgeLte1Hour,
      TWEET_TYPE_BITS.tweetAgeLte6Hours,
      TWEET_TYPE_BITS.tweetAgeLte12Hours,
      TWEET_TYPE_BITS.authorFollowers0To100,
    ].forEach((bit) => expect(tweetTypeBitIsSet(bytes, bit)).toBe(true));
    expect(tweetTypeBitIsSet(bytes, TWEET_TYPE_BITS.tweetAgeGte24Hours)).toBe(false);

    const defaultedBytes = createTweetTypeMetrics({
      ...item,
      inNetwork: undefined,
      videoDurationMs: -1,
    }, context([item]));
    expect(tweetTypeBitIsSet(defaultedBytes, TWEET_TYPE_BITS.inNetwork)).toBe(true);
    expect(tweetTypeBitIsSet(defaultedBytes, TWEET_TYPE_BITS.videoGt60Sec)).toBe(true);

    const missingFollower = candidate(709, {
      authorFollowers: undefined,
      viewCount: 1,
      inNetwork: true,
      phoenixScores: { ...zeroScores(), favoriteScore: 1 },
    });
    const missingFollowerBytes = createTweetTypeMetrics(missingFollower, context([missingFollower]));
    [
      TWEET_TYPE_BITS.authorFollowers0To100,
      TWEET_TYPE_BITS.authorFollowers100To1K,
      TWEET_TYPE_BITS.authorFollowers1KTo10K,
      TWEET_TYPE_BITS.authorFollowers10KTo100K,
      TWEET_TYPE_BITS.authorFollowers100KTo1M,
      TWEET_TYPE_BITS.authorFollowers1MPlus,
    ].forEach((bit) => expect(tweetTypeBitIsSet(missingFollowerBytes, bit)).toBe(false));
    const missingFollowerRanked = runRankingScorer([missingFollower], {
      ...DEFAULT_WEIGHTS,
      enableAuthorDiversity: false,
      coldStartSlotMin: 0,
      coldStartSlotMax: 1,
      lowImpressionsMaxPositionRatio: 1,
    }, context([missingFollower])).updatedCandidates[0];
    expect(missingFollowerRanked.coldStartBoosted).not.toBe(true);

    const wrappedFollowerBytes = createTweetTypeMetrics({
      ...item,
      authorFollowers: -1,
    }, context([item]));
    expect(tweetTypeBitIsSet(wrappedFollowerBytes, TWEET_TYPE_BITS.authorFollowers1MPlus))
      .toBe(true);
  });

  it('enters the cached path only at 500 posts and keeps cache IDs independent from history', () => {
    const candidates = generateMockTweets(CACHED_POSTS_MIN_COUNT + 3, 1);
    const cachedIds = candidates.slice(0, CACHED_POSTS_MIN_COUNT).map((item) => item.id);
    const baseContext = context(candidates);
    const result = runPipeline(candidates, {
      ...baseContext,
      cachedPostIds: cachedIds,
      seenTweetIds: [candidates[500].id],
      servedTweetIds: [candidates[501].id],
      impressedTweetIds: [candidates[502].id],
    }, {
      enabledFilters: [
        'previously_seen_posts',
        'previously_seen_posts_backup',
        'previously_served_posts',
      ],
      weights: DEFAULT_WEIGHTS,
      topK: BLENDING_DEFAULTS.topKPosts,
    });

    expect(result.steps.find((item) => item.name === 'CachedPostsSource')?.outputCount)
      .toBe(CACHED_POSTS_MIN_COUNT);
    expect(result.afterFilterCount).toBe(CACHED_POSTS_MIN_COUNT);
    expect(result.steps.some((item) => item.name.startsWith('PhoenixScorer'))).toBe(false);

    const belowThreshold = runPipeline(candidates, {
      ...baseContext,
      cachedPostIds: cachedIds.slice(1),
    }, {
      enabledFilters: ['drop_duplicates'],
      weights: DEFAULT_WEIGHTS,
      topK: BLENDING_DEFAULTS.topKPosts,
    });
    expect(belowThreshold.steps.find((item) => item.name === 'CachedPostsSource')?.outputCount)
      .toBe(0);
    expect(belowThreshold.steps.some((item) => item.name.startsWith('PhoenixScorer'))).toBe(true);
  });

  it('persists cached slate contexts all-or-none while recomputing diversity scores', () => {
    const stored = {
      k: 7,
      poolRank: 9,
      poolRankGap: 3,
      fatigue: 0.25,
      preDiversityScore: 12,
    };
    const cachedPostIds = Array.from({ length: CACHED_POSTS_MIN_COUNT }, (_, index) => `${index}`);
    const items = [
      candidate(700, { slateContext: stored }),
      candidate(701, { slateContext: { ...stored, k: 8 } }),
    ];
    const complete = runRankingScorer(items, DEFAULT_WEIGHTS, {
      ...context(items),
      cachedPostIds,
    });
    expect(complete.updatedCandidates.map((item) => item.slateContext)).toEqual([
      stored,
      { ...stored, k: 8 },
    ]);
    expect(complete.updatedCandidates[0].diversityAdjustedScore).toBeDefined();

    const partial = runRankingScorer([
      items[0],
      { ...items[1], slateContext: undefined },
    ], DEFAULT_WEIGHTS, {
      ...context(items),
      cachedPostIds,
    });
    expect(partial.updatedCandidates.every((item) => item.slateContext === undefined)).toBe(true);
  });

  it('caps Simclusters and Phoenix source results at the published limits', () => {
    const repeated = Array.from({ length: 2_500 }, () => candidate(710));
    const result = runPipeline(repeated, context(repeated), {
      enabledFilters: ['drop_duplicates'],
      weights: DEFAULT_WEIGHTS,
      topK: BLENDING_DEFAULTS.topKPosts,
    });
    expect(result.steps.find((item) => item.name === 'SimclustersSource')?.outputCount).toBe(800);
    expect(result.steps.find((item) => item.name === 'PhoenixSource')?.outputCount).toBe(1_000);
  });

  it('truncates Scored Posts to 35 after post-selection filters', () => {
    const candidates = generateMockTweets(100, 0.4);
    const result = runPipeline(candidates, {
      ...context(candidates),
      adFixtures: [],
    }, {
      enabledFilters: [],
      weights: DEFAULT_WEIGHTS,
      topK: BLENDING_DEFAULTS.topKPosts,
    });
    expect(result.finalCandidates).toHaveLength(BLENDING_DEFAULTS.resultSize);
    expect(result.steps.find((item) => item.id === 'scored_posts_side_effects'))
      .toMatchObject({
        inputCount: BLENDING_DEFAULTS.resultSize,
        outputCount: BLENDING_DEFAULTS.resultSize,
      });
    expect(result.finalFeedItems).toHaveLength(BLENDING_DEFAULTS.resultSize);
  });

  it('runs the current source, hydrator, filter, scorer, and side-effect contract', () => {
    const scenario = RANKING_SCENARIOS.find((item) => item.id === 'for_you')!;
    const candidates = generateMockTweets(scenario.candidateCount, scenario.inNetworkRatio);
    const result = runPipeline(candidates, getDefaultFilterContext(candidates, scenario), {
      enabledFilters: [...PRE_SCORING_FILTERS, ...POST_SELECTION_FILTERS].map((filter) => filter.id),
      weights: DEFAULT_WEIGHTS,
      topK: BLENDING_DEFAULTS.topKPosts,
    });
    const names = result.steps.map((item) => item.name);
    expect(names).not.toContain('InferredGrokTopicsQueryHydrator');
    expect(names).toContain('UserInstalledAppsQueryHydrator');
    expect(names).toContain('SimclustersSource');
    expect(names).toContain('VMRanker DPP');
    expect(names).toContain('TopicFeedbackContextHydrator');
    expect(result.steps.find((item) => item.name === 'MutualFollowQueryHydrator')?.description)
      .toContain('disabled by published default');
    for (const name of [
      'FollowedUserIdsQueryHydrator',
      'ImpressionBloomFilterQueryHydrator',
      'IpQueryHydrator',
    ]) {
      expect(result.steps.find((item) => item.name === name)?.description)
        .toContain('disabled for this request');
    }
    expect(result.steps).toHaveLength(82);
    expect(result.steps.filter((item) => item.type === 'query_hydrator')).toHaveLength(19);
    expect(result.steps.filter((item) => item.type === 'source')).toHaveLength(16);
    expect(result.steps.filter((item) => item.type === 'hydrator')).toHaveLength(18);
    expect(result.steps.filter((item) => item.type === 'filter')).toHaveLength(21);
    expect(result.steps.find((item) => item.id === 'scored_posts_side_effects')?.details)
      .toMatchObject({
        execution: 'registered_only',
        actions: expect.arrayContaining([
          expect.objectContaining({ name: 'AuthorServedMetricsSideEffect' }),
          expect.objectContaining({ name: 'MutualFollowStatsSideEffect' }),
        ]),
      });
    expect(result.finalCandidates.every((item) => item.mutualFollowJaccard === undefined)).toBe(true);
    expect(result.finalCandidates.every((item) => item.topicFeedbackTopicId === undefined)).toBe(true);
    expect(result.finalCandidates.every((item) => (item.tweetTypeMetrics?.length || 0) >= 39))
      .toBe(true);
    expect(result.finalFeedItems.filter((item) => item.type === 'who_to_follow')).toHaveLength(1);
    expect(result.finalFeedItems.filter((item) => item.type === 'prompt')).toHaveLength(1);
    expect(result.finalFeedItems.length).toBeGreaterThan(0);
    expect(result.finalFeedItems.length).toBeLessThanOrEqual(47);

    const followingScenario = RANKING_SCENARIOS.find((item) => item.id === 'following_feed')!;
    const followingCandidates = generateMockTweets(20, 0.8);
    const following = runPipeline(
      followingCandidates,
      getDefaultFilterContext(followingCandidates, followingScenario),
      {
        enabledFilters: [],
        weights: DEFAULT_WEIGHTS,
        topK: BLENDING_DEFAULTS.topKPosts,
      }
    );
    expect(following.steps.find((item) => item.name === 'FilteredTopicsHydrator')?.description)
      .toContain('disabled for this request');
  });
});
