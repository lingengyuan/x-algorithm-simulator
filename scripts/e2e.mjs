import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'artifacts/e2e');
const downloads = await mkdtemp(resolve(tmpdir(), 'x-simulator-e2e-'));
await mkdir(output, { recursive: true });
const task = await taskSpace('X simulator upstream update 20261028');
const page = task.page('p1');
const report = { upstream: '5ed796374ea48ee26058aab66ab10c266bea2bef', browser: 'ego-browser', startedAt: new Date().toISOString(), checks: [], screenshots: [], traces: [] };
let language = 'en';
const label = (en, zh) => language === 'en' ? en : zh;
const check = (name, detail) => { report.checks.push({ name, status: 'passed', detail }); console.log(`PASS ${name}`); };
const button = (name) => `loc=role:button[name="${name}"]`;

async function goto(path) {
  await page.goto(`http://127.0.0.1:4173${path}`);
  await page.waitForSelector('header');
  await page.evaluate(() => {
    window.__e2eErrors = [];
    window.addEventListener('error', (event) => window.__e2eErrors.push(event.message));
    window.addEventListener('unhandledrejection', (event) => window.__e2eErrors.push(String(event.reason)));
  });
}

async function healthy() {
  assert.deepEqual(await page.evaluate(() => window.__e2eErrors), []);
  assert.equal(await page.evaluate(() => /\bNaN\b|\bInfinity\b/.test(document.body.innerText)), false);
}

async function shot(name) {
  const path = resolve(output, `${name}.png`);
  await page.screenshot({ path });
  report.screenshots.push(`${name}.png`);
}

async function selectScenario(name) {
  await page.click('[role="combobox"]');
  await page.click(`loc=role:listboxoption[name="${name}"]`);
  await page.waitForFunction(() => document.querySelector('[data-testid="pipeline-progress"]')?.dataset.step === 'candidate_pool');
}

async function completePipeline() {
  // Use the app's playback controls for the complete flow.
  await page.press('[role="slider"]', 'End');
  await page.click(button(label('Play', '播放')));
  await page.waitForFunction(() => document.querySelector('[data-testid="pipeline-progress"]')?.dataset.step === 'final_ranking', undefined, { timeout: 90000 });
  await page.waitForSelector('[data-testid="final-timeline"]');
  assert.equal(await page.evaluate(() => document.querySelector('[data-testid="pipeline-progress"]').dataset.step), 'final_ranking');
  await healthy();
}

async function exportTrace(name) {
  const pending = page.waitForEvent('download', { timeout: 30000 });
  await page.click('[data-testid="export-trace"]');
  const download = await pending;
  const path = resolve(downloads, `${name}.json`);
  await download.saveAs(path);
  const text = await readFile(path, 'utf8');
  const trace = JSON.parse(text);
  assert.equal(trace.upstream.commit, report.upstream);
  assert.equal(trace.result.steps.some((step) => step.id === 'ranking'), false);
  assert.equal(trace.result.steps.some((step) => step.id === 'brazil_2026_election'), false);
  assert.equal(new Set(trace.result.finalCandidates.map((candidate) => candidate.id)).size, trace.result.finalCandidates.length);
  assert(trace.result.finalFeedItems.length > 0);
  assert(trace.result.finalCandidates.every((candidate) => Number.isFinite(candidate.finalScore)));
  // Inputs permit replay. Keep stage counts and final outputs without repeated intermediate pools.
  const compact = JSON.stringify(trace, (key, value) =>
    ['allCandidates', 'passedCandidates', 'filteredCandidates'].includes(key) ? undefined : value);
  const artifact = gzipSync(compact);
  await writeFile(resolve(output, `${name}.json.gz`), artifact);
  report.traces.push({ file: `${name}.json.gz`, sha256: createHash('sha256').update(artifact).digest('hex'), bytes: artifact.length });
  return trace;
}

function verifyTraceScores(trace, fallback = false) {
  const w = trace.config.weights;
  assert.equal(w.favoriteWeight, 0.66);
  assert.equal(w.notInterestedWeight, -52.272);
  assert.equal(w.clickDwellTimeWeight, 0.4);
  assert.equal(w.coldStartImpressionThreshold, 200);
  for (const candidate of trace.result.finalCandidates) {
    const multiplier = fallback ? 1 : (candidate.diversityAdjustedScore / candidate.coldStartAdjustedScore);
    if (fallback) {
      assert.equal(candidate.finalScore, candidate.coldStartAdjustedScore);
    } else if (candidate.finalScore !== 0) {
      const oon = candidate.inNetwork === false || (candidate.inNetwork && (candidate.inReplyToTweetId || candidate.originalTweetId));
      const factor = oon ? (trace.context.topicIds.length ? 0.5 : 0.75) : 1;
      assert(Math.abs(candidate.finalScore - candidate.coldStartAdjustedScore * multiplier * factor) < 1e-9);
    }
  }
}

try {
  console.log(`TaskSpace ${task.spaceId}`);
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await goto('/');
  const isChinese = await page.evaluate(() => document.body.innerText.includes('切换到中文') ? false : Boolean(document.querySelector('button[aria-label="Switch to English"]')));
  if (isChinese) await page.click(button('Switch to English'));

  for (const lang of ['en', 'zh']) {
    language = lang;
    if (lang === 'zh') await page.click(button('切换到中文'));
    await goto('/');
    await page.fill('textarea', label('E2E: How do recommendation sources affect the feed?', '端到端测试：推荐来源如何影响首页内容？'));
    await page.click(button(label('Video', '视频')));
    await page.click('[data-testid="analyzer-submit"]');
    await page.waitForSelector('[data-testid="continuous-phoenix-outputs"]');
    const continuous = await page.evaluate(() => document.querySelector('[data-testid="continuous-phoenix-outputs"]').innerText);
    assert(continuous.includes(label('Home Video Continuation', '首页视频续看时长')));
    assert(continuous.includes(label('Disabled / not returned', '未启用 / 未返回')));
    assert.equal(continuous.includes('Residual'), false);
    await healthy();
    await shot(`analyzer-${lang}`);
    check(`analyzer-${lang}`, 'Video fixture outputs and disabled excursion fields render without NaN.');

    await page.click(button(label('Compare Mode', '对比模式')));
    await page.waitForFunction(() => document.querySelectorAll('textarea').length === 2);
    await page.fill('textarea >> nth=0', label('First comparison input', '第一条对比内容'));
    await page.waitForFunction(() => document.querySelectorAll('textarea')[0].value.length > 0);
    await page.fill('textarea >> nth=1', label('Second comparison input with a question?', '第二条对比内容，有什么不同？'));
    await page.click(button(label('Generate Fixture Outputs', '生成测试输出')));
    await page.waitForSelector('table');
    await healthy();
    check(`compare-${lang}`, 'Both inputs render a comparison table with missing gated fields.');

    await goto('/weights');
    const favorite = '[data-weight="favoriteWeight"] [role="slider"]';
    const clickDwell = '[data-weight="clickDwellTimeWeight"] [role="slider"]';
    assert.equal(Number(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-valuenow'), favorite)), 0.66);
    assert.equal(Number(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-valuenow'), clickDwell)), 0.4);
    await page.press(favorite, 'ArrowRight');
    assert.equal(Number(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-valuenow'), favorite)), 0.67);
    await shot(`weights-adjusted-${lang}`);
    await page.click(button(label('Reset to Default', '恢复默认')));
    assert.equal(Number(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-valuenow'), favorite)), 0.66);
    await healthy();
    await shot(`weights-default-${lang}`);
    check(`weights-${lang}`, 'Defaults, keyboard adjustment, and reset use current Home Mixer weights.');

    await goto('/history');
    assert((await page.evaluate(() => document.body.innerText)).includes(label('E2E:', '端到端测试：')));
    await shot(`history-${lang}`);
    check(`history-${lang}`, 'Generated analysis remains available after route navigation.');

    await goto('/simulator');
    await page.click(button(label('Play', '播放')));
    await page.waitForFunction(() => document.querySelector('[data-testid="pipeline-progress"]').dataset.step !== 'candidate_pool');
    await page.click(button(label('Pause', '暂停')));
    await page.click(button(label('Previous step', '上一步')));
    await completePipeline();
    const trace = await exportTrace(`for-you-${lang}`);
    verifyTraceScores(trace);
    assert(trace.result.steps.find((step) => step.id === 'source_popular_posts').outputCount > 0);
    assert(trace.result.finalFeedItems.some((item) => item.type === 'ad'));
    assert(trace.result.finalFeedItems.some((item) => item.type === 'who_to_follow'));
    assert(trace.result.steps.find((step) => step.id === 'vm_ranker').details.summary.dppEnabled);
    assert(trace.result.finalCandidates.some((candidate) => candidate.retrievalSources.length > 1));
    await shot(`for-you-${lang}`);
    check(`for-you-${lang}`, 'Playback, back, popular retrieval, merged provenance, VM scoring, DPP, and blending pass.');

    await page.click(`[role="switch"][aria-label="${label('VMRanker service available', 'VMRanker 服务可用')}"]`);
    await completePipeline();
    const fallback = await exportTrace(`fallback-${lang}`);
    verifyTraceScores(fallback, true);
    assert.equal(fallback.result.steps.find((step) => step.id === 'vm_ranker').details.summary.dppEnabled, false);
    check(`fallback-${lang}`, 'RPC failure uses local fusion/cold-start without VM multipliers or DPP.');
    await page.click(`[role="switch"][aria-label="${label('VMRanker service available', 'VMRanker 服务可用')}"]`);

    await selectScenario(label('Topic request', '话题请求'));
    await completePipeline();
    const topic = await exportTrace(`topic-${lang}`);
    verifyTraceScores(topic);
    assert.equal(topic.result.steps.find((step) => step.id === 'vm_ranker').details.summary.dppEnabled, false);
    assert(topic.result.finalCandidates.every((candidate) => !candidate.coldStartBoosted));
    check(`topic-${lang}`, 'Topic requests skip DPP and cold-start while applying topic scoring.');
  }

  await selectScenario('关注内排序');
  await completePipeline();
  const following = await exportTrace('ranked-following');
  assert(following.result.finalCandidates.every((candidate) => candidate.inNetwork));
  assert.equal(following.result.steps.find((step) => step.id === 'source_popular_posts').outputCount, 0);
  check('ranked-following', 'Only followed-account retrieval contributes candidates.');

  await selectScenario('缓存帖子');
  await completePipeline();
  const cached = await exportTrace('cached');
  assert(cached.context.cachedPostIds.length >= 500);
  assert.equal(cached.result.steps.some((step) => step.id === 'phoenix'), false);
  assert.equal(cached.result.steps.find((step) => step.id === 'source_popular_posts').outputCount, 0);
  check('cached', 'Cached inventory skips Phoenix inference and remote sources.');

  await selectScenario('排除视频');
  await completePipeline();
  const noVideos = await exportTrace('without-videos');
  assert(noVideos.result.finalCandidates.every((candidate) => candidate.videoDurationMs === undefined && candidate.quotedVideoDurationMs === undefined && !candidate.ancestorHasVideo));
  check('exclude-videos', 'Direct, quoted, and displayed ancestor videos do not reach the final feed.');

  await selectScenario('来源预算（3,500 帖子）');
  await completePipeline();
  const budget = await page.evaluate(() => {
    const step = document.querySelector('[data-step-id="fair_share_ranking"]');
    const counts = (items) => items.reduce((all, source) => ({ ...all, [source]: (all[source] || 0) + 1 }), {});
    return { input: Number(step.dataset.inputCount), output: Number(step.dataset.outputCount),
      kept: counts(JSON.parse(step.dataset.keptSources)), removed: counts(JSON.parse(step.dataset.removedSources)) };
  });
  assert(budget.input > 2800);
  assert.equal(budget.output, 2800);
  for (const [source, kept] of Object.entries(budget.kept)) {
    const expected = (kept + (budget.removed[source] || 0)) / budget.input * 2800;
    assert(Math.abs(kept - expected) < 1);
  }
  await shot('source-budget');
  check('source-budget', budget);

  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await goto('/');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('header nav a')].every((a) => a.getAttribute('aria-label'))), true);
  await shot('mobile');
  check('mobile', 'The 390px layout fits the viewport and navigation has accessible names.');

  report.status = 'passed';
  report.completedAt = new Date().toISOString();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await rm(resolve(output, 'failure.png'), { force: true });
  await rm(downloads, { recursive: true, force: true });
  console.log(await page.snapshot());
  await task.finish({ keep: [] });
  console.log(`E2E passed: ${report.checks.length} checks. Report: ${resolve(output, 'report.json')}`);
} catch (error) {
  report.status = 'failed';
  report.error = String(error.stack || error);
  await shot('failure').catch(() => {});
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(await page.snapshot().catch(() => 'Snapshot unavailable'));
  throw error;
}
