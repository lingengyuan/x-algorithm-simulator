import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { verifyBudgetTrace } from './e2e-budget-assertions.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const options = new URL(import.meta.url).searchParams;
const budgetOnly = options.has('source-budget');
const output = budgetOnly
  ? resolve(root, 'artifacts/source-budget-check', options.get('run') || String(Date.now()))
  : resolve(root, 'artifacts/e2e');
const downloads = await mkdtemp(resolve(tmpdir(), 'x-simulator-e2e-'));
await mkdir(output, { recursive: true });
const task = await taskSpace(options.has('space') ? Number(options.get('space')) : `X simulator E2E ${options.get('run') || Date.now()}`);
const page = task.page('p1');
const report = { runId: options.get('run'), status: 'running', upstream: '590f3926e5bc33c50d9ece13953623e1e75ee595', browser: 'ego-browser', startedAt: new Date().toISOString(), checks: [], screenshots: [], traces: [] };
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
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('[data-testid="app-error"]'))), false, 'React error boundary is visible');
  assert.deepEqual(await page.evaluate(() => window.__e2eErrors), []);
  assert.equal(await page.evaluate(() => /\bNaN\b|\bInfinity\b/.test(document.body.innerText)), false);
  const collisions = await page.evaluate(() => {
    const pairs = [
      ['.post-author-line', '.post-author-name', '.post-time'],
      ['.score-row-label', 'span:first-child', '.score-row-value'],
      ['.pipeline-step-main', '.pipeline-step-name', '.pipeline-step-metric'],
      ['.post-scores', 'dt', 'dd'],
    ];
    const failures = [];
    for (const [root, first, second] of pairs) for (const row of document.querySelectorAll(root)) {
      const left = [...row.querySelectorAll(first)];
      const right = [...row.querySelectorAll(second)];
      for (let index = 0; index < Math.min(left.length, right.length); index++) {
        const a = left[index].getBoundingClientRect();
        const b = right[index].getBoundingClientRect();
        if (a.width && b.width && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) failures.push(left[index].textContent);
      }
    }
    for (const button of document.querySelectorAll('.media-options .button')) {
      const rect = button.getBoundingClientRect();
      const parent = button.parentElement.getBoundingClientRect();
      if (rect.right > parent.right + 1 || rect.left < parent.left - 1) failures.push('Media control exceeds its panel');
    }
    for (const field of document.querySelectorAll('.simulator-heading .select-trigger')) {
      if (field.getBoundingClientRect().width < 120) failures.push('Scenario field collapsed below a readable width');
    }
    return failures;
  });
  assert.deepEqual(collisions, [], 'Text labels overlap adjacent values');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Page has horizontal overflow');
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

async function checkLegacyWeightPresets() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const names = { legacy: `E2E legacy ${suffix}`, both: `E2E both ${suffix}`, saved: `E2E saved ${suffix}` };
  await page.evaluate((names) => {
    const key = 'x-simulator-weights';
    const presets = JSON.parse(localStorage.getItem(key) || '{}');
    presets[names.legacy] = { reactWithVideoWeight: 1.25 };
    presets[names.both] = { reactWithVideoWeight: 1.25, postVideoWeight: 2.5 };
    localStorage.setItem(key, JSON.stringify(presets));
  }, names);
  try {
    await goto('/weights');
    const slider = '[data-weight="postVideoWeight"] [role="slider"]';
    const load = async (name, expected) => {
      await page.click('[role="combobox"]');
      await page.click(`loc=role:listboxoption[name="${name}"]`);
      await page.waitForFunction(({ selector, value }) => Number(document.querySelector(selector)?.getAttribute('aria-valuenow')) === value, { selector: slider, value: expected });
    };
    await load(names.legacy, 1.25);
    await load(names.both, 2.5);
    await load(names.legacy, 1.25);
    await page.press(slider, 'ArrowRight');
    assert.equal(Number(await page.evaluate((selector) => document.querySelector(selector).getAttribute('aria-valuenow'), slider)), 1.26);
    await page.click(button('Save Preset'));
    await page.fill('input[placeholder]', names.saved);
    await page.click(button('Save'));
    const saved = await page.evaluate((name) => JSON.parse(localStorage.getItem('x-simulator-weights'))[name], names.saved);
    assert.equal(saved.postVideoWeight, 1.26);
    assert.equal('reactWithVideoWeight' in saved, false);
    await shot('legacy-weight-preset');
    check('legacy-weight-preset', 'Legacy value loads, the new key takes precedence, and saving removes the legacy key.');
  } finally {
    await page.evaluate((names) => {
      const key = 'x-simulator-weights';
      const presets = JSON.parse(localStorage.getItem(key) || '{}');
      for (const name of Object.values(names)) delete presets[name];
      if (Object.keys(presets).length) localStorage.setItem(key, JSON.stringify(presets));
      else localStorage.removeItem(key);
    }, names);
  }
}

async function completePipeline() {
  // Use the app's playback controls for the complete flow.
  await page.press('[role="slider"]', 'End');
  await page.click('[data-testid="playback-toggle"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="pipeline-progress"]')?.dataset.step === 'final_ranking', undefined, { timeout: 90000 });
  await page.waitForSelector('[data-testid="final-timeline"]');
  await healthy();
}

async function exportTrace(name) {
  const started = Date.now();
  const pending = page.waitForEvent('download', { timeout: 180000 }).then((download) => ({ download, eventMs: Date.now() - started }));
  await page.click('[data-testid="export-trace"]');
  const clickMs = Date.now() - started;
  const { download, eventMs } = await pending;
  const path = resolve(downloads, `${name}.json`);
  const saveStarted = Date.now();
  await download.saveAs(path);
  const saveMs = Date.now() - saveStarted;
  const raw = await readFile(path);
  const trace = JSON.parse(raw.toString('utf8'));
  assert.equal(trace.upstream.commit, report.upstream);
  assert(Number.isFinite(Date.parse(trace.upstream.paramsSyncedAt)));
  assert.equal(trace.upstream.paramsSyncedAt, '2026-11-12T16:00:36Z');
  assert.equal(trace.config.weights.postVideoWeight, 0);
  assert.equal(trace.config.weights.grokAnalyzeWeight, 0);
  assert.equal('reactWithVideoWeight' in trace.config.weights, false);
  assert(trace.rawCandidates.some((candidate) => Number.isFinite(candidate.phoenixScores.postVideoScore)));
  assert(trace.rawCandidates.some((candidate) => Number.isFinite(candidate.phoenixScores.grokAnalyzeScore)));
  assert(trace.rawCandidates.every((candidate) =>
    Number.isFinite(candidate.phoenixScores.homeVideoContinuationSecs) &&
    Number.isFinite(candidate.phoenixScores.homeProfileVisitSecs)));
  assert(trace.rawCandidates.some((candidate) => candidate.phoenixScores.homeVideoContinuationSecs > 0));
  assert(trace.rawCandidates.some((candidate) => candidate.phoenixScores.homeProfileVisitSecs > 0));
  assert.equal(trace.config.weights.videoOpenWeight, 0);
  const phoenixStep = trace.result.steps.find((step) => step.id === 'phoenix');
  if (phoenixStep) {
    assert.equal(phoenixStep.details.summary.outputHeadCount, 29);
    assert.equal(phoenixStep.details.summary.outputContractHeadCount, 29);
    assert.equal(phoenixStep.details.summary.phoenixAggregationType, 'DENSE_WITH_LONG_DWELL_HOME_EXCURSION');
  }
  assert(trace.rawCandidates.every((candidate) => !('reactWithVideoScore' in candidate.phoenixScores)));
  assert.equal(trace.result.steps.some((step) => step.id === 'ranking'), false);
  assert.equal(trace.result.steps.some((step) => step.id === 'brazil_2026_election'), false);
  assert.equal(new Set(trace.result.finalCandidates.map((candidate) => candidate.id)).size, trace.result.finalCandidates.length);
  assert(trace.result.finalFeedItems.length > 0);
  assert(trace.result.finalCandidates.every((candidate) => Number.isFinite(candidate.finalScore)));
  const artifact = gzipSync(raw);
  await writeFile(resolve(output, `${name}.json.gz`), artifact);
  report.traces.push({ file: `${name}.json.gz`, sha256: createHash('sha256').update(artifact).digest('hex'), bytes: artifact.length,
    rawBytes: raw.length, rawSha256: createHash('sha256').update(raw).digest('hex'),
    timingsMs: { click: clickMs, downloadEvent: eventMs, saveAs: saveMs } });
  return trace;
}

function verifyTraceScores(trace, fallback = false) {
  const w = trace.config.weights;
  assert.equal(w.favoriteWeight, 0.708);
  assert.equal(w.notInterestedWeight, -53.07);
  assert.equal(w.clickDwellTimeWeight, 0.385);
  assert.equal(w.videoOpenWeight, 0);
  assert.equal(w.shareWeight, 2.118);
  assert.equal(w.shareViaCopyLinkWeight, 0);
  assert.equal(w.dwellTimeWeight, 0.0075);
  assert.equal(w.coldStartImpressionThreshold, 200);
  for (const candidate of trace.result.finalCandidates) {
    if (fallback) {
      assert.equal(candidate.finalScore, candidate.coldStartAdjustedScore);
      assert.deepEqual(candidate.topHeads, []);
    } else if (candidate.finalScore !== 0) {
      const oon = candidate.inNetwork === false || (candidate.inNetwork && (candidate.inReplyToTweetId || candidate.originalTweetId));
      const factor = oon ? (trace.context.topicIds.length ? 0.5 : 0.75) : 1;
      assert(Math.abs(candidate.finalScore - candidate.diversityAdjustedScore * factor) < 1e-9);
    }
  }
}

function verifyContributions(trace) {
  const w = trace.config.weights;
  for (const candidate of trace.result.finalCandidates) {
    const boost = !candidate.inReplyToTweetId && !candidate.originalTweetId && candidate.isMutualFollowAuthor;
    let signed = 0;
    const terms = Object.entries(candidate.phoenixScores).map(([key, score]) => {
      const base = key.replace(/Score$/, '');
      let weight = w[base + 'Weight'] ?? 0;
      if (base === 'reply' && boost) weight += w.bidirectionalFollowReplyWeightBoost;
      if (base === 'dwell' && boost) weight += w.bidirectionalFollowDwellWeightBoost;
      if (base === 'vqv' && (trace.context.viewerFollowerCount >= 10000 || (candidate.videoDurationMs ?? 0) <= w.minVideoDurationMs)) weight = 0;
      if (base === 'quotedVqv' && w.enableQuotedVqvDurationCheck && (candidate.quotedVideoDurationMs ?? 0) <= w.minVideoDurationMs) weight = 0;
      if (base === 'postUnexplored' && w.postUnexploredInNetworkOnly && !candidate.inNetwork) weight = 0;
      signed += score * weight;
      return Math.abs(score * weight);
    });
    assert(Math.abs(candidate.rawWeightedScore - signed) < 1e-9, `Weighted score does not use the exported weights: ${candidate.id}`);
    const heads = candidate.topHeads;
    const total = terms.reduce((sum, term) => sum + term, 0);
    assert(heads.length <= 3);
    assert.equal(heads.some((head) => head.head === 'video_continuation' || head.head === 'profile_visit_secs'), false);
    assert.equal(new Set(heads.map((head) => head.head)).size, heads.length);
    for (const [index, head] of heads.entries()) {
      assert(Number.isFinite(head.contribution) && Number.isFinite(head.share));
      assert(head.share >= 0.1 && head.share <= 1);
      if (index) assert(Math.abs(head.contribution) <= Math.abs(heads[index - 1].contribution));
      const key = head.head.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      const score = candidate.phoenixScores[key + 'Score'] ?? candidate.phoenixScores[key];
      const boost = !candidate.inReplyToTweetId && !candidate.originalTweetId && candidate.isMutualFollowAuthor;
      const weight = key === 'reply' ? w.replyWeight + (boost ? w.bidirectionalFollowReplyWeightBoost : 0)
        : key === 'dwell' ? w.dwellWeight + (boost ? w.bidirectionalFollowDwellWeightBoost : 0)
        : w[key + 'Weight'];
      assert(Math.abs(head.contribution - score * weight) < 1e-9, `Wrong contribution: ${head.head}`);
      assert(Math.abs(head.share - Math.abs(head.contribution) / total) < 1e-9);
    }
    assert.equal(heads.length, terms.sort((a, b) => b - a).slice(0, 3).filter((term) => term / total >= 0.1).length);
  }
  assert(trace.result.finalCandidates.some((candidate) => candidate.topHeads.some((head) => head.contribution < 0)));
}

try {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`TaskSpace ${task.spaceId}`);
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  if (!budgetOnly) {
    const { runP2Checks } = await import(`./e2e-p2.mjs?run=${Date.now()}`);
    report.checks.push(...await runP2Checks(page));
    await goto('/');
    const isChinese = await page.evaluate(() => document.body.innerText.includes('切换到中文') ? false : Boolean(document.querySelector('button[aria-label="Switch to English"]')));
    if (isChinese) await page.click(button('Switch to English'));
    await checkLegacyWeightPresets();

    for (const lang of ['en', 'zh']) {
      language = lang;
      if (lang === 'zh') await page.click(button('切换到中文'));
      await goto('/');
      await page.fill('textarea', label('E2E: How do recommendation sources affect the feed?', '端到端测试：推荐来源如何影响首页内容？'));
      await page.click(button(label('Video', '视频')));
      await page.click('[data-testid="analyzer-submit"]');
      await page.waitForSelector('[data-testid="continuous-phoenix-outputs"]');
      const continuous = await page.evaluate(() => ({
        text: document.querySelector('[data-testid="continuous-phoenix-outputs"]').innerText,
        values: [...document.querySelectorAll('[data-testid="continuous-phoenix-outputs"] .continuous-value')]
          .map((node) => node.textContent.trim()),
      }));
      assert(continuous.text.includes(label('Home Video Continuation', '首页视频续看时长')));
      assert.equal(continuous.values.length, 4);
      assert(continuous.values.every((value) => /^\d+\.\d{3} (s|秒)$/.test(value)), `Excursion outputs must be numeric seconds: ${continuous.values}`);
      const [dwellTime, clickDwellTime, videoContinuation, profileVisit] = continuous.values.map((value) => Number.parseFloat(value));
      assert(dwellTime > 0 && clickDwellTime > 0);
      assert(videoContinuation > 0 && profileVisit > 0, 'Enabled home excursion heads must return values');
      assert.equal(continuous.text.includes(label('Disabled / not returned', '未启用 / 未返回')), false);
      assert.equal(continuous.text.includes('Residual'), false);
      await healthy();
      await shot(`analyzer-${lang}`);
      check(`analyzer-${lang}`, 'Video fixture outputs and enabled home excursion seconds render without NaN.');

      await page.click(button(label('Compare Mode', '对比模式')));
      await page.waitForFunction(() => document.querySelectorAll('textarea').length === 2);
      await page.fill('textarea >> nth=0', label('First comparison input', '第一条对比内容'));
      await page.waitForFunction(() => document.querySelectorAll('textarea')[0].value.length > 0);
      await page.fill('textarea >> nth=1', label('Second comparison input with a question?', '第二条对比内容，有什么不同？'));
      await page.click(button(label('Generate Fixture Outputs', '生成测试输出')));
      await page.waitForSelector('table');
      await healthy();
      check(`compare-${lang}`, 'Both inputs render a comparison table with continuous outputs.');

      await goto('/weights');
      const favorite = '[data-weight="favoriteWeight"] [role="slider"]';
      const clickDwell = '[data-weight="clickDwellTimeWeight"] [role="slider"]';
      assert.equal(Number(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-valuenow'), favorite)), 0.708);
      assert.equal(Number(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-valuenow'), clickDwell)), 0.385);
      await page.press(favorite, 'ArrowRight');
      assert.equal(Number(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-valuenow'), favorite)), 0.709);
      await shot(`weights-adjusted-${lang}`);
      await page.click(button(label('Reset to Default', '恢复默认')));
      assert.equal(Number(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-valuenow'), favorite)), 0.708);
      await healthy();
      await shot(`weights-default-${lang}`);
      check(`weights-${lang}`, 'Defaults, keyboard adjustment, and reset use current Home Mixer weights.');

      const postVideo = '[data-weight="postVideoWeight"] [role="slider"]';
      assert.equal(Number(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-valuenow'), postVideo)), 0);
      await page.press(postVideo, 'End');
      assert.equal(Number(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-valuenow'), postVideo)), 5);
      await page.waitForSelector('[data-testid="live-rank-row"]');
      assert(await page.evaluate(() => [...document.querySelectorAll('.live-rank-delta')].some((node) => {
        const value = node.textContent.trim();
        return /^[+-]\d+(?:\.\d+)?$/.test(value) && Number(value) !== 0;
      })), 'Post Video adjustment must change a visible score');
      await shot(`post-video-weight-${lang}`);
      await page.click(button(label('Reset to Default', '恢复默认')));
      await healthy();
      check(`post-video-weight-${lang}`, 'Changing Post Video weight from 0 to 5 changes a visible live-ranking score.');

      const grokAnalyze = '[data-weight="grokAnalyzeWeight"] [role="slider"]';
      assert.equal(Number(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-valuenow'), grokAnalyze)), 0);
      await page.press(grokAnalyze, 'End');
      assert.equal(Number(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-valuenow'), grokAnalyze)), 5);
      await page.waitForSelector('[data-testid="live-rank-row"]');
      assert(await page.evaluate(() => [...document.querySelectorAll('.live-rank-delta')].some((node) => {
        const value = node.textContent.trim();
        return /^[+-]\d+(?:\.\d+)?$/.test(value) && Number(value) !== 0;
      })), 'Grok Analyze adjustment must change a visible score');
      await page.click(button(label('Reset to Default', '恢复默认')));
      await healthy();
      check(`grok-analyze-weight-${lang}`, 'The new Grok Analyze head is adjustable and changes a visible live-ranking score.');

      await goto('/history');
      assert((await page.evaluate(() => document.body.innerText)).includes(label('E2E:', '端到端测试：')));
      await shot(`history-${lang}`);
      check(`history-${lang}`, 'Generated analysis remains available after route navigation.');

      await goto('/simulator');
      const upstreamLink = await page.evaluate(() => document.querySelector('header a.upstream-link')?.getAttribute('href'));
      assert.equal(upstreamLink, `https://github.com/xai-org/x-algorithm/commit/${report.upstream}`);
      const configValues = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.configuration-list > div')].map((row) => [row.querySelector('dt')?.textContent.trim(), row.querySelector('dd')?.textContent.trim()])));
      assert.equal(configValues[label('Upstream commit', '上游提交')], '590f392');
      assert.equal(configValues[label('Ads blender', '广告混排')], 'slot_spread');
      assert.equal(configValues[label('Brand-safety path', '品牌安全路径')], 'Legacy');
      assert.equal(configValues[label('Video carousel', '视频轮播')], label('Disabled', '关闭'));
      assert.equal(configValues[label('Post-video weight', '发布视频权重')], '0');
      check(`upstream-config-${lang}`, 'Header and configuration show the target commit and published defaults.');
      await page.click('[data-testid="playback-toggle"]');
      await page.waitForFunction(() => document.querySelector('[data-testid="pipeline-progress"]').dataset.step !== 'candidate_pool');
      await page.click('[data-testid="playback-toggle"]');
      await page.click(button(label('Previous step', '上一步')));
      await completePipeline();
      const trace = await exportTrace(`for-you-${lang}`);
      if (lang === 'en') verifyTraceScores(trace);
      verifyContributions(trace);
      await page.click('[data-testid="final-timeline"] [data-testid="score-contributions"] summary >> nth=0');
      await healthy();
      assert((await page.evaluate(() => document.querySelector('[data-testid="final-timeline"] details[open]')?.innerText))
        .includes(label('Main score contributions', '主要评分贡献')));
      check(`score-contributions-${lang}`, 'The exported top heads and the expandable signed contributions are available.');
      assert(trace.result.steps.find((step) => step.id === 'source_popular_posts').outputCount > 0);
      assert(trace.result.finalFeedItems.some((item) => item.type === 'ad'));
      assert(trace.result.finalFeedItems.some((item) => item.type === 'who_to_follow'));
      assert(trace.result.steps.find((step) => step.id === 'vm_ranker').details.summary.dppEnabled);
      assert(trace.result.finalCandidates.some((candidate) => candidate.retrievalSources.length > 1));
      const historyIds = (entry) => entry.items.flatMap((item) => [item.tweetId, item.sourceTweetId].filter(Boolean));
      const normalHistory = trace.context.servedHistory.filter((entry) => entry.entityType === 'post').flatMap(historyIds);
      const carouselHistory = trace.context.servedHistory.filter((entry) => entry.entityType === 'video_carousel_module').flatMap(historyIds);
      assert(normalHistory.length > 0 && carouselHistory.length > 0);
      assert.deepEqual(trace.context.servedTweetIds, normalHistory.slice(0, 100));
      assert(carouselHistory.every((id) => !trace.context.servedTweetIds.includes(id)));
      assert(trace.result.steps.some((step) => step.id === 'previously_served_posts'));
      const immersive = trace.result.steps.find((step) => step.id === 'query_hydrator_immersive_scoring_sequence_query_');
      assert(immersive && immersive.description.includes('disabled'));
      const recentViews = trace.result.steps.find((step) => step.id === 'query_hydrator_recent_views_query_');
      assert(recentViews && recentViews.description.includes('disabled'));
      assert.equal(trace.result.steps.some((step) => step.id.includes('immersive_video_scorer')), false);
      const feed = trace.result.finalFeedItems;
      assert(feed.filter((item) => item.type === 'post').length >= 5);
      for (const [index, item] of feed.entries()) {
        if (item.type !== 'ad') continue;
        for (const neighbor of [feed[index - 1], feed[index + 1]]) {
          if (neighbor?.type === 'post') assert.notEqual(neighbor.tweet.brandSafetyVerdict, 'high_risk');
        }
      }
      check(`served-and-blending-${lang}`, 'Served post IDs are hydrated, carousel history is excluded, and ads avoid adjacent high-risk posts.');
      await shot(`for-you-${lang}`);
      check(`for-you-${lang}`, 'Playback, back, popular retrieval, merged provenance, VM scoring, DPP, and blending pass.');
      for (const [width, viewport] of [[768, 'tablet'], [390, 'phone']]) {
        await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
        for (const pane of [label('Candidate Pool', '候选池'), label('Pipeline decisions', '流程与决策'), label('Final timeline', '最终信息流')]) {
          await page.click(`loc=role:tab[name="${pane}"]`);
          await healthy();
        }
        await shot(`for-you-${lang}-${viewport}`);
        check(`layout-${lang}-${viewport}`, 'Candidate, stage, and score labels remain separate in all three workspace panes.');
      }
      await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });


      // Algorithm scenarios do not depend on the display language.
      if (lang === 'en') continue;
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

  } else {
    await goto('/simulator');
    language = await page.evaluate(() => document.documentElement.lang === 'zh-CN' ? 'zh' : 'en');
  }

  await selectScenario(label('Source budget (3,500 posts)', '来源预算（3,500 帖子）'));
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
  const budgetTrace = await exportTrace('source-budget');
  verifyBudgetTrace(budgetTrace, check);
  verifyContributions(budgetTrace);
  check('source-budget-contributions', 'Top heads retain the signed contribution and absolute share at the 10% threshold.');
  await healthy();

  if (!budgetOnly) {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await goto('/');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('header nav a')].every((a) => a.getAttribute('aria-label'))), true);
    await shot('mobile');
    check('mobile', 'The 390px layout fits the viewport and navigation has accessible names.');
    await goto('/weights');
    await page.click('loc=role:tab[name="实时排序"]');
    await page.waitForSelector('[data-testid="live-rank-row"]');
    await healthy();
    await shot('mobile-weight-ranking');
    await page.click('loc=role:tab[name="权重参数"]');
    await page.press('[data-weight="favoriteWeight"] [role="slider"]', 'ArrowRight');
    await healthy();
    check('mobile-weight-views', 'Weights and the resulting ranking remain available through a compact two-view workspace.');


    const { runDomRecoveryChecks } = await import(`./e2e-dom-recovery.mjs?run=${Date.now()}`);
    const domChecks = await runDomRecoveryChecks(page);
    report.checks.push(...domChecks);

  }

  report.status = 'passed';
  report.completedAt = new Date().toISOString();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await rm(resolve(output, 'failure.png'), { force: true });
  await rm(downloads, { recursive: true, force: true });
  console.log(await page.snapshot());
  if (options.has('keep-preview')) {
    await page.cdp('Emulation.clearDeviceMetricsOverride');
    await page.goto('http://127.0.0.1:5173/simulator');
  }
  if (!options.has('keep-space')) await task.finish({ keep: options.has('keep-preview') ? ['p1'] : [] });
  console.log(`E2E passed: ${report.checks.length} checks. Report: ${resolve(output, 'report.json')}`);
} catch (error) {
  report.status = 'failed';
  report.error = String(error.stack || error);
  await shot('failure').catch(() => {});
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(await page.snapshot().catch(() => 'Snapshot unavailable'));
  throw error;
}
