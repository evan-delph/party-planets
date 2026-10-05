import { build } from 'vite';
import { createRequire } from 'node:module';
import tailwind from '@tailwindcss/postcss';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
// Use the same PostCSS instance as the declared Tailwind integration.
const postcss = createRequire(import.meta.resolve('@tailwindcss/postcss'))(
  'postcss',
);
const result = await build({
  configFile: false,
  publicDir: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  resolve: {
    alias: { '@': resolve('.'), 'next/dynamic': 'vinext/shims/dynamic' },
  },
  build: {
    write: false,
    target: 'es2022',
    minify: true,
    lib: {
      entry: resolve('offline/main.tsx'),
      name: 'PartyPlanets',
      formats: ['iife'],
    },
    rolldownOptions: { output: { inlineDynamicImports: true } },
  },
});
const css = await postcss([tailwind()]).process(
  (await readFile('app/globals.css', 'utf8')) +
    '\n' +
    (await readFile('app/skin.css', 'utf8')) +
    (
      await Promise.all(
        ['ui-menu', 'ui-board-hud', 'ui-vote-results', 'ui-minigame-hud'].map((n) =>
          readFile(`app/${n}.css`, 'utf8'),
        ),
      )
    ).join('\n'),
  { from: resolve('app/globals.css') },
);
// Inline the web fonts the stylesheet points at.
let styles = css.css;
for (const [match, path] of [
  ...styles.matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g),
]) {
  try {
    // Paths are relative to app/globals.css, the stylesheet's origin.
    const file = path.startsWith('/') ? resolve('.' + path) : resolve('app', path);
    styles = styles.replace(
      match,
      `url(data:font/woff2;base64,${(await readFile(file)).toString('base64')})`,
    );
  } catch {
    // A missing optional subset just falls back to the system font.
  }
}
const sticker =
  'data:image/webp;base64,' +
  (await readFile('public/ufo-sticker.webp')).toString('base64');
const output = (Array.isArray(result) ? result[0] : result).output;
const js = output
  .find((file) => file.type === 'chunk')
  .code.replaceAll('/ufo-sticker.webp', sticker)
  .replace(/<\/script/gi, '<\\/script');
// Blender models, baked textures and the Draco decoder ride along as data
// URIs (game/assets.ts reads them), so the offline file looks like the site.
const MIME = {
  '.glb': 'model/gltf-binary',
  '.webp': 'image/webp',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
};
const assets = {};
for (const dir of ['models', 'textures', 'draco'])
  for (const entry of await readdir(resolve('public', dir), {
    recursive: true,
    withFileTypes: true,
  })) {
    const ext = entry.name.slice(entry.name.lastIndexOf('.'));
    if (!entry.isFile() || !MIME[ext] || entry.name === 'draco_decoder.js') continue;
    const file = resolve(entry.parentPath, entry.name);
    const url = '/' + file.slice(resolve('public').length + 1).replaceAll('\\', '/');
    assets[url] =
      `data:${MIME[ext]};base64,` + (await readFile(file)).toString('base64');
  }
const embedded = `window.__PP_ASSETS=${JSON.stringify(assets)};`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Party Planets · Offline Edition</title><style>${styles}</style></head><body><div id="root"></div><script>${embedded}</script><script>${js}</script></body></html>`;
const target = resolve(process.argv[2] ?? '../Party Planets - Offline.html');
await writeFile(target, html);
console.log(
  `Saved standalone offline game (${Math.round(html.length / 1024)} KB). All scripts, styles and 3D assets are embedded.`,
);
