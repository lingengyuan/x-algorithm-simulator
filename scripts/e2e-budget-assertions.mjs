import assert from 'node:assert/strict';

export function verifyBudgetTrace(budgetTrace, check) {
  assert.equal(budgetTrace.rawCandidates.length, 3500);
  assert(budgetTrace.rawCandidates.every((candidate) => candidate.id && candidate.phoenixScores));
  assert(Array.isArray(budgetTrace.context.servedHistory));
  assert(Array.isArray(budgetTrace.context.adFixtures));
  assert(Array.isArray(budgetTrace.config.enabledFilters) && budgetTrace.config.weights);
  assert(budgetTrace.result.steps.length > 0);
  assert(budgetTrace.result.finalCandidates.length > 0);
  check('trace-content', { rawCandidates: budgetTrace.rawCandidates.length, steps: budgetTrace.result.steps.length });
  const budgetHistory = budgetTrace.context.servedHistory.find((entry) => entry.entityType === 'post');
  const historyItems = budgetHistory.items;
  const interleavedIds = historyItems.flatMap((item) => [item.tweetId, item.sourceTweetId].filter(Boolean));
  assert(interleavedIds.length > 100, 'Source-budget history must cross the 100-ID limit');
  assert(historyItems.filter((item) => item.sourceTweetId).length >= 2, 'Source-budget history must contain tweet/source pairs');
  assert.deepEqual(budgetTrace.context.servedTweetIds, interleavedIds.slice(0, 100));
  assert.equal(budgetTrace.context.servedTweetIds.length, 100);
  assert(historyItems.some((item) => item.tweetId === interleavedIds[99] && item.sourceTweetId === interleavedIds[100]), 'Limit must split a tweet/source pair');
  assert(!budgetTrace.context.servedTweetIds.includes(interleavedIds[100]));
  check('served-history-order-and-limit', 'Tweet/source pairs retain their order and are truncated after 100 IDs.');
  const brandHydrator = budgetTrace.result.steps.find((step) => step.name === 'AdsBrandSafetyVfHydrator');
  assert(brandHydrator && !brandHydrator.description.includes('disabled'));
  const legacyHighRisk = budgetTrace.result.finalCandidates.filter((candidate) =>
    candidate.nsfwAuthorAds === true && candidate.safetyLabels?.includes('GROK_SFA'));
  assert(legacyHighRisk.length > 0, 'Source-budget fixture must retain a hydrated NSFW author with GROK_SFA');
  assert(legacyHighRisk.every((candidate) => candidate.brandSafetyVerdict === 'high_risk'));
  check('legacy-nsfw-author-override', { candidates: legacyHighRisk.length, verdict: 'high_risk' });
  const topK = budgetTrace.result.steps.find((step) => step.id === 'selector_top_k');
  assert.equal(budgetTrace.config.topK, 50);
  assert(topK.inputCount > 50);
  assert.equal(topK.outputCount, 50);
  check('default-top-k', 'The 3,500-post scenario selects 50 posts with the carousel disabled.');
  const safePosts = budgetTrace.result.finalCandidates.filter((post) => !['medium_risk', 'high_risk'].includes(post.brandSafetyVerdict ?? 'medium_risk'));
  const ads = budgetTrace.context.adFixtures;
  const positions = ads.slice(0, 4).map((ad) => ad.insertPosition).sort((a, b) => a - b);
  const gaps = positions.slice(1).map((position, index) => position - positions[index]).filter((gap) => gap > 0);
  const spacing = gaps.length && Math.min(...gaps) >= 3 ? Math.min(...gaps) : 3;
  assert(ads.every((ad) => ad.brandSafetyRisk === 'unknown' && !ad.handles.length && !ad.keywords.length));
  const organic = budgetTrace.result.finalFeedItems.filter((item) => item.type === 'post' || item.type === 'ad');
  const placed = organic.flatMap((item, index) => item.type === 'ad' ? [{ item, above: organic[index - 1], below: organic[index + 1] }] : []);
  // MultiRisk assembles eight triples before truncating to the 35-item page.
  assert.equal(spacing, 3);
  assert.equal(ads.length, 8);
  assert(safePosts.length >= 16);
  assert.equal(organic.length, 35);
  assert.equal(placed.length, 7);
  const adPositions = organic.flatMap((item, index) => item.type === 'ad' ? [index] : []);
  assert.deepEqual(adPositions, [1, 6, 11, 16, 21, 26, 32]);
  const postIds = organic.filter((item) => item.type === 'post').map((item) => item.tweet.id);
  assert.equal(new Set(postIds).size, postIds.length);
  const groupSize = Math.floor(safePosts.length / 8);
  for (const [index, triple] of placed.entries()) {
    assert.equal(triple.item.id, `module-ad-${ads[index].id}`);
    assert.equal(triple.above.tweet.id, safePosts[index * groupSize].id);
    assert.equal(triple.below.tweet.id, safePosts[index * groupSize + 1].id);
    for (const neighbour of [triple.above, triple.below]) {
      assert.equal(neighbour?.type, 'post');
      assert(!['medium_risk', 'high_risk'].includes(neighbour.tweet.brandSafetyVerdict));
    }
  }
  check('multi-risk-page-and-neighbours', { pageSize: organic.length, adPositions, checkedAds: placed.length });

}
