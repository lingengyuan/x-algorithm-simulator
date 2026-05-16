import {
  computePostAgeBucketMs,
  normalizeContinuousValueMs,
} from '../src/utils/scoring.ts';
import { buildForYouFeed } from '../src/core/feed.ts';

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual, expected, label) {
  if (Math.abs(actual - expected) > 1e-9) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const now = 1_800_000_000_000;

assertEqual(computePostAgeBucketMs(now, now - 30 * 60_000), 1, '30m age bucket');
assertEqual(computePostAgeBucketMs(now, now - 120 * 60_000), 3, '120m age bucket');
assertEqual(computePostAgeBucketMs(now, now - 4800 * 60_000), 81, '4800m overflow bucket');
assertEqual(computePostAgeBucketMs(now, now - 5000 * 60_000), 81, '5000m overflow bucket');
assertEqual(computePostAgeBucketMs(now, now + 60_000), 0, 'future post bucket');
assertClose(normalizeContinuousValueMs(15_000), 0.5, '15s continuous normalization');
assertClose(normalizeContinuousValueMs(30_000), 1, '30s continuous normalization');
assertClose(normalizeContinuousValueMs(60_000), 1, '60s continuous clamp');

function candidate(id, brandSafetyRisk = 'low', safetyLabels = []) {
  return {
    id,
    content: `Candidate ${id}`,
    authorId: `author-${id}`,
    authorName: `Author ${id}`,
    authorFollowers: 1000,
    authorVerified: false,
    hasImage: false,
    hasVideo: false,
    createdAt: now,
    inNetwork: true,
    isRetweet: false,
    brandSafetyRisk,
    safetyLabels,
    phoenixScores: {},
    finalScore: 1,
    filtered: false,
  };
}

const feed = buildForYouFeed([
  candidate('1'),
  candidate('2', 'high', ['sensitive_media']),
  candidate('3'),
  candidate('4', 'medium'),
  candidate('5'),
  candidate('6'),
  candidate('7'),
  candidate('8'),
], { includeForYouModules: true }, 10);

const adIndex = feed.feedItems.findIndex((item) => item.type === 'ad');
if (adIndex === -1) {
  throw new Error('safe-gap feed blend: expected an ad item');
}

const adjacentPosts = [
  feed.feedItems[adIndex - 1],
  feed.feedItems[adIndex + 1],
].filter((item) => item?.type === 'post');

if (!adjacentPosts.length) {
  throw new Error('safe-gap feed blend: expected ad to sit between organic posts');
}

for (const item of adjacentPosts) {
  if (item.tweet?.brandSafetyRisk !== 'low' || item.tweet?.safetyLabels?.length) {
    throw new Error(`safe-gap feed blend: ad is adjacent to unsafe post ${item.tweet?.id}`);
  }
}

console.log('Phoenix feature metadata and safe-gap feed checks passed.');
