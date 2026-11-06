// One-off helper: downloads the chosen CC0 photos, crops them to 1200×630 WebP, and writes
// scripts/photos.json with the credits. Usage: node scripts/fetch-photos.mjs <results.json> <picks.json>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const [results, picks] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')));
const SOURCE = { stocksnap: 'StockSnap', rawpixel: 'rawpixel', wikimedia: 'Wikimedia Commons', flickr: 'Flickr' };
mkdirSync('public/artikel/img', { recursive: true });
const credits = {};

await Promise.all(Object.entries(picks).map(async ([slug, list]) => {
  credits[slug] = [];
  for (const [i, [key, idx, caption]] of list.entries()) {
    const p = results[key][idx];
    const res = await fetch(p.url, { headers: { 'User-Agent': 'ineedconvert-build/1.0' } });
    if (!res.ok) throw new Error(`${slug} ${key}#${idx}: HTTP ${res.status}`);
    const out = `public/artikel/img/${slug}${i ? '-2' : ''}.webp`;
    await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize(1200, 630, { fit: 'cover', position: 'attention' }).webp({ quality: 78 }).toFile(out);
    credits[slug][i] = { caption, creator: p.creator || SOURCE[p.src] || p.src, source: SOURCE[p.src] || p.src, page: p.page };
    console.log('ok', out);
  }
}));
writeFileSync('scripts/photos.json', JSON.stringify(credits, null, 2) + '\n');
