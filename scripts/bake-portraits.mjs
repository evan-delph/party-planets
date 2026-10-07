// Bake the default crew's HUD portraits (your starting alien and the three CPU
// rivals) to public/textures/portraits/, so their player cards show the real
// rendered characters instantly instead of waiting for a live render.
// Re-run after changing the alien model, BOT_LOOKS, DEFAULT_AVATAR or the
// portrait framing (bump PORTRAIT_VERSION in game/art.tsx when the look
// changes but the avatar fields do not). Needs the dev server on :3000.
// Usage: node scripts/bake-portraits.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const origin = process.env.PARTY_ORIGIN ?? 'http://localhost:3000';
const browser = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
]
  .filter(Boolean)
  .find((b) => existsSync(b));
if (!browser) throw Error('No Chrome/Edge found; set CHROME_PATH.');
const profile = mkdtempSync(join(tmpdir(), 'pp-bake-'));
const chrome = spawn(browser, [
  '--headless=new',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  'about:blank',
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Runs in the page: render each default crew member and return WebP files.
const bake = async () => {
  const cfg = await import('/game/config.ts');
  const eng = await import('/game/engine.ts');
  const art = await import('/game/art.tsx');
  const portraits = await import('/game/portraits.ts');
  const out = [];
  for (const { avatar } of eng.newGame(cfg.DEFAULT_AVATAR).players) {
    const img = new Image();
    img.src = await portraits.renderPortrait(avatar);
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    out.push([art.bakedPortraitPath(avatar), canvas.toDataURL('image/webp', 0.92), avatar.name]);
  }
  return out;
};
try {
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
  await send('Page.enable');
  // Any page on the dev server will do; a 404 keeps the 3D board from loading.
  await send('Page.navigate', { url: `${origin}/__portrait-bake` });
  await sleep(4000);
  const r = await send('Runtime.evaluate', {
    expression: `(${bake})()`,
    awaitPromise: true,
    returnByValue: true,
  });
  const files = r.result?.result?.value;
  if (!files) throw Error('Bake failed: ' + JSON.stringify(r).slice(0, 1500));
  mkdirSync(resolve('public/textures/portraits'), { recursive: true });
  for (const [path, data, name] of files) {
    writeFileSync(resolve('public' + path), Buffer.from(data.split(',')[1], 'base64'));
    console.log(`${name}: public${path}`);
  }
  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
