import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
let browser;
const stop = () => { browser?.kill('SIGTERM'); server.kill('SIGTERM'); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

try {
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.once('exit', (code) => reject(new Error(`Preview server exited: ${code}`)));
    server.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      if (chunk.toString().includes('http://127.0.0.1:4173')) accept();
    });
  });
  const domRecovery = process.argv.includes('--dom-recovery');
  const budgetOnly = process.argv.includes('--source-budget');
  const entry = pathToFileURL(resolve(root, budgetOnly ? 'scripts/e2e-source-budget.mjs' : domRecovery ? 'scripts/e2e-dom-recovery.mjs' : 'scripts/e2e.mjs'));
  if (domRecovery) entry.searchParams.set('standalone', 'true');
  entry.searchParams.set('run', Date.now().toString());
  const space = process.argv.find((arg) => arg.startsWith('--space='));
  if (space) entry.searchParams.set('space', space.slice(8));
  if (process.argv.includes('--keep-preview')) entry.searchParams.set('keep-preview', 'true');
  browser = spawn('ego-browser', ['nodejs', '-e', `await import(${JSON.stringify(entry.href)})`], { cwd: root, stdio: 'inherit' });
  process.exitCode = await new Promise((accept, reject) => {
    browser.once('error', reject);
    browser.once('exit', (code) => accept(code ?? 1));
  });
} finally {
  stop();
}
