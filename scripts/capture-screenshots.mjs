import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const BASE_URL = 'http://127.0.0.1:4173';
const DEBUG_PORT = 9222;
const SCREENSHOT_DIR = 'docs/screenshots';
const USER_DATA_DIR = '/tmp/x-sim-chrome-profile';

let commandId = 0;
let ws;
const pending = new Map();

function nextId() {
  commandId += 1;
  return commandId;
}

async function fetchJson(url, retries = 60, waitMs = 250) {
  let lastError;
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (error) {
      lastError = error;
      await delay(waitMs);
    }
  }
  throw lastError;
}

async function connectWs() {
  const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const pageTarget = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
  if (!pageTarget) {
    throw new Error("No debuggable page target found");
  }
  ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(msg.error.message));
      } else {
        resolve(msg.result);
      }
    }
  });
}

function send(method, params = {}) {
  const id = nextId();
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}

async function evalJs(expression, awaitPromise = true) {
  return send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
}

async function waitForReady() {
  const script = `
    (async () => {
      const max = 120;
      for (let i = 0; i < max; i++) {
        if (document.readyState === 'complete' && document.querySelector('header')) {
          return true;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('Page not ready in time');
    })();
  `;
  await evalJs(script);
}

async function goto(path) {
  await send('Page.navigate', { url: `${BASE_URL}${path}` });
  await waitForReady();
}

async function screenshot(file) {
  const pageHeightResult = await evalJs(`
    (() => {
      const root = document.documentElement;
      const body = document.body;
      const heights = [
        root?.scrollHeight || 0,
        root?.offsetHeight || 0,
        body?.scrollHeight || 0,
        body?.offsetHeight || 0,
      ];
      return Math.ceil(Math.max(...heights));
    })();
  `);
  const pageHeight = Number(pageHeightResult.result.value) || 1100;
  const clipHeight = Math.min(Math.max(pageHeight + 20, 820), 1280);

  const res = await send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 74,
    captureBeyondViewport: false,
    clip: {
      x: 0,
      y: 0,
      width: 1400,
      height: clipHeight,
      scale: 1,
    },
  });
  await writeFile(`${SCREENSHOT_DIR}/${file}`, Buffer.from(res.data, 'base64'));
  console.log(`saved ${file}`);
}

async function setLanguage(lang) {
  await goto('/');
  await evalJs(`localStorage.setItem('x-simulator-language', '${lang}');`);
  await evalJs(`localStorage.removeItem('x-simulator-history');`);
  await goto('/');
  await delay(350);
}

async function fillAnalyzerText(text) {
  const escaped = JSON.stringify(text);
  const script = `
    (() => {
      const ta = document.querySelector('textarea');
      if (!ta) throw new Error('textarea not found');
      ta.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (!setter) throw new Error('textarea setter not found');
      setter.call(ta, ${escaped});
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })();
  `;
  await evalJs(script);
  await delay(300);
}

async function clickButtonByText(texts) {
  const textArray = JSON.stringify(texts);
  const script = `
    (() => {
      const candidates = [...document.querySelectorAll('button')];
      const targets = ${textArray};
      const btn = candidates.find((b) => {
        const value = (b.textContent || '').replace(/\s+/g, ' ').trim();
        return targets.some((t) => value.includes(t));
      });
      if (!btn) {
        throw new Error('button not found: ' + targets.join(','));
      }
      btn.click();
      return true;
    })();
  `;
  await evalJs(script);
  await delay(350);
}

async function waitForText(texts, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await evalJs(`(${JSON.stringify(texts)}).some((t) => document.body.innerText.includes(t));`);
    if (result.result.value) {
      return;
    }
    await delay(250);
  }
  throw new Error(`timeout waiting for text: ${texts.join(',')}`);
}

async function waitForExpression(expression, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await evalJs(expression);
    if (result.result.value) {
      return;
    }
    await delay(250);
  }
  throw new Error(`timeout waiting for expression: ${expression}`);
}

async function getStepMarker() {
  const res = await evalJs(`
    (() => {
      const text = (document.body.innerText || '').replace(/\\s+/g, ' ');
      const zh = text.match(/步骤\\s*\\d+\\s*\\/\\s*\\d+/);
      if (zh) return zh[0];
      const en = text.match(/Step\\s*\\d+\\s*of\\s*\\d+/i);
      if (en) return en[0];
      return '';
    })();
  `);
  return String(res.result.value || '');
}

async function waitForStepAdvance(initialStepText, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const current = await getStepMarker();
    if (current && current !== initialStepText) {
      return current;
    }
    await delay(250);
  }
  throw new Error(`timeout waiting step advance from: ${initialStepText}`);
}

async function adjustWeightSliders() {
  const script = `
    (() => {
      const sliders = [...document.querySelectorAll('[role="slider"]')];
      if (!sliders.length) throw new Error('No sliders found');

      function nudge(el, key, times) {
        el.focus();
        for (let i = 0; i < times; i++) {
          el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        }
      }

      nudge(sliders[0], 'ArrowRight', 8);
      if (sliders[1]) nudge(sliders[1], 'ArrowLeft', 10);
      if (sliders[2]) nudge(sliders[2], 'ArrowRight', 6);
      if (sliders[3]) nudge(sliders[3], 'ArrowLeft', 6);

      return sliders.length;
    })();
  `;
  await evalJs(script);
  await delay(1200);
}

async function setSimulatorSpeedMax() {
  const script = `
    (() => {
      const slider = document.querySelector('[role="slider"]');
      if (!slider) return false;
      slider.focus();
      for (let i = 0; i < 12; i++) {
        slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      }
      return true;
    })();
  `;
  await evalJs(script);
  await delay(350);
}

async function runForLanguage(lang, labels) {
  await setLanguage(lang);

  const analyzerText = lang === 'zh'
    ? '刚发布新版本，推荐链路和可解释性明显增强，欢迎体验并反馈。'
    : 'Shipped a new simulator release with stronger pipeline visibility and explainability. Thoughts?';

  await goto('/');
  await fillAnalyzerText(analyzerText);
  await screenshot(`after-analyzer-input-${labels}.jpg`);

  await clickButtonByText([labels === 'zh' ? '分析推文' : 'Analyze Tweet']);
  await waitForExpression(`document.querySelectorAll('.recharts-wrapper').length > 0`);
  await screenshot(`after-analyzer-result-${labels}.jpg`);

  await goto('/simulator');
  await waitForText([labels === 'zh' ? '步骤' : 'Step']);
  await screenshot(`after-simulator-start-${labels}.jpg`);

  const initialStep = await getStepMarker();
  await setSimulatorSpeedMax();
  await clickButtonByText([labels === 'zh' ? '播放' : 'Play']);
  await waitForStepAdvance(initialStep, 30000);
  await delay(1200);
  await screenshot(`after-simulator-running-${labels}.jpg`);

  await waitForExpression(`
    (() => {
      const text = document.body.innerText || '';
      const hasTop10 = text.includes('Top 10');
      const hasFinalLabel = text.includes('Final Ranking') || text.includes('最终排序');
      return hasTop10 && hasFinalLabel;
    })()
  `, 120000);
  await delay(300);
  await screenshot(`after-simulator-final-${labels}.jpg`);

  await goto('/weights');
  await waitForText([labels === 'zh' ? '权重实验室' : 'Weight Laboratory']);
  await screenshot(`after-weights-default-${labels}.jpg`);

  await adjustWeightSliders();
  await screenshot(`after-weights-adjusted-${labels}.jpg`);

  await goto('/history');
  await waitForText([labels === 'zh' ? '分析历史' : 'Analysis History']);
  await screenshot(`after-history-populated-${labels}.jpg`);
}

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const chrome = spawn('/opt/google/chrome/chrome', [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--remote-debugging-port=9222',
    '--window-size=1400,1200',
    `--user-data-dir=${USER_DATA_DIR}`,
    'about:blank',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  chrome.stderr.on('data', () => {});

  try {
    await connectWs();
    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1400,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1400,
      screenHeight: 1200,
    });

    await runForLanguage('en', 'en');
    await runForLanguage('zh', 'zh');

    ws.close();
    chrome.kill('SIGTERM');
    console.log('All screenshots captured.');
  } catch (error) {
    ws?.close();
    chrome.kill('SIGTERM');
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
