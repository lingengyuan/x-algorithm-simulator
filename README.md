# X Algorithm Simulator

An interactive, deterministic simulator for studying the public X recommendation algorithm.

用于理解 X 公开推荐算法的交互式确定性模拟器。

[English](#english) · [简体中文](#简体中文)

## English

### Project Description

The simulator is pinned to [`xai-org/x-algorithm@c65aa17`](https://github.com/xai-org/x-algorithm/tree/c65aa179db7bdd61e2c2821eac87f208a105c053), released on 2026-08-14. Production experiments can override published defaults; this project models only the public primary default path at that commit.

It is an educational simulator, not a production recommender, and it cannot predict real reach or engagement.

### Features

- Scored Posts: 17 Query Hydrators, 7 Candidate Sources, 12 Candidate Hydrators, 18 pre-scoring Filters, PhoenixScorer, RankingScorer, VMRanker DPP, TopK 50, 6 post-selection Hydrators, 3 post-selection Filters, a final result size of 35, and 8 registered Side Effects.
- Ranking: 26 Phoenix output heads, published default weights, VQV duration gating, negative-score offset, author cold start, author diversity, out-of-network rescoring, and DPP selection.
- For You: 2 Query Hydrators, 7 Sources, PushToHome deduplication, `PartitionOrganicAdsBlender`, feed-module insertion order, and 9 registered Side Effects.
- Safety: published Visibility Filtering rules with allow/interstitial/drop outcomes, ancillary-post evaluation, ad brand-safety verdicts, and adjacent-content constraints.
- Interface: Tweet Analyzer, Ranking Simulator, Weight Lab, and local History views in English and Simplified Chinese.

Primary upstream references:

- [Scored Posts pipeline](https://github.com/xai-org/x-algorithm/blob/c65aa179db7bdd61e2c2821eac87f208a105c053/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs)
- [RankingScorer](https://github.com/xai-org/x-algorithm/blob/c65aa179db7bdd61e2c2821eac87f208a105c053/home-mixer/scorers/ranking_scorer.rs)
- [AuthorColdStart](https://github.com/xai-org/x-algorithm/blob/c65aa179db7bdd61e2c2821eac87f208a105c053/home-mixer/scorers/author_cold_start.rs)
- [VMRanker DPP](https://github.com/xai-org/x-algorithm/blob/c65aa179db7bdd61e2c2821eac87f208a105c053/vm-ranker/dpp.rs)
- [For You pipeline](https://github.com/xai-org/x-algorithm/blob/c65aa179db7bdd61e2c2821eac87f208a105c053/home-mixer/candidate_pipeline/for_you_candidate_pipeline.rs)

### Explicit Boundaries

- Phoenix outputs are deterministic local fixtures; no production model is called.
- Candidate retrieval, social graph, user features, visibility services, and ads use explicit local fixtures. Missing data is not inferred from unrelated fields.
- Muted-keyword and ad-keyword matching use a deterministic local tokenizer. The public repository does not include the `xai_post_text` implementation, so Unicode and multilingual tokenization are not guaranteed to match production.
- The cached path starts at the published 500-post threshold. Cached, seen, impressed, and served IDs remain independent.
- DPP follows the public algorithm but uses local fixture vectors; missing vectors receive deterministic fallback vectors for reproducibility.
- Side Effects show registered integration points and item counts; they do not claim that external writes ran.
- Default-off or experimental branches such as TweetMixer, Phoenix MoE, MPN, and dwell-regret are registered as unsupported rather than replaced with fabricated output.

### Quick Start

Prerequisites: Node.js and npm.

```bash
npm install
npm run dev
```

Open the local address printed by Vite.

### Skill Catalog

This repository does not package Codex skills. Its user-facing areas are:

- `/` — Tweet Analyzer
- `/simulator` — Ranking Simulator
- `/weights` — Weight Lab
- `/history` — local analysis History

### Project Structure

```text
src/data/upstreamSnapshot.ts    pinned commit, public defaults, component gates
src/data/upstreamPolicyData.ts  public Topic taxonomy and Brazil election list
src/core/pipeline.ts            Scored Posts and For You execution trace
src/core/filters/               pre-scoring and post-selection filters
src/core/scorers/               ranking, cold start, diversity, OON, and DPP
src/core/visibility.ts          visibility rules and three-state outcomes
src/core/feed.ts                brand safety and final feed blending
src/core/tweetTypeMetrics.ts    public TweetTypeMetrics bitset encoding
src/core/upstreamParity.test.ts executable upstream parity regression suite
```

### Configuration

No environment variables, credentials, or external services are required. Published defaults live in `src/data/upstreamSnapshot.ts`; simulator inputs live in explicit local fixtures.

### Development and Testing

```bash
npm run lint     # ESLint
npm run test     # Vitest upstream parity suite
npm run build    # TypeScript and production Vite build
npm run check    # lint + test + build
npm run preview  # preview an existing production build
```

### Contributing

Keep behavior tied to a pinned upstream commit, add a regression test for every behavior change, and document any boundary that cannot be verified from the public repository.

### Maintenance Guide

1. Pin the new upstream commit instead of following a floating branch.
2. Compare component names, order, gates, types, constants, and algorithm behavior.
3. Update `upstreamSnapshot.ts`, public policy data, and the affected implementation.
4. Add or update parity tests for every behavior change.
5. Run `npm run check`, then perform Standards and Spec reviews.

### License

[MIT](LICENSE)

## 简体中文

### 项目说明

模拟器固定对齐 2026-08-14 发布的 [`xai-org/x-algorithm@c65aa17`](https://github.com/xai-org/x-algorithm/tree/c65aa179db7bdd61e2c2821eac87f208a105c053)。生产实验可能覆盖公开默认值；本项目只模拟该提交公开的主默认路径。

这是学习用模拟器，不是生产推荐器，也不能预测真实曝光或互动。

### 功能特性

- Scored Posts：17 个 Query Hydrator、7 个 Candidate Source、12 个 Candidate Hydrator、18 个预评分 Filter、PhoenixScorer、RankingScorer、VMRanker DPP、TopK 50、6 个后选择 Hydrator、3 个后选择 Filter、最终 35 条结果和 8 个 Side Effect 登记点。
- 排序：26 个 Phoenix 输出头、公开默认权重、VQV 时长门控、负分偏移、作者冷启动、作者多样性、关注外重评分和 DPP 选择。
- For You：2 个 Query Hydrator、7 个 Source、PushToHome 去重、`PartitionOrganicAdsBlender`、模块插入顺序和 9 个 Side Effect 登记点。
- 安全：公开的 Visibility Filtering 规则、allow/interstitial/drop 三态结果、关联帖评估、广告品牌安全 verdict 和相邻内容约束。
- 界面：提供中英文 Tweet Analyzer、Ranking Simulator、Weight Lab 和本地 History 页面。

主要上游依据：

- [Scored Posts pipeline](https://github.com/xai-org/x-algorithm/blob/c65aa179db7bdd61e2c2821eac87f208a105c053/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs)
- [RankingScorer](https://github.com/xai-org/x-algorithm/blob/c65aa179db7bdd61e2c2821eac87f208a105c053/home-mixer/scorers/ranking_scorer.rs)
- [AuthorColdStart](https://github.com/xai-org/x-algorithm/blob/c65aa179db7bdd61e2c2821eac87f208a105c053/home-mixer/scorers/author_cold_start.rs)
- [VMRanker DPP](https://github.com/xai-org/x-algorithm/blob/c65aa179db7bdd61e2c2821eac87f208a105c053/vm-ranker/dpp.rs)
- [For You pipeline](https://github.com/xai-org/x-algorithm/blob/c65aa179db7bdd61e2c2821eac87f208a105c053/home-mixer/candidate_pipeline/for_you_candidate_pipeline.rs)

### 明确边界

- Phoenix 输出值来自确定性本地测试数据；没有调用生产模型。
- 候选召回、社交图、用户特征、可见性服务和广告等外部输入均来自显式本地测试数据；缺失数据不会由无关字段猜测。
- MutedKeyword 与广告关键词使用本地确定性 tokenizer；公开仓库未包含 `xai_post_text` 实现，因此 Unicode 和多语言分词边界不保证与生产环境等价。
- 缓存分支按公开的 500 条最低阈值触发；缓存候选、已看、已曝光和已下发 ID 相互独立。
- DPP 算法与公开实现一致，但使用本地测试向量；缺失向量时使用确定性替代向量，便于复现。
- Side Effect 只展示公开登记点和流经该阶段的条目数，不把外部写入标成已执行。
- 未实现默认关闭或实验分支，例如 TweetMixer、Phoenix MoE、MPN 和 dwell-regret；界面只登记这些组件，不用本地候选伪造其输出。

### 快速开始

前置条件：Node.js 和 npm。

```bash
npm install
npm run dev
```

打开 Vite 输出的本地地址。

### 技能目录

本仓库不提供 Codex Skill。面向用户的功能入口是：

- `/` — Tweet Analyzer
- `/simulator` — Ranking Simulator
- `/weights` — Weight Lab
- `/history` — 本地分析 History

### 项目结构

```text
src/data/upstreamSnapshot.ts    固定提交、公开默认参数和组件门控
src/data/upstreamPolicyData.ts  公开 Topic taxonomy 和 Brazil election 名单
src/core/pipeline.ts            Scored Posts 与 For You 执行轨迹
src/core/filters/               预评分与后选择过滤器
src/core/scorers/               排序、冷启动、多样性、OON 和 DPP
src/core/visibility.ts          可见性规则与三态结果
src/core/feed.ts                品牌安全和最终 feed 混排
src/core/tweetTypeMetrics.ts    公开 TweetTypeMetrics bitset 编码
src/core/upstreamParity.test.ts 可执行的上游一致性回归测试
```

### 配置

项目不需要环境变量、凭据或外部服务。公开默认值位于 `src/data/upstreamSnapshot.ts`，模拟输入来自显式本地测试数据。

### 开发与测试

```bash
npm run lint     # ESLint
npm run test     # Vitest 上游一致性测试
npm run build    # TypeScript 与 Vite 生产构建
npm run check    # lint + test + build
npm run preview  # 预览已有生产构建
```

### 贡献指南

行为必须绑定固定上游提交；每项行为变更都要补回归测试；无法从公开仓库验证的边界必须写入文档。

### 维护指南

1. 固定新的上游 commit，不直接跟随浮动分支。
2. 对比组件名称、顺序、门控、类型、常量和算法行为。
3. 更新 `upstreamSnapshot.ts`、公开 policy 数据和对应实现。
4. 为每项行为变化添加或更新一致性测试。
5. 运行 `npm run check`，再做 Standards 与 Spec 审查。

### 许可证

[MIT](LICENSE)
