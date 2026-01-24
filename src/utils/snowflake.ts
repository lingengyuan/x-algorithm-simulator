// Snowflake ID utilities based on Twitter's Snowflake format
// https://github.com/twitter/snowflake

// Twitter Snowflake epoch (November 4, 2010)
const TWITTER_EPOCH = 1288834974657n;

// Generate a Snowflake ID from timestamp
export function generateSnowflakeId(timestamp?: number): string {
  // Ensure timestamp is an integer (BigInt requires integer)
  const ts = BigInt(Math.floor(timestamp ?? Date.now()));
  const elapsed = ts - TWITTER_EPOCH;

  // Snowflake structure: timestamp (41 bits) | datacenter (5 bits) | worker (5 bits) | sequence (12 bits)
  // For simulation, we just use timestamp with random lower bits
  const datacenterId = BigInt(Math.floor(Math.random() * 32));
  const workerId = BigInt(Math.floor(Math.random() * 32));
  const sequence = BigInt(Math.floor(Math.random() * 4096));

  const snowflake = (elapsed << 22n) | (datacenterId << 17n) | (workerId << 12n) | sequence;

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
export function generateSnowflakeIdFromAge(hoursAgo: number): string {
  const timestamp = Date.now() - hoursAgo * 60 * 60 * 1000;
  return generateSnowflakeId(timestamp);
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
