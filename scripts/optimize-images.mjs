// Az eredeti performancestudio.hu képeket WebP formátumba konvertálja két méretben.
// Használat: node scripts/optimize-images.mjs <forrás-mappa>
import sharp from 'sharp';
import { readdir, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const src = process.argv[2];
if (!src) {
  console.error('Add meg a forrás mappát: node scripts/optimize-images.mjs <mappa>');
  process.exit(1);
}
const out = path.resolve('public/images');
await mkdir(out, { recursive: true });

const files = await readdir(src);
const seen = new Set();
for (const f of files) {
  if (f.endsWith('.svg')) {
    await copyFile(path.join(src, f), path.join(out, 'logo.svg'));
    continue;
  }
  // performance-studio-budapest-<id>-scaled.jpg / -768x768.jpg / .jpg -> <id>
  const m = f.match(/^performance-studio-budapest-(.+?)(?:-scaled|-\d+x\d+)?\.jpg$/);
  if (!m) continue;
  const id = m[1];
  // Előnyben részesítjük a nagy felbontású (scaled) változatot
  if (seen.has(id) && !f.includes('scaled')) continue;
  seen.add(id);
  const input = path.join(src, f);
  await sharp(input).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(out, `ps-${id}.webp`));
  await sharp(input).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 72 }).toFile(path.join(out, `ps-${id}-sm.webp`));
  console.log('✓', id);
}
