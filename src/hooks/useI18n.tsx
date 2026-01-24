import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { getLanguage, setLanguage as saveLanguage } from '@/utils/storage';

type Translations = Record<string, Record<string, string>>;

// Default translations embedded for immediate availability
const DEFAULT_TRANSLATIONS: Record<string, Translations> = {
  'en-US': {
    common: {
      appName: 'X Recommendation Algorithm Simulator',
      tweetAnalyzer: 'Tweet Analyzer',
      rankingSimulator: 'Ranking Simulator',
      weightLab: 'Weight Lab',
      history: 'History',
      reset: 'Reset',
      analyze: 'Analyze',
      compare: 'Compare',
      share: 'Share',
      download: 'Download',
      close: 'Close',
      save: 'Save',
      delete: 'Delete',
      clear: 'Clear',
      loading: 'Loading...',
      noData: 'No data',
      language: 'Language',
    },
    analyzer: {
      title: 'Tweet Analyzer',
      subtitle: 'Predict engagement and reach before posting',
      inputPlaceholder: 'Enter your tweet content...',
      mediaType: 'Media Type',
      noMedia: 'No Media',
      image: 'Image',
      video: 'Video',
      videoDuration: 'Video Duration (seconds)',
      authorType: 'Author Type',
      normalUser: 'Normal User',
      verifiedUser: 'Verified User',
      influencer: 'Influencer',
      followerCount: 'Follower Count',
      analyzeButton: 'Analyze Tweet',
      compareMode: 'Compare Mode',
      addTweet: 'Add Tweet',
      removeTweet: 'Remove',
      behaviorPredictions: 'Behavior Predictions',
      positiveSignals: 'Positive Signals',
      negativeSignals: 'Negative Signals',
      heatScore: 'Heat Score',
      suggestions: 'Optimization Suggestions',
      filterRisks: 'Filter Risks',
    },
    simulator: {
      title: 'Ranking Simulator',
      subtitle: 'Visualize how the recommendation pipeline works',
      selectScenario: 'Select Scenario',
      candidatePool: 'Candidate Pool',
      filterStage: 'Filter Stage',
      scoringStage: 'Scoring Stage',
      finalRanking: 'Final Ranking',
      step: 'Step',
      of: 'of',
      play: 'Play',
      pause: 'Pause',
      nextStep: 'Next',
      prevStep: 'Previous',
      autoPlay: 'Auto Play',
      speed: 'Speed',
      inputCount: 'Input',
      outputCount: 'Output',
      filtered: 'Filtered',
      passed: 'Passed',
      tweets: 'tweets',
      inNetwork: 'In Network',
      outOfNetwork: 'Out of Network',
      viewDetails: 'View Details',
      phoenixScores: 'Phoenix Scores',
      weightedScore: 'Weighted Score',
      diversityScore: 'Diversity Score',
      finalScore: 'Final Score',
    },
    weightLab: {
      title: 'Weight Laboratory',
      subtitle: 'Adjust weights and see ranking changes in real-time',
      positiveWeights: 'Positive Weights',
      negativeWeights: 'Negative Weights',
      diversityParams: 'Diversity Parameters',
      oonParams: 'In/Out Network Balance',
      authorDiversityDecay: 'Author Diversity Decay',
      authorDiversityFloor: 'Author Diversity Floor',
      oonWeightFactor: 'OON Weight Factor',
      resetToDefault: 'Reset to Default',
      savePreset: 'Save Preset',
      loadPreset: 'Load Preset',
      presetName: 'Preset Name',
      liveRanking: 'Live Ranking',
      scoreChange: 'Score Change',
      rankChange: 'Rank Change',
    },
    history: {
      title: 'Analysis History',
      noHistory: 'No history yet',
      clearAll: 'Clear All',
      single: 'Single Analysis',
      compare: 'Comparison',
      ranking: 'Ranking Simulation',
    },
    heatLevel: {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      viral: 'Viral Potential',
    },
  },
  'zh-CN': {
    common: {
      appName: 'X 推荐算法模拟器',
      tweetAnalyzer: '推文分析器',
      rankingSimulator: '排序模拟器',
      weightLab: '权重实验室',
      history: '历史记录',
      reset: '重置',
      analyze: '分析',
      compare: '对比',
      share: '分享',
      download: '下载',
      close: '关闭',
      save: '保存',
      delete: '删除',
      clear: '清除',
      loading: '加载中...',
      noData: '暂无数据',
      language: '语言',
    },
    analyzer: {
      title: '推文分析器',
      subtitle: '发布前预测互动效果和传播潜力',
      inputPlaceholder: '输入你的推文内容...',
      mediaType: '媒体类型',
      noMedia: '无媒体',
      image: '图片',
      video: '视频',
      videoDuration: '视频时长（秒）',
      authorType: '作者类型',
      normalUser: '普通用户',
      verifiedUser: '认证用户',
      influencer: '大V',
      followerCount: '粉丝数量',
      analyzeButton: '分析推文',
      compareMode: '对比模式',
      addTweet: '添加推文',
      removeTweet: '移除',
      behaviorPredictions: '行为预测',
      positiveSignals: '正向信号',
      negativeSignals: '负向信号',
      heatScore: '热度评分',
      suggestions: '优化建议',
      filterRisks: '过滤风险',
    },
    simulator: {
      title: '排序模拟器',
      subtitle: '可视化推荐算法的工作流程',
      selectScenario: '选择场景',
      candidatePool: '候选池',
      filterStage: '过滤阶段',
      scoringStage: '评分阶段',
      finalRanking: '最终排序',
      step: '步骤',
      of: '/',
      play: '播放',
      pause: '暂停',
      nextStep: '下一步',
      prevStep: '上一步',
      autoPlay: '自动播放',
      speed: '速度',
      inputCount: '输入',
      outputCount: '输出',
      filtered: '已过滤',
      passed: '通过',
      tweets: '条推文',
      inNetwork: '关注内',
      outOfNetwork: '关注外',
      viewDetails: '查看详情',
      phoenixScores: 'Phoenix 分数',
      weightedScore: '加权分数',
      diversityScore: '多样性分数',
      finalScore: '最终分数',
    },
    weightLab: {
      title: '权重实验室',
      subtitle: '调整权重，实时观察排序变化',
      positiveWeights: '正向权重',
      negativeWeights: '负向权重',
      diversityParams: '多样性参数',
      oonParams: '内外网平衡',
      authorDiversityDecay: '作者多样性衰减',
      authorDiversityFloor: '作者多样性下限',
      oonWeightFactor: '关注外权重因子',
      resetToDefault: '恢复默认',
      savePreset: '保存预设',
      loadPreset: '加载预设',
      presetName: '预设名称',
      liveRanking: '实时排序',
      scoreChange: '分数变化',
      rankChange: '排名变化',
    },
    history: {
      title: '分析历史',
      noHistory: '暂无历史记录',
      clearAll: '清除全部',
      single: '单条分析',
      compare: '对比分析',
      ranking: '排序模拟',
    },
    heatLevel: {
      low: '低热度',
      medium: '中等热度',
      high: '高热度',
      viral: '爆款潜力',
    },
  },
};

let cachedTranslations: Record<string, Translations> = { ...DEFAULT_TRANSLATIONS };

export function useI18n() {
  const [language, setLanguageState] = useState<string>(() => getLanguage());
  const locale = language === 'zh' ? 'zh-CN' : 'en-US';
  const [translations, setTranslations] = useState<Translations>(
    () => cachedTranslations[locale] || DEFAULT_TRANSLATIONS['en-US']
  );
  const [loading, setLoading] = useState(false);

  // Load additional translations from file (optional, for extended translations)
  useEffect(() => {
    const loadTranslations = async () => {
      const currentLocale = language === 'zh' ? 'zh-CN' : 'en-US';

      // Use default translations immediately
      setTranslations(cachedTranslations[currentLocale] || DEFAULT_TRANSLATIONS['en-US']);

      // Try to load from file for any additional keys
      try {
        const response = await fetch(`./locales/${currentLocale}.json`);
        if (response.ok) {
          const data = await response.json();
          // Merge with defaults
          const merged = { ...DEFAULT_TRANSLATIONS[currentLocale], ...data };
          cachedTranslations[currentLocale] = merged;
          setTranslations(merged);
        }
      } catch (error) {
        // File loading failed, use defaults (already set)
        console.log('Using embedded translations');
      }
    };

    loadTranslations();
  }, [language]);

  // Change language
  const setLanguage = useCallback((lang: string) => {
    setLanguageState(lang);
    saveLanguage(lang);
    const newLocale = lang === 'zh' ? 'zh-CN' : 'en-US';
    setTranslations(cachedTranslations[newLocale] || DEFAULT_TRANSLATIONS['en-US']);
  }, []);

  // Get translation by key path (e.g., "common.appName")
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const parts = key.split('.');
      let value: unknown = translations;

      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          return fallback || key;
        }
      }

      return typeof value === 'string' ? value : fallback || key;
    },
    [translations]
  );

  // Toggle between languages
  const toggleLanguage = useCallback(() => {
    const newLang = language === 'en' ? 'zh' : 'en';
    setLanguage(newLang);
  }, [language, setLanguage]);

  return {
    language,
    setLanguage,
    toggleLanguage,
    t,
    loading,
    isZh: language === 'zh',
    isEn: language === 'en',
  };
}

// Context types
interface I18nContextType {
  language: string;
  setLanguage: (lang: string) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
  loading: boolean;
  isZh: boolean;
  isEn: boolean;
}

export const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const i18n = useI18n();

  return <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return context;
}
