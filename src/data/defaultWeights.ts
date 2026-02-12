import { WeightConfig } from '@/core/types';

export const DEFAULT_WEIGHTS: WeightConfig = {
  // Positive weights (based on observed X algorithm patterns)
  favoriteWeight: 1.0,
  replyWeight: 0.5,
  retweetWeight: 2.0,
  photoExpandWeight: 0.3,
  clickWeight: 0.3,
  profileClickWeight: 0.5,
  vqvWeight: 1.5,
  shareWeight: 1.0,
  shareViaDmWeight: 0.8,
  shareViaCopyLinkWeight: 0.6,
  dwellWeight: 0.5,
  quoteWeight: 1.5,
  quotedClickWeight: 0.4,
  followAuthorWeight: 3.0,

  // Negative weights
  notInterestedWeight: -2.0,
  blockAuthorWeight: -5.0,
  muteAuthorWeight: -3.0,
  reportWeight: -10.0,
  dwellTimeWeight: 0.0003,

  // Weighted scorer controls
  minVideoDurationMs: 15000,
  negativeScoresOffset: 1.0,

  // Diversity parameters
  authorDiversityDecay: 0.8,
  authorDiversityFloor: 0.2,

  // OON (Out of Network) factor
  oonWeightFactor: 0.7,
};

// Weight metadata for UI
export const WEIGHT_METADATA: Record<keyof Omit<
  WeightConfig,
  | 'authorDiversityDecay'
  | 'authorDiversityFloor'
  | 'oonWeightFactor'
  | 'dwellTimeWeight'
  | 'minVideoDurationMs'
  | 'negativeScoresOffset'
>, {
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  min: number;
  max: number;
  step: number;
  type: 'positive' | 'negative';
}> = {
  favoriteWeight: {
    name: 'Like',
    nameZh: '点赞',
    description: 'Weight for like probability',
    descriptionZh: '点赞行为的权重',
    min: 0,
    max: 5,
    step: 0.1,
    type: 'positive',
  },
  replyWeight: {
    name: 'Reply',
    nameZh: '回复',
    description: 'Weight for reply probability',
    descriptionZh: '回复行为的权重',
    min: 0,
    max: 5,
    step: 0.1,
    type: 'positive',
  },
  retweetWeight: {
    name: 'Retweet',
    nameZh: '转发',
    description: 'Weight for retweet probability',
    descriptionZh: '转发行为的权重',
    min: 0,
    max: 5,
    step: 0.1,
    type: 'positive',
  },
  photoExpandWeight: {
    name: 'Photo Expand',
    nameZh: '图片展开',
    description: 'Weight for photo expand probability',
    descriptionZh: '展开图片行为的权重',
    min: 0,
    max: 5,
    step: 0.1,
    type: 'positive',
  },
  clickWeight: {
    name: 'Click',
    nameZh: '点击',
    description: 'Weight for click probability',
    descriptionZh: '点击行为的权重',
    min: 0,
    max: 5,
    step: 0.1,
    type: 'positive',
  },
  profileClickWeight: {
    name: 'Profile Click',
    nameZh: '点击主页',
    description: 'Weight for profile click probability',
    descriptionZh: '点击作者主页的权重',
    min: 0,
    max: 5,
    step: 0.1,
    type: 'positive',
  },
  vqvWeight: {
    name: 'Video Quality View',
    nameZh: '视频质量观看',
    description: 'Weight for video quality view score',
    descriptionZh: '视频质量观看评分的权重',
    min: 0,
    max: 5,
    step: 0.1,
    type: 'positive',
  },
  shareWeight: {
    name: 'Share',
    nameZh: '分享',
    description: 'Weight for share probability',
    descriptionZh: '分享行为的权重',
    min: 0,
    max: 5,
    step: 0.1,
    type: 'positive',
  },
  shareViaDmWeight: {
    name: 'Share via DM',
    nameZh: '私信分享',
    description: 'Weight for sharing via direct message',
    descriptionZh: '通过私信分享的权重',
    min: 0,
    max: 5,
    step: 0.1,
    type: 'positive',
  },
  shareViaCopyLinkWeight: {
    name: 'Copy Link',
    nameZh: '复制链接',
    description: 'Weight for copy link action',
    descriptionZh: '复制链接行为的权重',
    min: 0,
    max: 5,
    step: 0.1,
    type: 'positive',
  },
  dwellWeight: {
    name: 'Dwell Time',
    nameZh: '停留时长',
    description: 'Weight for expected dwell time',
    descriptionZh: '预期停留时长的权重',
    min: 0,
    max: 5,
    step: 0.1,
    type: 'positive',
  },
  quoteWeight: {
    name: 'Quote',
    nameZh: '引用',
    description: 'Weight for quote tweet probability',
    descriptionZh: '引用推文行为的权重',
    min: 0,
    max: 5,
    step: 0.1,
    type: 'positive',
  },
  quotedClickWeight: {
    name: 'Quoted Click',
    nameZh: '点击引用',
    description: 'Weight for clicking quoted content',
    descriptionZh: '点击引用内容的权重',
    min: 0,
    max: 5,
    step: 0.1,
    type: 'positive',
  },
  followAuthorWeight: {
    name: 'Follow Author',
    nameZh: '关注作者',
    description: 'Weight for follow author probability',
    descriptionZh: '关注作者行为的权重',
    min: 0,
    max: 10,
    step: 0.1,
    type: 'positive',
  },
  notInterestedWeight: {
    name: 'Not Interested',
    nameZh: '不感兴趣',
    description: 'Weight for not interested signal',
    descriptionZh: '"不感兴趣"信号的权重',
    min: -10,
    max: 0,
    step: 0.1,
    type: 'negative',
  },
  blockAuthorWeight: {
    name: 'Block Author',
    nameZh: '屏蔽作者',
    description: 'Weight for block author signal',
    descriptionZh: '屏蔽作者信号的权重',
    min: -20,
    max: 0,
    step: 0.1,
    type: 'negative',
  },
  muteAuthorWeight: {
    name: 'Mute Author',
    nameZh: '静音作者',
    description: 'Weight for mute author signal',
    descriptionZh: '静音作者信号的权重',
    min: -10,
    max: 0,
    step: 0.1,
    type: 'negative',
  },
  reportWeight: {
    name: 'Report',
    nameZh: '举报',
    description: 'Weight for report signal',
    descriptionZh: '举报信号的权重',
    min: -20,
    max: 0,
    step: 0.1,
    type: 'negative',
  },
};
