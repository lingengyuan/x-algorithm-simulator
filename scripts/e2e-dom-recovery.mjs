import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Emulate the text-node replacement used by page translators. Force mode tests
// selected-value unmounts even when a translator ignores the page's opt-out.
async function translateText(page, selector, force = false) {
  return page.evaluate(({ selector, force }) => {
    const root = document.querySelector(selector);
    if (!root) throw new Error(`Missing translation target: ${selector}`);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let skipped = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!node.textContent.trim() || parent.closest('script,style,svg,input,textarea,font')) continue;
      if (!force && !parent.translate) { skipped++; continue; }
      nodes.push(node);
    }
    for (const node of nodes) {
      const outer = document.createElement('font');
      const inner = document.createElement('font');
      outer.style.verticalAlign = 'inherit';
      inner.style.verticalAlign = 'inherit';
      inner.textContent = node.textContent;
      outer.append(inner);
      node.parentNode.replaceChild(outer, node);
    }
    return { replaced: nodes.length, skipped };
  }, { selector, force });
}

export async function runDomRecoveryChecks(page, baseUrl = 'http://127.0.0.1:4173') {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const output = resolve(root, 'artifacts/dom-recovery');
  await mkdir(output, { recursive: true });
  const report = { baseUrl, startedAt: new Date().toISOString(), browser: 'ego-browser', mechanism: 'Translator-style text-node replacement in the actual application', checks: [], screenshots: [] };
  const pass = (name, detail) => { report.checks.push({ name, status: 'passed', detail }); console.log(`PASS ${name}`); };
  const clickButton = (name) => page.click(`loc=role:button[name="${name}"]`);
  const healthy = async () => {
    const state = await page.evaluate(() => ({ error: Boolean(document.querySelector('[data-testid="app-error"]')), caught: window.__domErrors || [], heading: document.querySelector('h1')?.textContent }));
    assert.equal(state.error, false, 'React error boundary is visible');
    assert.deepEqual(state.caught, [], 'React caught an error during DOM recovery checks');
    assert(state.heading, 'Main route did not render');
  };
  const watchErrors = () => page.evaluate(() => {
    window.__domErrors = [];
    const original = console.error;
    console.error = (...args) => {
      if (String(args[0]).includes('ErrorBoundary caught')) window.__domErrors.push(args[1]?.message || String(args[1]));
      original(...args);
    };
  });
  const goto = async (path) => { await page.goto(baseUrl + path); await page.waitForSelector('h1'); await watchErrors(); };
  const navigate = async (path) => {
    await page.click(`nav a[href="${path}"]`);
    const headings = path === '/weights' ? ['Weight Laboratory', '权重实验室'] : ['Analysis History', '分析历史'];
    await page.waitForFunction(({ path, headings }) => location.pathname === path && (headings.includes(document.querySelector('h1')?.textContent.trim()) || Boolean(document.querySelector('[data-testid="app-error"]'))), { path, headings });
    await healthy();
  };
  const shot = async (name) => { await page.screenshot({ path: resolve(output, name) }); report.screenshots.push(name); };

  try {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const lang of ['en', 'zh']) {
      await goto('/simulator');
      const targetLocale = lang === 'zh' ? 'zh-CN' : 'en-US';
      const currentLocale = await page.evaluate(() => document.documentElement.lang);
      if (currentLocale !== targetLocale) await clickButton(lang === 'zh' ? '切换到中文' : 'Switch to English');
      await page.waitForFunction((locale) => document.documentElement.lang === locale, targetLocale);
      assert.equal(await page.evaluate(() => document.documentElement.translate), false);
      const protectedText = await translateText(page, '#root');
      assert.equal(protectedText.replaced, 0);
      assert(protectedText.skipped > 0);
      pass(`translation-policy-${lang}`, { locale: targetLocale, ...protectedText });

      const sourceValue = await translateText(page, '[role="combobox"] > span', true);
      assert(sourceValue.replaced > 0, 'The forced translation did not replace selected text');
      await navigate('/weights');
      await page.waitForSelector('[data-weight="favoriteWeight"]');
      await healthy();
      pass(`translated-scenario-navigation-${lang}`, sourceValue);

      const favorite = '[data-weight="favoriteWeight"] [role="slider"]';
      await page.press(favorite, 'ArrowRight');
      const value = Number(await page.evaluate((selector) => document.querySelector(selector).getAttribute('aria-valuenow'), favorite));
      assert.equal(value, 0.67);
      const preset = `DOM-regression-${lang}-${Date.now()}`;
      await clickButton(lang === 'zh' ? '保存预设' : 'Save Preset');
      await page.fill('input[placeholder]', preset);
      await clickButton(lang === 'zh' ? '保存' : 'Save');
      await page.waitForFunction((name) => document.querySelector('[role="combobox"]')?.textContent.includes(name), preset);
      assert((await translateText(page, '[role="combobox"] > span', true)).replaced > 0);
      await clickButton(lang === 'zh' ? '恢复默认' : 'Reset to Default');
      await page.waitForFunction((selector) => Number(document.querySelector(selector).getAttribute('aria-valuenow')) === 0.66, favorite);
      await healthy();
      await page.click('[role="combobox"]');
      await page.click(`loc=role:listboxoption[name="${preset}"]`);
      await page.waitForFunction((selector) => Number(document.querySelector(selector).getAttribute('aria-valuenow')) === 0.67, favorite);
      await clickButton(lang === 'zh' ? '删除预设' : 'Delete preset');
      await healthy();
      await shot(`weights-${lang}.png`);
      pass(`translated-preset-reset-${lang}`, 'Save, translated selection, reset, reload preset, and delete own preset');

      await goto('/simulator');
      assert.equal((await translateText(page, '#root')).replaced, 0);
      await clickButton(lang === 'zh' ? '下一步' : 'Next step');
      await page.waitForFunction(() => document.querySelector('[data-testid="pipeline-progress"]')?.dataset.step !== 'candidate_pool');
      await clickButton(lang === 'zh' ? '上一步' : 'Previous step');
      await page.waitForFunction(() => document.querySelector('[data-testid="pipeline-progress"]')?.dataset.step === 'candidate_pool');
      await page.click('[data-testid="playback-toggle"]');
      await page.waitForFunction(() => document.querySelector('[data-testid="pipeline-progress"]')?.dataset.step !== 'candidate_pool');
      await page.click('[data-testid="playback-toggle"]');
      await healthy();
      await shot(`simulator-${lang}.png`);
      pass(`protected-playback-${lang}`, 'Next, previous, play, and pause remain usable after translation attempts');

      await goto('/');
      assert((await translateText(page, '[role="combobox"] > span', true)).replaced > 0);
      await navigate('/history');
      pass(`translated-author-navigation-${lang}`, 'Unmount a translated author selection through real route navigation');
    }

    // An already-corrupted portal must recover through a document reload.
    await goto('/simulator');
    await page.evaluate(() => {
      window.__corruptedDocument = true;
      const value = document.querySelector('[role="combobox"] > span');
      const host = value.querySelector('span');
      if (!host) throw new Error('Selected-value host is missing');
      const replacement = document.createElement('font');
      replacement.textContent = host.textContent;
      value.replaceChild(replacement, host);
    });
    await page.click('nav a[href="/weights"]');
    await page.waitForSelector('[data-testid="app-error"]');
    const error = await page.evaluate(() => document.querySelector('[data-testid="app-error"]').textContent);
    assert(error.includes('removeChild'));
    await page.click('[data-testid="app-error"] button');
    await page.waitForFunction(() => Boolean(document.querySelector('h1')) && !window.__corruptedDocument);
    await healthy();
    assert.equal(await page.evaluate(() => document.documentElement.translate), false);
    await shot('recovered.png');
    pass('corrupted-document-reload', 'Retry reloads a damaged DOM and renders the weights route again');

    report.status = 'passed';
    report.completedAt = new Date().toISOString();
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
    return report.checks;
  } catch (error) {
    report.status = 'failed';
    report.error = String(error.stack || error);
    await shot('failure.png').catch(() => {});
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
    throw error;
  }
}

const options = new URL(import.meta.url).searchParams;
if (options.has('standalone')) {
  const task = await taskSpace(options.has('space') ? Number(options.get('space')) : 'X simulator DOM regression');
  const page = task.page('p1');
  const checks = await runDomRecoveryChecks(page);
  if (options.has('keep-preview')) await page.goto('http://127.0.0.1:5173/simulator');
  await task.finish({ keep: options.has('keep-preview') ? ['p1'] : [] });
  console.log(`DOM recovery E2E passed: ${checks.length} checks.`);
}
