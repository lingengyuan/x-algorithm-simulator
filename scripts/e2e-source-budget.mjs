import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { verifyBudgetTrace } from './e2e-budget-assertions.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const options = new URL(import.meta.url).searchParams;
const runId = options.get('run') || String(Date.now());
const output = resolve(root, 'artifacts/source-budget-check', runId);
await mkdir(output, { recursive: true });
const task = await taskSpace(options.has('space') ? Number(options.get('space')) : 'X simulator E2E');
const page = task.page('p1');
const report = {
  runId, status: 'running', browser: 'ego-browser',
  upstream: '7fef3ba19d82d1f76dec65f31b981ca817a2ea06',
  startedAt: new Date().toISOString(), checks: [], timingsMs: {},
};
const check = (name, detail) => { report.checks.push({ name, status: 'passed', detail }); console.log(`PASS ${name}`); };
const reportPath = resolve(output, 'report.json');
let stage = 'navigation';

try {
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await page.goto('http://127.0.0.1:4173/simulator');
  await page.waitForSelector('[role="combobox"]');
  await page.evaluate(() => {
    window.__budgetErrors = [];
    window.addEventListener('error', (event) => window.__budgetErrors.push(event.message));
    window.addEventListener('unhandledrejection', (event) => window.__budgetErrors.push(String(event.reason)));
  });
  const lang = await page.evaluate(() => document.documentElement.lang);
  await page.click('[role="combobox"]');
  await page.click(`loc=role:listboxoption[name="${lang === 'zh-CN' ? '来源预算（3,500 帖子）' : 'Source budget (3,500 posts)'}"]`);
  await page.waitForFunction(() => document.querySelector('[data-testid="pipeline-progress"]')?.dataset.step === 'candidate_pool');
  stage = 'pipeline';
  await page.press('[role="slider"]', 'End');
  await page.click('[data-testid="playback-toggle"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="pipeline-progress"]')?.dataset.step === 'final_ranking', undefined, { timeout: 90000 });
  await page.waitForSelector('[data-testid="final-timeline"]');
  await page.screenshot({ path: resolve(output, 'source-budget.png') });

  stage = 'click';
  const started = Date.now();
  const pending = page.waitForEvent('download', { timeout: 60000 }).then(
    (download) => ({ download, eventMs: Date.now() - started }),
    (error) => ({ error, eventMs: Date.now() - started }),
  );
  await page.click('[data-testid="export-trace"]');
  report.timingsMs.click = Date.now() - started;
  stage = 'download-event';
  const event = await pending;
  report.timingsMs.downloadEvent = event.eventMs;
  if (event.error) throw event.error;
  stage = 'save-as';
  const saveStarted = Date.now();
  const tracePath = resolve(output, 'source-budget.json');
  await event.download.saveAs(tracePath);
  report.timingsMs.saveAs = Date.now() - saveStarted;
  report.timingsMs.downloadTotal = Date.now() - started;
  stage = 'trace-assertions';
  const raw = await readFile(tracePath);
  const trace = JSON.parse(raw.toString('utf8'));
  report.trace = { rawBytes: raw.length, rawSha256: createHash('sha256').update(raw).digest('hex') };
  assert.equal(trace.upstream.commit, report.upstream);
  assert.equal(trace.upstream.paramsSyncedAt, '2026-10-28T16:00:35Z');
  assert.equal(trace.rawCandidates.length, 3500);
  assert(trace.rawCandidates.every((candidate) => candidate.id && candidate.phoenixScores));
  assert(trace.context && Array.isArray(trace.context.servedHistory) && Array.isArray(trace.context.adFixtures));
  assert(trace.config && Array.isArray(trace.config.enabledFilters) && trace.config.weights);
  assert.equal(trace.config.weights.postVideoWeight, 0);
  assert(trace.result && Array.isArray(trace.result.steps) && trace.result.steps.length > 0);
  assert(trace.result.finalCandidates.length > 0 && trace.result.finalFeedItems.length > 0);
  assert(trace.result.finalCandidates.every((candidate) => Number.isFinite(candidate.finalScore)));
  check('trace-content', { rawCandidates: trace.rawCandidates.length, steps: trace.result.steps.length, finalCandidates: trace.result.finalCandidates.length, feedItems: trace.result.finalFeedItems.length });
  verifyBudgetTrace(trace, check);
  report.pageErrors = await page.evaluate(() => window.__budgetErrors);
  assert.deepEqual(report.pageErrors, []);
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('[data-testid="app-error"]'))), false);
  check('page-health', 'No page errors or error boundary after export.');
  const compressed = gzipSync(raw);
  const compressedPath = resolve(output, 'source-budget.json.gz');
  await writeFile(compressedPath, compressed);
  report.trace.file = 'source-budget.json.gz';
  report.trace.bytes = compressed.length;
  report.trace.sha256 = createHash('sha256').update(compressed).digest('hex');
  await rm(tracePath);
  report.status = 'passed';
  report.completedAt = new Date().toISOString();
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  if (options.has('keep-preview')) await page.goto('http://127.0.0.1:5173/simulator');
  await task.finish({ keep: options.has('keep-preview') ? ['p1'] : [] });
  console.log(`Source-budget check passed: ${reportPath}`);
} catch (error) {
  report.status = 'failed';
  report.stage = stage;
  report.error = String(error.stack || error);
  report.completedAt = new Date().toISOString();
  report.pageErrors = await page.evaluate(() => window.__budgetErrors || []).catch(() => []);
  await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  throw error;
}
