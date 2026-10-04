// Download the CC0 source textures listed in art/assets.json from Poly Haven.
// Usage: node scripts/fetch-assets.mjs [asset ids…]
// Files are verified against Poly Haven's published MD5 sums and cached in art/source/.
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const manifest = JSON.parse(await readFile('art/assets.json', 'utf8'));
const only = process.argv.slice(2);
const md5 = (buffer) => createHash('md5').update(buffer).digest('hex');

for (const [id, { res }] of Object.entries(manifest.textures)) {
  if (only.length && !only.includes(id)) continue;
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  const dir = join('art', 'source', 'polyhaven', id);
  await mkdir(dir, { recursive: true });
  for (const map of manifest.maps) {
    const entry = files[map]?.[res]?.jpg;
    if (!entry) {
      console.warn(`  ${id}: no ${map} at ${res}`);
      continue;
    }
    const target = join(dir, `${id}_${map}_${res}.jpg`);
    const existing = await stat(target).catch(() => null);
    if (existing?.size === entry.size && md5(await readFile(target)) === entry.md5) continue;
    const data = Buffer.from(await (await fetch(entry.url)).arrayBuffer());
    if (md5(data) !== entry.md5) throw Error(`Checksum mismatch for ${entry.url}`);
    await writeFile(target, data);
    console.log(`  ${id} ${map} ${res} (${Math.round(data.length / 1024)} KB)`);
  }
}
console.log('Assets ready in art/source/polyhaven/');
