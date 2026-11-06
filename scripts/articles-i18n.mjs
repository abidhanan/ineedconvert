// Writes public/i18n/articles/id.json, the Indonesian source text of every article (titles, excerpts,
// bodies, photo captions, category names). Other languages are translations of this file.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { ARTICLES, CATEGORIES } from './articles-data.mjs';

const photos = JSON.parse(readFileSync(new URL('./photos.json', import.meta.url), 'utf8'));
const out = {};
for (const [k, v] of Object.entries(CATEGORIES)) out[`cat.${k}`] = v;
for (const a of ARTICLES) {
  out[`a.${a.slug}.title`] = a.title;
  out[`a.${a.slug}.excerpt`] = a.excerpt;
  out[`a.${a.slug}.cap0`] = photos[a.slug][0].caption;
  out[`a.${a.slug}.cap1`] = photos[a.slug][1].caption;
  out[`a.${a.slug}.body`] = a.body.trim();
}
mkdirSync('public/i18n/articles', { recursive: true });
writeFileSync('public/i18n/articles/id.json', JSON.stringify(out, null, 2) + '\n');
console.log(Object.keys(out).length, 'keys');
