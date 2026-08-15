// Snowflake ID utilities based on Twitter's Snowflake format
// https://github.com/twitter/snowflake

// Twitter Snowflake epoch (November 4, 2010)
const TWITTER_EPOCH = 1288834974657n;

// Generate a Snowflake ID from timestamp
export function generateSnowflakeId(timestamp?: number, lowerBitsSeed?: number): string {
  // Ensure timestamp is an integer (BigInt requires integer)
  const ts = BigInt(Math.floor(timestamp ?? Date.now()));
  const elapsed = ts - TWITTER_EPOCH;

  // The lower 22 bits do not affect timestamp extraction. A supplied seed keeps fixtures reproducible.
  const lowerBits = BigInt(
    lowerBitsSeed === undefined
      ? Math.floor(Math.random() * 2 ** 22)
      : Math.abs(lowerBitsSeed) % 2 ** 22
  );
  const snowflake = (elapsed << 22n) | lowerBits;

  return snowflake.toString();
}

// Extract timestamp from Snowflake ID
export function extractTimestampFromSnowflake(snowflakeId: string): number {
  const id = BigInt(snowflakeId);
  const timestamp = (id >> 22n) + TWITTER_EPOCH;
  return Number(timestamp);
}

// Calculate age in hours from Snowflake ID
export function getAgeInHours(snowflakeId: string): number {
  const timestamp = extractTimestampFromSnowflake(snowflakeId);
  const now = Date.now();
  return (now - timestamp) / (1000 * 60 * 60);
}

// Calculate age in days from Snowflake ID
export function getAgeInDays(snowflakeId: string): number {
  return getAgeInHours(snowflakeId) / 24;
}

// Generate a Snowflake ID for a specific time ago
export function generateSnowflakeIdFromAge(hoursAgo: number, lowerBitsSeed?: number): string {
  const timestamp = Date.now() - hoursAgo * 60 * 60 * 1000;
  return generateSnowflakeId(timestamp, lowerBitsSeed);
}

// Format timestamp to relative time string
export function formatRelativeTime(snowflakeId: string, locale: string = 'en'): string {
  const timestamp = extractTimestampFromSnowflake(snowflakeId);
  const now = Date.now();
  const diffMs = now - timestamp;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (locale === 'zh') {
    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  }

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
