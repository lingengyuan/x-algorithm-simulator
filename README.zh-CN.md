# X 算法模拟器

用于理解 X 公开推荐流程的交互式模拟器。

固定在 [`xai-org/x-algorithm@cec6168`](https://github.com/xai-org/x-algorithm/tree/cec61682937a4899360a340acba9e9b9bb8f43e3) · [English](README.md)

## 项目说明

项目在确定性本地测试数据上可视化公开的主默认路径，不能预测生产环境的真实曝光或互动。

覆盖已公开的召回、过滤、评分和排序阶段，以及仅基于本地数据的混排。项目不运行模型训练与推理、远端召回与 hydration、生产广告投放和通知过滤。

## 界面对比

下表截图来自最近一次完整端到端测试。更多截图、报告和流程记录见 [`artifacts/e2e`](artifacts/e2e)。

| 页面 | 之前 | 当前 |
| --- | --- | --- |
| 输出探索 | <img src="docs/screenshots/before-analyzer-zh.jpg" alt="输出探索之前" width="420"> | <img src="artifacts/e2e/analyzer-zh.png" alt="输出探索当前" width="420"> |
| 排序模拟 | <img src="docs/screenshots/before-simulator-zh.jpg" alt="排序模拟之前" width="420"> | <img src="artifacts/e2e/for-you-zh.png" alt="排序模拟当前" width="420"> |

## 功能特性

- 逐步查看召回、过滤、评分、排序和混排阶段。
- 展开排序后的帖子，查看最多三项加权贡献，每项绝对值占比不低于 10%。
- 查看 29 个 Phoenix 输出头，以及排序权重、过滤、可见性、品牌安全和 VMRanker DPP。
- 切换中英文界面。

## 环境要求

- Node.js `^20.19.0 || >=22.12.0` 和 npm，这是 Vite 7 的要求。
- 端到端测试需要 ego lite 和 `ego-browser` CLI。

项目不需要环境变量、凭据或外部服务。

## 快速开始

```bash
git clone https://github.com/lingengyuan/x-algorithm-simulator.git
cd x-algorithm-simulator
npm install
npm run dev
```

打开 `http://localhost:5173`。

## 页面入口

| 路径 | 页面 |
| --- | --- |
| `/` | 输出探索：在本地测试数据上查看 29 个 Phoenix 输出头 |
| `/simulator` | 排序模拟：查看流水线各阶段和最终 feed |
| `/weights` | 权重实验室：对比测试输出并调节权重 |
| `/history` | 保存在浏览器中的分析历史 |

## 项目结构

| 文件 | 内容 |
| --- | --- |
| [`src/data/upstreamSnapshot.ts`](src/data/upstreamSnapshot.ts) | 固定的上游提交和公开默认参数 |
| [`src/core/pipeline.ts`](src/core/pipeline.ts) | 召回、过滤、评分、排序和混排路径 |
| [`src/core/feed.ts`](src/core/feed.ts) | `slot_spread` 广告混排、品牌安全和信息流模块 |
| [`scripts/e2e.mjs`](scripts/e2e.mjs) | 端到端检查、截图采集和流程导出 |

## 模拟范围

- 默认广告混排为 `slot_spread`：预留间隔广告位，为每个广告选取最近的兼容帖子，再按页容量截断。
- 固定版本中 `rust_home_mixer_ads_bs_v2_exp_enabled` 为 `false`，品牌安全判定使用 legacy 路径。
- `post_video` 和 `grok_analyze` 权重保持 `0.0`，视频轮播及其 CTR 模型关闭。
- 首页扩展行为头（视频续看和主页访问）会返回，融合权重保持 `0.0`。VMRanker 的帖子话题和最近浏览输入默认关闭，因为 `rust_home_mixer_vm_ranker_send_post_topics` 为 `false`。
- 公开仓库不含 `xai_post_text`，本地多语言分词可能与生产环境不一致。

## 开发与测试

运行 ESLint、TypeScript、生产构建和 ego-browser 端到端测试：

```bash
npm run check
```

测试脚本在 `4173` 端口启动预览服务。结果、截图和压缩流程记录（`.json.gz`）写入 `artifacts/e2e/`。每条记录包含候选输入、请求上下文和权重。

只跑端到端测试用 `npm run test:e2e`，只跑 DOM 恢复场景用 `npm run test:dom-recovery`。

## 维护指南

快照和实现同步更新，上游变更固定到具体提交。修改流水线时保持以下行为：

- 默认路径在 VMRanker 中复用 Home Mixer 加权分。
- 话题请求跳过 DPP。
- 远端召回、向量和 Thompson 抽样使用可重复的本地测试数据。

上游提交由 [`monitor-upstream`](.github/workflows/monitor-upstream.yml) 工作流每天检查。

## 许可证

[MIT](LICENSE)
