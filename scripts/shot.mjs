// Capture a deterministic game scene to PNG with headless Chrome (WebGL via SwiftShader).
// Usage: node scripts/shot.mjs <scene> <out.png> [width] [height] [waitMs]
// Scenes are listed in game/shot.ts. Needs the dev server on http://localhost:3000
// (override with PARTY_ORIGIN). Each capture uses its own browser profile and
// debugging port, so several can run at once. Drives Chrome over the DevTools
// protocol so animations run in real time before the capture.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [scene = 'menu', out = 'shot.png', width = '1280', height = '800', wait = '20000'] =
  process.argv.slice(2);
const browsers = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const browser = browsers.find((b) => existsSync(b));
if (!browser) throw Error('No Chrome/Edge found; set CHROME_PATH.');
const origin = process.env.PARTY_ORIGIN ?? 'http://localhost:3000';
// Software WebGL is CPU-heavy: allow three captures at a time across processes.
const slots = [0, 1, 2].map((i) => join(tmpdir(), `pp-shot-slot-${i}`));
let slot;
for (let tries = 0; !slot; tries++) {
  for (const s of slots) {
    try {
      if (existsSync(s) && Date.now() - statSync(s).mtimeMs > 180000) unlinkSync(s);
      writeFileSync(s, String(process.pid), { flag: 'wx' });
      slot = s;
      break;
    } catch {}
  }
  if (!slot) await new Promise((r) => setTimeout(r, 1000 + (tries % 7) * 150));
}
process.on('exit', () => {
  try {
    unlinkSync(slot);
  } catch {}
});
// Restart the local dev server if a file-watch hiccup took it down.
const up = () =>
  fetch(origin, { signal: AbortSignal.timeout(4000) }).then(
    (r) => r.ok,
    () => false,
  );
if (!(await up()) && /localhost:3000|127\.0\.0\.1:3000/.test(origin)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  spawn(
    process.execPath,
    ['--import', './scripts/sites-env.mjs', './node_modules/vinext/dist/cli.js', 'dev'],
    { cwd: root, detached: true, stdio: 'ignore' },
  ).unref();
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 1000));
}
const profile = mkdtempSync(join(tmpdir(), 'pp-shot-'));
const chrome = spawn(browser, [
  '--headless=new',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--hide-scrollbars',
  '--mute-audio',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  `--window-size=${width},${height}`,
  'about:blank',
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  // Chrome prints its DevTools endpoint on stderr.
  const endpoint = await new Promise((ok, fail) => {
    let text = '';
    chrome.stderr.on('data', (d) => {
      text += d;
      const m = text.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) ok(m[1]);
    });
    setTimeout(() => fail(Error('Chrome did not start')), 30000).unref();
  });
  const port = new URL(endpoint).port;
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok) => ws.addEventListener('open', ok, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((ok) => {
      pending.set(++id, ok);
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', {
    width: Number(width),
    height: Number(height),
    deviceScaleFactor: 1,
    mobile: Number(width) < 700,
  });
  await send('Page.enable');
  await send('Page.navigate', { url: `${origin}/?shot=${encodeURIComponent(scene)}` });
  await sleep(Number(wait));
  const jpeg = /\.jpe?g$/i.test(out);
  const shot = await send('Page.captureScreenshot', jpeg ? { format: 'jpeg', quality: 82 } : { format: 'png' });
  if (!shot.result?.data) throw Error('Capture failed: ' + JSON.stringify(shot.error));
  writeFileSync(resolve(out), Buffer.from(shot.result.data, 'base64'));
  ws.close();
  console.log(resolve(out));
} finally {
  chrome.kill();
  await sleep(300);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // Chrome can hold its profile briefly after exit; the OS temp cleanup gets it.
  }
}
