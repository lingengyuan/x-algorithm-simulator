import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function runP2Checks(page, baseUrl = 'http://127.0.0.1:4173') {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const output = resolve(root, 'artifacts/p2-regression');
  await mkdir(output, { recursive: true });
  const report = { status: 'running', browser: 'ego-browser', baseUrl, startedAt: new Date().toISOString(), checks: [], screenshots: [] };
  const pass = (name, detail) => {
    report.checks.push({ name, status: 'passed', detail });
    console.log(`PASS ${name}`);
  };
  const button = (name) => `loc=role:button[name="${name}"]`;
  const favorite = '[data-weight="favoriteWeight"] [role="slider"]';
  const value = () => page.evaluate((selector) => Number(document.querySelector(selector).getAttribute('aria-valuenow')), favorite);
  const healthy = async () => {
    assert.equal(await page.evaluate(() => Boolean(document.querySelector('[data-testid="app-error"]'))), false);
    assert(await page.evaluate(() => document.querySelector('h1')?.textContent.trim()));
  };
  const shot = async (name) => {
    await page.screenshot({ path: resolve(output, name) });
    report.screenshots.push(name);
  };

  try {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    for (const lang of ['en', 'zh']) {
      const zh = lang === 'zh';
      await page.goto(baseUrl + '/weights');
      await page.waitForSelector('h1');
      if (await page.evaluate(() => Boolean(document.querySelector('button[aria-label="Switch to English"]'))) !== zh) {
        await page.click(button(zh ? '切换到中文' : 'Switch to English'));
      }
      await page.waitForFunction((zh) => Boolean(document.querySelector('button[aria-label="Switch to English"]')) === zh, zh);

      const routes = [];
      for (const [path, heading] of [
        ['simulator', zh ? '排序模拟器' : 'Ranking Simulator'],
        ['weights', zh ? '权重实验室' : 'Weight Laboratory'],
        ['history', zh ? '分析历史' : 'Analysis History'],
      ]) {
        for (const suffix of ['', '/']) {
          const url = baseUrl + '/' + path + suffix;
          await page.goto(url);
          await page.waitForFunction((heading) => document.querySelector('h1')?.textContent.trim() === heading, heading);
          if (suffix) {
            await page.reload();
            await page.waitForFunction((heading) => document.querySelector('h1')?.textContent.trim() === heading, heading);
            await shot(`deep-link-${path}-${lang}.png`);
          }
          await healthy();
          const assets = await page.evaluate(() => [...document.querySelectorAll('script[type="module"][src]')].map((node) => node.getAttribute('src')));
          assert(assets.length > 0 && assets.every((src) => src.startsWith('/assets/')), 'Production assets must resolve from the deployment root');
          routes.push({ path: '/' + path + suffix, assets, reloaded: Boolean(suffix) });
        }
      }
      pass(`deep-links-${lang}`, routes);

      await page.goto(baseUrl + '/weights');
      await page.waitForSelector(favorite);
      await page.click(button(zh ? '恢复默认' : 'Reset to Default'));
      assert.equal(await value(), 0.66);
      const preset = `P2-reload-${lang}-${Date.now()}`;
      try {
        await page.click(button(zh ? '保存预设' : 'Save Preset'));
        await page.fill('input[placeholder]', preset);
        await page.click(button(zh ? '保存' : 'Save'));
        await page.waitForFunction((name) => document.querySelector('[role="combobox"]')?.textContent.includes(name), preset);
        await page.press(favorite, 'End');
        assert.equal(await value(), 5);
        await page.waitForSelector('[role="combobox"][data-placeholder]');
        await page.click('[role="combobox"]');
        await page.click(`loc=role:listboxoption[name="${preset}"]`);
        await page.waitForFunction((selector) => Number(document.querySelector(selector)?.getAttribute('aria-valuenow')) === 0.66, favorite);
        await healthy();
        await shot(`same-preset-reload-${lang}.png`);
        pass(`same-preset-reload-${lang}`, { saved: 0.66, edited: 5, reloaded: await value() });
        await page.click(button(zh ? '删除预设' : 'Delete preset'));
      } finally {
        await page.evaluate((name) => {
          const key = 'x-simulator-weights';
          const presets = JSON.parse(localStorage.getItem(key) || '{}');
          delete presets[name];
          if (Object.keys(presets).length) localStorage.setItem(key, JSON.stringify(presets));
          else localStorage.removeItem(key);
        }, preset);
      }

      const inactive = await page.evaluate(() => {
        const slider = document.querySelector('[data-weight="topicOonWeightFactor"] [role="slider"]');
        return {
          disabled: slider.closest('[aria-disabled="true"]')?.getAttribute('aria-disabled'), tabIndex: slider.tabIndex,
          describedBy: slider.getAttribute('aria-describedby'),
          help: document.querySelector('#topic-oon-help')?.textContent.trim(),
        };
      });
      assert.equal(inactive.disabled, 'true');
      assert.equal(inactive.tabIndex, -1);
      assert.equal(inactive.describedBy, 'topic-oon-help');
      assert(inactive.help.includes(zh ? '当前为普通推荐预览' : 'This standard feed preview'));
      await page.focus('xpath=//div[@data-weight="topicOonWeightFactor"]/preceding-sibling::div[1]//*[@role="slider"]');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), zh ? 'VMRanker 服务可用' : 'VMRanker service available');
      await shot(`inactive-topic-factor-${lang}.png`);
      pass(`inactive-topic-factor-${lang}`, { ...inactive, keyboardSkipsControl: true });
    }
    report.status = 'passed';
    report.completedAt = new Date().toISOString();
    return report.checks;
  } catch (error) {
    report.status = 'failed';
    report.error = String(error.stack || error);
    throw error;
  } finally {
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  }
}

const options = new URL(import.meta.url).searchParams;
if (options.has('standalone')) {
  const task = await taskSpace(options.has('space') ? Number(options.get('space')) : `P2 regression ${Date.now()}`);
  console.log(`TaskSpace ${task.spaceId}`);
  await runP2Checks(task.page('p1'));
  if (!options.has('keep-space')) await task.finish({ keep: [] });
}
