# X Algorithm Simulator

Interactive simulator for the public X recommendation pipeline.

Pinned to [`xai-org/x-algorithm@3b6919f`](https://github.com/xai-org/x-algorithm/tree/3b6919f87532e57063bb3f1e85c2f509323b513e) · [简体中文](README.zh-CN.md)

## Overview

The simulator visualizes the published primary default path at upstream commit `3b6919f`. It runs on deterministic local fixtures, so it cannot predict production reach or engagement.

It covers the published source, filter, scoring, ranking, and fixture-only feed blending path. It does not run model training or inference, remote retrieval and hydration services, production ad delivery, or notification filtering.

## Screenshots

Screenshots below are generated from this version by the E2E run.

| Page | Before | Current |
| --- | --- | --- |
| Output Explorer | <img src="docs/screenshots/before-analyzer-en.jpg" alt="Output Explorer before" width="420"> | <img src="artifacts/e2e/analyzer-en.png" alt="Output Explorer current" width="420"> |
| Ranking Simulator | <img src="docs/screenshots/before-simulator-en.jpg" alt="Ranking Simulator before" width="420"> | <img src="artifacts/e2e/for-you-en.png" alt="Ranking Simulator current" width="420"> |

More screenshots and the E2E report are in [`artifacts/e2e`](artifacts/e2e).

## Features

- Step through the Scored Posts and For You pipelines.
- Expand a ranked post to see up to three weighted contributions, each with an absolute share of at least 10%.
- Inspect the 29 default Phoenix output weights, ranking weights, filters, visibility, brand safety, and VMRanker DPP.
- Compare fixture outputs, tune weights live, and keep local history in English or Chinese.

## Requirements

- Node.js `^20.19.0 || >=22.12.0` and npm, as required by Vite 7.
- ego lite and the `ego-browser` CLI for the end-to-end tests.

No environment variables, credentials, or external services are required.

## Quick Start

```bash
git clone https://github.com/lingengyuan/x-algorithm-simulator.git
cd x-algorithm-simulator
npm install
npm run dev
```

## Routes

| Path | Page |
| --- | --- |
| `/` | Output Explorer: 29 Phoenix output weights on local fixtures |
| `/simulator` | Ranking Simulator: pipeline walkthrough and final feed |
| `/weights` | Weight Lab: compare fixtures and tune weights |
| `/history` | Analysis history stored in the browser |

## Project Structure

| File | Contents |
| --- | --- |
| [`src/data/upstreamSnapshot.ts`](src/data/upstreamSnapshot.ts) | Pinned commit and upstream defaults |
| [`src/core/pipeline.ts`](src/core/pipeline.ts) | Source, filter, scoring, and ranking path |
| [`scripts/e2e.mjs`](scripts/e2e.mjs) | End-to-end checks and screenshot capture |

## Simulator Scope

The default ad blender is `multi_risk`. It groups compatible ad neighbours by risk, distributes the remaining posts between groups, and truncates the page.

Brand-safety verdicts use the legacy published path, because `rust_home_mixer_ads_bs_v2_exp_enabled` is `false` at this commit.

The `post_video` and `grok_analyze` weights stay at `0.0`, and the video carousel is disabled by the pinned defaults. Home excursion heads are returned, and their fusion weights stay at `0.0`. The carousel CTR model and seen filter are off.

The public repository omits `xai_post_text`, so local multilingual tokenization is not guaranteed to match production.

## Development and Testing

```bash
npm run check
```

This runs ESLint, TypeScript, the production build, and the ego-browser E2E suite. The E2E runner starts a preview server on port `4173`.

Results, screenshots, and compressed pipeline traces (`.json.gz`) go to `artifacts/e2e/`. Each trace records the input fixtures, the request context, and the weights.

Run the E2E suite alone with `npm run test:e2e`, or the DOM recovery scenario with `npm run test:dom-recovery`.

## Contributing

Pin upstream changes to a specific commit. Verify behavior through the browser E2E flow.

## Maintenance

Update the snapshot and the implementation together, then run `npm run check`.

Keep these behaviors when changing the pipeline:

- The default path reuses Home Mixer weighted scores in VMRanker.
- Topic requests skip DPP.
- Remote retrieval, embeddings, and Thompson draws use repeatable local fixtures.

## Upstream Monitor

[Monitor X upstream](https://github.com/lingengyuan/x-algorithm-simulator/actions/workflows/monitor-upstream.yml) runs daily at 09:00 Beijing time on GitHub Actions. It reads the pinned commit from `src/data/upstreamSnapshot.ts`.

When upstream has a new commit, the workflow opens one Issue assigned to the repository owner. Closed Issues also block duplicate reminders. GitHub sends notifications according to your [notification settings](https://github.com/settings/notifications).

The Issue links to the diff and contains a request you can send to your development assistant. Adaptation starts only when you send that request. The monitor needs no extra secrets.

To check immediately, select **Run workflow**. Enable **verify_notifications** to create and close a test Issue. The run saves a JSON report as the `upstream-monitor-e2e` artifact.

GitHub can delay scheduled runs, and it disables schedules in public repositories after 60 days without activity. Re-enable the workflow on its Actions page.

## License

[MIT](LICENSE)
