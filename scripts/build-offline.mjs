import { build } from 'vite';
import { createRequire } from 'node:module';
import tailwind from '@tailwindcss/postcss';
import { readFile, writeFile } from 'node:fs/promises';
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
  await readFile('app/globals.css', 'utf8'),
  { from: resolve('app/globals.css') },
);
const sticker =
  'data:image/webp;base64,' +
  (await readFile('public/ufo-sticker.webp')).toString('base64');
const output = (Array.isArray(result) ? result[0] : result).output;
const js = output
  .find((file) => file.type === 'chunk')
  .code.replaceAll('/ufo-sticker.webp', sticker)
  .replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Party Planets · Offline Edition</title><style>${css.css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
const target = resolve(process.argv[2] ?? '../Party Planets - Offline.html');
await writeFile(target, html);
console.log(
  `Saved standalone offline game (${Math.round(html.length / 1024)} KB). All scripts, styles and 3D assets are embedded.`,
);
