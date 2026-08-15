import type { FilterContext, TweetCandidate } from '@/core/types';
import { extractTimestampFromSnowflake } from '@/utils/snowflake';

export const TWEET_TYPE_BITS = {
  anyCandidate: 0,
  retweet: 1,
  reply: 2,
  video: 5,
  subscriptionPost: 10,
  nearEmpty: 23,
  emptyRequest: 32,
  hasAncestors: 37,
  fullScoringSucceeded: 38,
  servedSizeLessThan20: 39,
  servedSizeLessThan10: 40,
  servedSizeLessThan5: 41,
  inNetwork: 80,
  videoLte10Sec: 151,
  videoBetween10And60Sec: 152,
  videoGt60Sec: 153,
  tweetAgeLte30Minutes: 154,
  tweetAgeLte1Hour: 155,
  tweetAgeLte6Hours: 156,
  tweetAgeLte12Hours: 157,
  tweetAgeGte24Hours: 158,
  authorFollowers0To100: 309,
  authorFollowers100To1K: 310,
  authorFollowers1KTo10K: 311,
  authorFollowers10KTo100K: 312,
  authorFollowers100KTo1M: 313,
  authorFollowers1MPlus: 314,
} as const;

function setFollowerBit(bits: Set<number>, followers: number): void {
  if (followers < 100) bits.add(TWEET_TYPE_BITS.authorFollowers0To100);
  else if (followers < 1_000) bits.add(TWEET_TYPE_BITS.authorFollowers100To1K);
  else if (followers < 10_000) bits.add(TWEET_TYPE_BITS.authorFollowers1KTo10K);
  else if (followers < 100_000) bits.add(TWEET_TYPE_BITS.authorFollowers10KTo100K);
  else if (followers < 1_000_000) bits.add(TWEET_TYPE_BITS.authorFollowers100KTo1M);
  else bits.add(TWEET_TYPE_BITS.authorFollowers1MPlus);
}

function setAgeBits(bits: Set<number>, tweetId: string, now: number): void {
  try {
    const ageMs = now - extractTimestampFromSnowflake(tweetId);
    if (ageMs < 0) return;
    if (ageMs <= 30 * 60_000) bits.add(TWEET_TYPE_BITS.tweetAgeLte30Minutes);
    if (ageMs <= 60 * 60_000) bits.add(TWEET_TYPE_BITS.tweetAgeLte1Hour);
    if (ageMs <= 6 * 60 * 60_000) bits.add(TWEET_TYPE_BITS.tweetAgeLte6Hours);
    if (ageMs <= 12 * 60 * 60_000) bits.add(TWEET_TYPE_BITS.tweetAgeLte12Hours);
    if (ageMs >= 24 * 60 * 60_000) bits.add(TWEET_TYPE_BITS.tweetAgeGte24Hours);
  } catch {
    // Upstream only accepts u64 snowflakes. Invalid local fixture IDs have no age bits.
  }
}

function bitsetToBytes(bits: ReadonlySet<number>): number[] {
  const maxBit = Math.max(...bits);
  const bytes = Array.from({ length: Math.floor(maxBit / 8) + 1 }, () => 0);
  for (const bit of bits) bytes[Math.floor(bit / 8)] |= 1 << (bit % 8);
  return bytes;
}

export function createTweetTypeMetrics(
  candidate: TweetCandidate,
  context: FilterContext
): number[] {
  const bits = new Set<number>([TWEET_TYPE_BITS.anyCandidate]);
  if (candidate.originalTweetId) bits.add(TWEET_TYPE_BITS.retweet);
  if (candidate.inReplyToTweetId) bits.add(TWEET_TYPE_BITS.reply);
  if (candidate.subscriptionAuthorId) bits.add(TWEET_TYPE_BITS.subscriptionPost);
  if (candidate.finalScore !== undefined && candidate.finalScore !== 0) {
    bits.add(TWEET_TYPE_BITS.fullScoringSucceeded);
  }
  if (candidate.ancestors?.length) bits.add(TWEET_TYPE_BITS.hasAncestors);
  if (candidate.inNetwork !== false) bits.add(TWEET_TYPE_BITS.inNetwork);
  if (candidate.authorFollowers !== undefined) {
    setFollowerBit(bits, Math.trunc(candidate.authorFollowers) >>> 0);
  }

  if (candidate.videoDurationMs !== undefined) {
    bits.add(TWEET_TYPE_BITS.video);
    const durationMs = Math.trunc(candidate.videoDurationMs) >>> 0;
    if (durationMs <= 10_000) bits.add(TWEET_TYPE_BITS.videoLte10Sec);
    else if (durationMs <= 60_000) {
      bits.add(TWEET_TYPE_BITS.videoBetween10And60Sec);
    } else bits.add(TWEET_TYPE_BITS.videoGt60Sec);
  }
  setAgeBits(bits, candidate.id, context.currentTime);

  const servedSize = context.servedTweetIds.length;
  if (servedSize === 0) bits.add(TWEET_TYPE_BITS.emptyRequest);
  if (servedSize < 3) bits.add(TWEET_TYPE_BITS.nearEmpty);
  if (servedSize < 20) bits.add(TWEET_TYPE_BITS.servedSizeLessThan20);
  if (servedSize < 10) bits.add(TWEET_TYPE_BITS.servedSizeLessThan10);
  if (servedSize < 5) bits.add(TWEET_TYPE_BITS.servedSizeLessThan5);
  return bitsetToBytes(bits);
}

export function tweetTypeBitIsSet(bytes: readonly number[], bit: number): boolean {
  return Boolean(bytes[Math.floor(bit / 8)] & (1 << (bit % 8)));
}
