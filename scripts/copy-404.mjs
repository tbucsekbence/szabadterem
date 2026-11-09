// GitHub Pages SPA fallback: a 404.html megegyezik az index.html-lel, így
// bármely aloldal (pl. /szabadterem/termeink/nagyterem) közvetlen megnyitásakor
// vagy frissítésekor a React Router veszi át az útvonalat.
import { copyFile, writeFile } from 'node:fs/promises';

await copyFile('dist/index.html', 'dist/404.html');
await writeFile('dist/.nojekyll', '');
console.log('✓ dist/404.html és dist/.nojekyll létrehozva');
