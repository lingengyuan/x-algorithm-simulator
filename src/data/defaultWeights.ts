import type { WeightConfig } from '@/core/types';
import { UPSTREAM_DEFAULT_WEIGHTS } from '@/data/upstreamSnapshot';

export const DEFAULT_WEIGHTS: WeightConfig = { ...UPSTREAM_DEFAULT_WEIGHTS };

export type AdjustableWeightKey =
  | 'favoriteWeight'
  | 'replyWeight'
  | 'retweetWeight'
  | 'photoExpandWeight'
  | 'videoOpenWeight'
  | 'clickWeight'
  | 'openLinkWeight'
  | 'profileClickWeight'
  | 'vqvWeight'
  | 'shareWeight'
  | 'shareViaDmWeight'
  | 'shareViaCopyLinkWeight'
  | 'dwellWeight'
  | 'quoteWeight'
  | 'quotedClickWeight'
  | 'quotedVqvWeight'
  | 'followAuthorWeight'
  | 'postUnexploredWeight'
  | 'dwellTimeWeight'
  | 'clickDwellTimeWeight'
  | 'activeSecs5mResidualNormWeight'
  | 'notInterestedWeight'
  | 'blockAuthorWeight'
  | 'muteAuthorWeight'
  | 'reportWeight'
  | 'notDwelledWeight';

interface WeightMetadata {
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  min: number;
  max: number;
  step: number;
  type: 'positive' | 'negative';
}

export function weightPrecision(step: number): number {
  const text = step.toString();
  if (text.includes('e-')) return Number(text.split('e-')[1]);
  return text.includes('.') ? text.split('.')[1].length : 0;
}

export function formatWeight(value: number, step: number): string {
  return value.toFixed(weightPrecision(step));
}

// The ranges are UI editing bounds; the default values are the published upstream snapshot.
export const WEIGHT_METADATA: Record<AdjustableWeightKey, WeightMetadata> = {
  favoriteWeight: {
    name: 'Like', nameZh: '点赞',
    description: 'Weight × predicted like probability', descriptionZh: '权重 × 预测点赞概率',
    min: 0, max: 5, step: 0.05, type: 'positive',
  },
  replyWeight: {
    name: 'Reply', nameZh: '回复',
    description: 'Base weight × predicted reply probability', descriptionZh: '基础权重 × 预测回复概率',
    min: 0, max: 20, step: 0.5, type: 'positive',
  },
  retweetWeight: {
    name: 'Repost', nameZh: '转帖',
    description: 'Weight × predicted repost probability', descriptionZh: '权重 × 预测转帖概率',
    min: 0, max: 10, step: 0.1, type: 'positive',
  },
  photoExpandWeight: {
    name: 'Photo Expand', nameZh: '展开图片',
    description: 'Weight × predicted photo-expand probability', descriptionZh: '权重 × 预测图片展开概率',
    min: 0, max: 1, step: 0.01, type: 'positive',
  },
  videoOpenWeight: {
    name: 'Video Open', nameZh: '打开视频',
    description: 'Weight × predicted video-open probability', descriptionZh: '权重 × 预测视频打开概率',
    min: 0, max: 1, step: 0.01, type: 'positive',
  },
  clickWeight: {
    name: 'Post Click', nameZh: '点击帖子',
    description: 'Weight × predicted post-click probability', descriptionZh: '权重 × 预测帖子点击概率',
    min: 0, max: 5, step: 0.05, type: 'positive',
  },
  openLinkWeight: {
    name: 'Open Link', nameZh: '打开链接',
    description: 'Weight × predicted external-link probability', descriptionZh: '权重 × 预测外链打开概率',
    min: 0, max: 5, step: 0.05, type: 'positive',
  },
  profileClickWeight: {
    name: 'Profile Click', nameZh: '点击主页',
    description: 'Weight × predicted profile-click probability', descriptionZh: '权重 × 预测主页点击概率',
    min: 0, max: 5, step: 0.05, type: 'positive',
  },
  vqvWeight: {
    name: 'Video Quality View', nameZh: '视频质量观看',
    description: 'Applied only when the upstream VQV gate passes', descriptionZh: '仅在上游 VQV 条件通过时应用',
    min: 0, max: 1, step: 0.01, type: 'positive',
  },
  shareWeight: {
    name: 'Share', nameZh: '分享',
    description: 'Weight × predicted share probability', descriptionZh: '权重 × 预测分享概率',
    min: 0, max: 10, step: 0.1, type: 'positive',
  },
  shareViaDmWeight: {
    name: 'Share via DM', nameZh: '私信分享',
    description: 'Weight × predicted DM-share probability', descriptionZh: '权重 × 预测私信分享概率',
    min: 0, max: 20, step: 0.5, type: 'positive',
  },
  shareViaCopyLinkWeight: {
    name: 'Copy Link', nameZh: '复制链接',
    description: 'Weight × predicted copy-link probability', descriptionZh: '权重 × 预测复制链接概率',
    min: 0, max: 40, step: 1, type: 'positive',
  },
  dwellWeight: {
    name: 'Dwell', nameZh: '停留',
    description: 'Weight × predicted dwell-event probability', descriptionZh: '权重 × 预测停留事件概率',
    min: 0, max: 5, step: 0.05, type: 'positive',
  },
  quoteWeight: {
    name: 'Quote', nameZh: '引用',
    description: 'Weight × predicted quote probability', descriptionZh: '权重 × 预测引用概率',
    min: 0, max: 10, step: 0.1, type: 'positive',
  },
  quotedClickWeight: {
    name: 'Quoted Click', nameZh: '点击引用内容',
    description: 'Weight × predicted quoted-post click probability', descriptionZh: '权重 × 预测引用内容点击概率',
    min: 0, max: 1, step: 0.01, type: 'positive',
  },
  quotedVqvWeight: {
    name: 'Quoted Video View', nameZh: '引用视频观看',
    description: 'Weight × predicted quoted-video quality view', descriptionZh: '权重 × 预测引用视频质量观看',
    min: 0, max: 1, step: 0.01, type: 'positive',
  },
  followAuthorWeight: {
    name: 'Follow Author', nameZh: '关注作者',
    description: 'Weight × predicted author-follow probability', descriptionZh: '权重 × 预测关注作者概率',
    min: 0, max: 10, step: 0.1, type: 'positive',
  },
  postUnexploredWeight: {
    name: 'Post Unexplored', nameZh: '未充分探索',
    description: 'Additive under-exploration term; in-network only by default', descriptionZh: '未充分探索加分；默认仅关注内内容',
    min: 0, max: 1, step: 0.01, type: 'positive',
  },
  dwellTimeWeight: {
    name: 'Continuous Dwell', nameZh: '连续停留时长',
    description: 'Weight × predicted continuous dwell value', descriptionZh: '权重 × 预测连续停留值',
    min: 0, max: 0.02, step: 0.001, type: 'positive',
  },
  clickDwellTimeWeight: {
    name: 'Click Dwell', nameZh: '点击后停留',
    description: 'Weight × predicted click-dwell value', descriptionZh: '权重 × 预测点击后停留值',
    min: 0, max: 0.02, step: 0.001, type: 'positive',
  },
  activeSecs5mResidualNormWeight: {
    name: 'Active Seconds Residual', nameZh: '活跃秒数残差',
    description: 'Weight × normalized five-minute active-seconds residual', descriptionZh: '权重 × 五分钟活跃秒数归一化残差',
    min: 0, max: 1, step: 0.01, type: 'positive',
  },
  notInterestedWeight: {
    name: 'Not Interested', nameZh: '不感兴趣',
    description: 'Weight × predicted not-interested probability', descriptionZh: '权重 × 预测不感兴趣概率',
    min: -80, max: 0, step: 1, type: 'negative',
  },
  blockAuthorWeight: {
    name: 'Block Author', nameZh: '屏蔽作者',
    description: 'Weight × predicted block probability', descriptionZh: '权重 × 预测屏蔽概率',
    min: -80, max: 0, step: 1, type: 'negative',
  },
  muteAuthorWeight: {
    name: 'Mute Author', nameZh: '静音作者',
    description: 'Weight × predicted mute probability', descriptionZh: '权重 × 预测静音概率',
    min: -100, max: 0, step: 1, type: 'negative',
  },
  reportWeight: {
    name: 'Report', nameZh: '举报',
    description: 'Weight × personalized predicted report probability', descriptionZh: '权重 × 个性化预测举报概率',
    min: -250, max: 0, step: 1, type: 'negative',
  },
  notDwelledWeight: {
    name: 'Not Dwelled', nameZh: '未停留',
    description: 'Weight × predicted no-dwell probability', descriptionZh: '权重 × 预测未停留概率',
    min: -1, max: 0, step: 0.01, type: 'negative',
  },
};
