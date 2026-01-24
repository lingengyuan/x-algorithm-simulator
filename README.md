# X Recommendation Algorithm Simulator / X 推荐算法模拟器

[English](#english) | [中文](#中文)

---

<a name="english"></a>

## English

A fully interactive web simulator for understanding X (Twitter)'s recommendation algorithm. This project visualizes the complete pipeline from tweet creation to ranking, based on the algorithm X open-sourced in 2026.

### Background

In January 2026, X (formerly Twitter) open-sourced their recommendation algorithm. After deep-diving into the source code, we built this simulator to help everyone understand:

- **How tweets are filtered** — 12 filtering stages decide what you don't see
- **How tweets are scored** — 18 behavior predictions determine ranking
- **How weights affect ranking** — Adjust parameters and see results in real-time

### Screenshots

> **Note:** Screenshots needed for the following sections:

| Screenshot | Description |
|------------|-------------|
| `screenshot-analyzer.png` | Tweet Analyzer with heat gauge and radar chart |
| `screenshot-ranking.png` | Ranking Simulator showing pipeline execution |
| `screenshot-weightlab.png` | Weight Laboratory with parameter sliders |

### Features

#### Tweet Analyzer
Analyze any tweet content and predict its performance:

- **18 Behavior Predictions** — Likes, retweets, replies, shares, follows, video views, and more
- **Heat Score (0-100)** — Visual gauge showing tweet potential (Low/Medium/High/Viral)
- **Radar Chart** — Visualize 14 positive signals at a glance
- **Optimization Suggestions** — AI-powered tips to improve your tweet
- **Filter Risk Warnings** — Know if your tweet might be filtered out
- **Compare Mode** — Analyze multiple tweets side by side

#### Ranking Simulator
Watch the complete recommendation pipeline in action:

- **12 Filter Stages** — See how candidates are eliminated step by step
- **4 Scoring Stages** — Phoenix ML → Weighted Sum → Diversity → OON Balance
- **Step-by-Step Animation** — Play, pause, and control the pipeline execution
- **3 Scenarios** — Following Feed (80% in-network), For You (40% in-network), Trending (20% in-network)
- **Detailed Statistics** — Input/output counts and tweet details at each stage

#### Weight Laboratory
Experiment with ranking parameters in real-time:

- **18+ Weight Sliders** — Adjust all positive and negative signal weights
- **Live Updates** — See ranking changes instantly as you adjust
- **Diversity Controls** — Tune author diversity decay and floor values
- **OON Balance** — Control in-network vs out-of-network content ratio
- **Presets** — Save and load custom weight configurations

### Getting Started

```bash
# Clone the repository
git clone https://github.com/yourname/x-algorithm-simulator.git

# Enter project directory
cd x-algorithm-simulator

# Install dependencies
npm install

# Start development server
npm run dev
```

After starting, open `http://localhost:5173` in your browser.

### Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| Animation | Framer Motion |
| Routing | React Router 7 |
| i18n | i18next |
| Icons | Lucide React |
| Build | Vite 7 |

### Project Structure

```
src/
├── core/                    # Core algorithm implementation
│   ├── filters/             # 12 filter implementations
│   ├── scorers/             # 4 scorer implementations
│   ├── pipeline.ts          # Pipeline orchestration
│   └── types.ts             # TypeScript type definitions
├── components/
│   ├── Layout/              # App shell and navigation
│   ├── TweetAnalyzer/       # Tweet analysis module
│   ├── RankingSimulator/    # Ranking visualization
│   ├── WeightLab/           # Weight adjustment module
│   ├── History/             # Analysis history management
│   ├── shared/              # Shared UI components
│   └── ui/                  # Base UI primitives (shadcn/ui)
├── data/
│   ├── mockTweets.ts        # Mock tweet data and scenarios
│   └── defaultWeights.ts    # Default weight configuration
├── hooks/
│   └── useI18n.tsx          # Internationalization hook
├── utils/
│   ├── scoring.ts           # Phoenix score simulation
│   ├── snowflake.ts         # Snowflake ID utilities
│   └── storage.ts           # LocalStorage wrapper
└── App.tsx                  # Main app entry
```

### Algorithm Implementation

#### Filters (12 Stages)

| # | Filter | Description |
|---|--------|-------------|
| 1 | DropDuplicatesFilter | Keep only first tweet per conversation |
| 2 | AgeFilter | Remove tweets older than 7 days |
| 3 | SelfTweetFilter | Remove user's own tweets |
| 4 | BlockedAuthorFilter | Remove blocked users' tweets |
| 5 | MutedAuthorFilter | Remove muted users' tweets |
| 6 | SeenTweetsFilter | Remove already viewed tweets |
| 7 | NSFWFilter | Filter sensitive content by keywords |
| 8 | LowQualityFilter | Detect spam patterns (too short, all caps, etc.) |
| 9 | ConversationDepthFilter | Remove deeply nested replies (depth > 3) |
| 10 | RetweetOfSeenFilter | Remove retweets of seen content |
| 11 | AuthorDiversityPreFilter | Limit 3 tweets per author |
| 12 | NegativeFeedbackFilter | Remove high negative signal tweets |

#### Scorers (4 Stages)

| # | Scorer | Input | Output |
|---|--------|-------|--------|
| 1 | Phoenix ML Scorer | Tweet content & metadata | 18 behavior probabilities |
| 2 | Weighted Sum Scorer | 18 probabilities + weights | Combined weighted score |
| 3 | Author Diversity Scorer | Weighted scores | Decay-penalized scores |
| 4 | OON Balance Scorer | Penalized scores | Final ranking scores |

#### 18 Predicted Behaviors

**Positive Signals (14):**
- Favorite (Like), Reply, Retweet, Quote
- Photo Expand, Click, Profile Click
- Video Quality View, Share, Share via DM, Share via Copy Link
- Dwell, Quoted Click, Follow Author

**Negative Signals (4):**
- Not Interested, Block Author, Mute Author, Report

### Language Support

- English
- 中文 (Chinese)

Toggle with the globe icon in the header.

### Related Links

- [X Algorithm Open Source](https://github.com/twitter/the-algorithm)

### License

MIT

---

<a name="中文"></a>

## 中文

一个完全交互式的 Web 模拟器，帮助理解 X（Twitter）的推荐算法。本项目可视化了从推文创建到排序的完整流程，基于 X 在 2026 年开源的算法实现。

### 项目背景

2026 年 1 月，X（原 Twitter）开源了他们的推荐算法。在深度阅读源码后，我们构建了这个模拟器，帮助大家理解：

- **推文如何被过滤** — 12 道过滤关卡决定什么不会被展示
- **推文如何被评分** — 18 种行为预测决定排序
- **权重如何影响排名** — 实时调整参数并查看效果

### 效果截图

> **注意：** 以下位置需要截图：

| 截图 | 说明 |
|------|------|
| `screenshot-analyzer.png` | 推文分析器，包含热度仪表盘和雷达图 |
| `screenshot-ranking.png` | 排序模拟器，展示管道执行过程 |
| `screenshot-weightlab.png` | 权重实验室，包含参数调节滑块 |

### 功能特性

#### 推文分析器

分析任意推文内容，预测其表现：

- **18 种行为预测** — 点赞、转发、回复、分享、关注、视频观看等
- **热度评分 (0-100)** — 可视化仪表盘展示推文潜力（低/中/高/爆款）
- **雷达图** — 一眼看清 14 种正向信号分布
- **优化建议** — AI 驱动的改进提示
- **过滤风险预警** — 提前知道推文是否可能被过滤
- **对比模式** — 多条推文并排分析

#### 排序模拟器

观看完整的推荐管道运行过程：

- **12 个过滤阶段** — 逐步观察候选推文如何被淘汰
- **4 个评分阶段** — Phoenix ML → 加权求和 → 多样性惩罚 → 内外网平衡
- **逐步动画** — 播放、暂停、控制管道执行
- **3 种场景** — 关注动态（80% 内网）、推荐（40% 内网）、热门（20% 内网）
- **详细统计** — 每个阶段的输入输出数量和推文详情

#### 权重实验室

实时试验排序参数：

- **18+ 权重滑块** — 调整所有正向和负向信号权重
- **实时更新** — 调整参数立即看到排序变化
- **多样性控制** — 调节作者多样性衰减和下限
- **内外网平衡** — 控制关注内容与推荐内容的比例
- **预设保存** — 保存和加载自定义权重配置

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/yourname/x-algorithm-simulator.git

# 进入项目目录
cd x-algorithm-simulator

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

启动后，在浏览器打开 `http://localhost:5173` 即可使用。

### 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 样式 | Tailwind CSS 4 |
| 图表 | Recharts |
| 动画 | Framer Motion |
| 路由 | React Router 7 |
| 国际化 | i18next |
| 图标 | Lucide React |
| 构建 | Vite 7 |

### 项目结构

```
src/
├── core/                    # 核心算法实现
│   ├── filters/             # 12 个过滤器实现
│   ├── scorers/             # 4 个评分器实现
│   ├── pipeline.ts          # 管道编排
│   └── types.ts             # TypeScript 类型定义
├── components/
│   ├── Layout/              # 应用框架和导航
│   ├── TweetAnalyzer/       # 推文分析模块
│   ├── RankingSimulator/    # 排序可视化
│   ├── WeightLab/           # 权重调整模块
│   ├── History/             # 历史记录管理
│   ├── shared/              # 共享 UI 组件
│   └── ui/                  # 基础 UI 原语 (shadcn/ui)
├── data/
│   ├── mockTweets.ts        # 模拟推文数据和场景
│   └── defaultWeights.ts    # 默认权重配置
├── hooks/
│   └── useI18n.tsx          # 国际化 Hook
├── utils/
│   ├── scoring.ts           # Phoenix 评分模拟
│   ├── snowflake.ts         # Snowflake ID 工具
│   └── storage.ts           # LocalStorage 封装
└── App.tsx                  # 主应用入口
```

### 算法实现

#### 过滤器（12 个阶段）

| # | 过滤器 | 说明 |
|---|--------|------|
| 1 | 去重过滤器 | 每个对话只保留第一条推文 |
| 2 | 时效过滤器 | 过滤超过 7 天的推文 |
| 3 | 自己推文过滤器 | 移除用户自己的推文 |
| 4 | 屏蔽作者过滤器 | 过滤被屏蔽用户的推文 |
| 5 | 静音作者过滤器 | 过滤被静音用户的推文 |
| 6 | 已看推文过滤器 | 过滤已查看的推文 |
| 7 | 敏感内容过滤器 | 通过关键词检测敏感内容 |
| 8 | 低质量过滤器 | 检测垃圾模式（过短、全大写等） |
| 9 | 深度回复过滤器 | 过滤深度嵌套回复（深度 > 3） |
| 10 | 已看转发过滤器 | 过滤原推文已看的转发 |
| 11 | 作者多样性预过滤器 | 限制每个作者最多 3 条推文 |
| 12 | 负面反馈过滤器 | 过滤高负面信号推文 |

#### 评分器（4 个阶段）

| # | 评分器 | 输入 | 输出 |
|---|--------|------|------|
| 1 | Phoenix ML 评分器 | 推文内容和元数据 | 18 种行为概率 |
| 2 | 加权求和评分器 | 18 种概率 + 权重 | 综合加权分数 |
| 3 | 作者多样性评分器 | 加权分数 | 衰减惩罚后分数 |
| 4 | 内外网平衡评分器 | 惩罚后分数 | 最终排序分数 |

#### 18 种预测行为

**正向信号（14 种）：**
- 点赞、回复、转发、引用
- 展开图片、点击、点击头像
- 看完视频、分享、私信分享、复制链接
- 停留、点击引用、关注作者

**负向信号（4 种）：**
- 不感兴趣、屏蔽作者、静音作者、举报

### 语言支持

- English（英文）
- 中文

点击顶部导航栏的地球图标切换语言。

### 相关链接

- [X 算法开源仓库](https://github.com/twitter/the-algorithm)

### 开源协议

MIT
