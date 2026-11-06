// Builds the article pages (artikel/…/index.html) and the home-page article cards.
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTICLES, CATEGORIES } from './articles-data.mjs';
import { header, footer } from './partials.mjs';
import { LEGAL_ID } from './legal-id.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://ineedconvert.com';
// Versioning forces social crawlers to refresh a previously cached preview image.
const SOCIAL_IMAGE = '/og-image.png?v=3';
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtDate = (d) => { const [y, m, day] = d.split('-'); return `${+day} ${MONTHS[+m - 1]} ${y}`; };
const img = (a) => `/artikel/img/${a.slug}.webp`;
// Photo credits (CC0 photos found through Openverse): [cover, middle] per article.
const PHOTOS = JSON.parse(readFileSync(resolve(ROOT, 'scripts/photos.json'), 'utf8'));

function figure(a, n, cls) {
  const p = PHOTOS[a.slug]?.[n];
  const src = n === 0 ? img(a) : `/artikel/img/${a.slug}-2.webp`;
  const alt = p?.caption || a.title;
  const load = n === 0 ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  return `<figure class="${cls}">
          <img src="${src}" alt="${esc(alt)}" width="1200" height="630" ${load}>
          ${p ? `<figcaption>
            <span class="caption-text" data-i18n="a.${a.slug}.cap${n}">${esc(p.caption)}</span>
            <span class="caption-credit">Foto: <a href="${esc(p.page)}" target="_blank" rel="noopener">${esc(p.creator)}</a></span>
          </figcaption>` : ''}
        </figure>`;
}

// Second photo goes before the heading nearest the middle of the article.
function withMiddlePhoto(a) {
  const parts = a.body.trim().split('<h2>');
  if (parts.length < 3) return a.body.trim();
  const at = Math.ceil((parts.length - 1) / 2);
  return [parts.slice(0, at).join('<h2>'), `${figure(a, 1, 'post-figure')}\n<h2>` + parts.slice(at).join('<h2>')].join('');
}

// Index of the heading the middle photo sits in front of (1-based), so it can be put back after a language switch.
const middleAt = (a) => { const n = a.body.trim().split('<h2>').length; return n < 3 ? 0 : Math.ceil((n - 1) / 2); };

const ICON_CAL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>';
const ICON_ARROW = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';

const tags = (a) => `<div class="article-tags">${a.cats.map((c) => `<span data-i18n="cat.${c}">${CATEGORIES[c]}</span>`).join('')}</div>`;

export function card(a, { excerpt = true } = {}) {
  return `<article class="article-card" data-categories="${a.cats.join('|')}">
          <a class="article-link" href="/artikel/${a.slug}/">
            <div class="article-thumb"><img src="${img(a)}" alt="${esc(a.title)}" width="1200" height="630" loading="lazy" decoding="async"></div>
            <div class="article-body">
              ${tags(a)}
              <h3 class="article-title" data-i18n="a.${a.slug}.title">${esc(a.title)}</h3>
              ${excerpt ? `<p class="article-excerpt" data-i18n="a.${a.slug}.excerpt">${esc(a.excerpt)}</p>
              <div class="article-meta">${ICON_CAL}<time datetime="${a.date}T08:00:00+07:00" data-date="${a.date}">${fmtDate(a.date)}</time></div>` : ''}
              <span class="article-more"><span data-i18n="articles.readMore">Baca Selengkapnya</span>${ICON_ARROW}</span>
            </div>
          </a>
        </article>`;
}

export const homeCards = () => ARTICLES.map((a) => card(a)).join('\n        ');


const AUTHOR = { '@type': 'Person', '@id': `${SITE}/#author`, name: 'Abid Hanan Wicaksono', url: 'https://abidhanan.my.id' };
const ORGANIZATION = { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'I Need Convert', url: `${SITE}/` };
const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

function head({ title, description, url, image, type = 'website', schema }) {
  const socialImage = `${SITE}${image || SOCIAL_IMAGE}`;
  return `<!doctype html>
<html lang="id" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <meta name="author" content="Abid Hanan Wicaksono">
  <meta name="application-name" content="I Need Convert">
  <meta name="apple-mobile-web-app-title" content="I Need Convert">
  <meta name="format-detection" content="telephone=no">
  <meta name="theme-color" content="#0A0A0A">
  <meta name="color-scheme" content="dark">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="${type}">
  <meta property="og:locale" content="id_ID">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="I Need Convert">
  <meta property="og:image" content="${socialImage}">
  <meta property="og:image:secure_url" content="${socialImage}">
  <meta property="og:image:type" content="${image ? 'image/webp' : 'image/png'}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(title)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${socialImage}">
  <meta name="twitter:image:alt" content="${esc(title)}">
  <link rel="author" href="https://abidhanan.my.id">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="/fonts/noto-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="manifest" href="/manifest.webmanifest">
  ${schema ? `<script type="application/ld+json">${json(schema)}</script>` : ''}
</head>`;
}

const SHARE = [
  ['WhatsApp', (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`, '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>'],
  ['Facebook', (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`, '<path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/>'],
  ['X', (u, t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`, '<path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/>'],
  ['LinkedIn', (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`, '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>'],
  ['Telegram', (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`, '<path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>'],
];
const ICON_LINK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>';
const ICON_EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_HEART = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
const ICON_SHARE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>';

function statsBar(a, url) {
  const share = SHARE.map(([name, link, path]) => `<a class="social" href="${esc(link(url, a.title))}" target="_blank" rel="noopener" data-share-link data-i18n-attr="aria-label:share.via" data-i18n-vars='{"name":"${name}"}' aria-label="Bagikan lewat ${name}"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">${path}</svg></a>`).join('\n            ');
  return `<div class="post-stats" data-slug="${a.slug}" data-url="${url}" data-title="${esc(a.title)}">
          <div class="stats-left">
            <span class="stat" data-i18n-attr="title:stats.views" title="Tayangan">${ICON_EYE}<span class="stat-count" data-views>0</span><span class="sr-only" data-i18n="stats.viewsSr">tayangan</span></span>
            <button class="stat stat-button" type="button" data-like aria-pressed="false" data-i18n-attr="aria-label:stats.like" aria-label="Sukai artikel ini">${ICON_HEART}<span class="stat-count" data-likes>0</span></button>
            <button class="stat stat-button" type="button" data-share data-i18n-attr="aria-label:stats.share" aria-label="Bagikan artikel ini">${ICON_SHARE}<span class="stat-count" data-shares>0</span></button>
          </div>
          <div class="socials share-links">
            ${share}
            <button class="social" type="button" data-copy data-i18n-attr="aria-label:share.copy" aria-label="Salin tautan">${ICON_LINK}</button>
          </div>
        </div>`;
}

const cta = `<div class="container cta-wrap">
      <aside class="post-cta">
        <p data-i18n="articles.cta">Konversi gambar, video, audio, dokumen, dan file lainnya secara gratis, langsung di browser.</p>
        <a class="btn btn-primary" href="/" data-i18n="articles.ctaButton">Coba Sekarang</a>
      </aside>
    </div>`;

function articlePage(a, i) {
  const url = `${SITE}/artikel/${a.slug}/`;
  const others = ARTICLES.filter((x) => x !== a);
  const popular = others.slice(0, 4);
  const related = [...ARTICLES.slice(i + 1), ...ARTICLES.slice(0, i)].slice(0, 3);
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION,
      {
        '@type': 'Article', '@id': `${url}#article`, headline: a.title, description: a.excerpt,
        image: `${SITE}${img(a)}`, datePublished: `${a.date}T08:00:00+07:00`, dateModified: `${a.date}T08:00:00+07:00`,
        mainEntityOfPage: url, inLanguage: 'id-ID', author: AUTHOR, publisher: { '@id': `${SITE}/#organization` },
      },
      {
        '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Beranda', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Artikel', item: `${SITE}/artikel/` },
          { '@type': 'ListItem', position: 3, name: a.title, item: url },
        ],
      },
    ],
  };
  return `${head({ title: `${a.title} - I Need Convert`, description: a.excerpt, url, image: img(a), type: 'article', schema })}
<body data-page="article" data-article="${a.slug}" data-i18n-extra="articles">
  ${header({ home: false, current: 'artikel' })}

  <main id="main" tabindex="-1" class="article-page pattern-dots">
    <div class="container post-layout">
      <div class="post-main">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><a href="/" data-i18n="articles.home">Beranda</a></li>
          <li><a href="/artikel/" data-i18n="articles.title">Artikel</a></li>
          <li aria-current="page" data-i18n="a.${a.slug}.title">${esc(a.title)}</li>
        </ol>
      </nav>
      <article class="post" lang="id">
        <header class="post-head">
          ${tags(a)}
          <h1 data-i18n="a.${a.slug}.title">${esc(a.title)}</h1>
          <p class="post-meta">${ICON_CAL}<time datetime="${a.date}T08:00:00+07:00" data-date="${a.date}">${fmtDate(a.date)}</time></p>
        </header>
        ${figure(a, 0, 'post-cover')}
        <div class="post-body" data-mid="${middleAt(a)}" data-i18n-html="a.${a.slug}.body">
${withMiddlePhoto(a)}
        </div>
        ${statsBar(a, url)}
      </article>
      </div>
      <aside class="popular" aria-labelledby="popular-title">
        <h2 id="popular-title" data-i18n="articles.popular">Artikel Populer</h2>
        <ol class="popular-list" data-popular data-current="${a.slug}">
          ${popular.map((p) => `<li data-slug="${p.slug}"><a class="popular-item" href="/artikel/${p.slug}/"><img src="${img(p)}" alt="" width="96" height="50" loading="lazy" decoding="async"><span class="popular-text"><span class="popular-title" data-i18n="a.${p.slug}.title">${esc(p.title)}</span><span class="popular-stats"><span class="mini-stat">${ICON_EYE}<span data-views>0</span></span><span class="mini-stat">${ICON_HEART}<span data-likes>0</span></span><span class="mini-stat">${ICON_SHARE}<span data-shares>0</span></span></span></span></a></li>`).join('\n          ')}
        </ol>
      </aside>
    </div>
    ${cta}
    <section class="related" aria-labelledby="related-title">
      <div class="container">
        <div class="related-head">
          <h2 id="related-title" data-i18n="articles.other">Artikel Lainnya</h2>
          <a class="btn btn-outline" href="/artikel/" data-i18n="articles.seeAll">Lihat Semua</a>
        </div>
        <div class="article-grid">
        ${related.map((r) => card(r)).join('\n        ')}
        </div>
      </div>
    </section>
  </main>

  ${footer()}
  <script>window.INC_ARTICLES=${json(ARTICLES.map(({ slug }) => slug))};</script>
  <script type="module" src="/src/article.js"></script>
</body>
</html>
`;
}

function listPage() {
  const used = Object.keys(CATEGORIES).filter((c) => ARTICLES.some((a) => a.cats.includes(c)));
  const url = `${SITE}/artikel/`;
  const schema = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Artikel I Need Convert', url,
    description: 'Tips dan panduan mengonversi gambar, video, audio, dokumen, dan file lainnya.',
    inLanguage: 'id-ID', isPartOf: { '@id': `${SITE}/#website` },
  };
  return `${head({ title: 'Artikel - I Need Convert', description: 'Tips dan panduan mengonversi gambar, video, audio, dokumen, dan file lainnya.', url, schema })}
<body data-page="article" data-i18n-extra="articles">
  ${header({ home: false, current: 'artikel' })}

  <main id="main" tabindex="-1" class="article-page pattern-dots">
    <div class="container">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><a href="/" data-i18n="articles.home">Beranda</a></li>
          <li aria-current="page" data-i18n="articles.title">Artikel</li>
        </ol>
      </nav>
      <header class="list-head">
        <h1 data-i18n="articles.title">Artikel</h1>
      </header>
      <div class="category-filter" role="group" data-i18n-attr="aria-label:articles.categories" aria-label="Kategori" data-category-filter>
        <button class="category-chip" type="button" data-category="" aria-pressed="true" data-i18n="articles.allCategories">Semua</button>
        ${used.map((c) => `<button class="category-chip" type="button" data-category="${c}" aria-pressed="false" data-i18n="cat.${c}">${CATEGORIES[c]}</button>`).join('\n        ')}
      </div>
      <div class="article-grid">
        ${ARTICLES.map((a) => card(a)).join('\n        ')}
      </div>
    </div>
    ${cta}
    <div class="list-bottom"></div>
  </main>

  ${footer()}
  <script type="module" src="/src/article.js"></script>
</body>
</html>
`;
}

const LEGAL_DATE = '2026-10-21';

function legalPage(kind, path) {
  const title = LEGAL_ID[`${kind}.title`];
  const url = `${SITE}${path}`;
  const schema = {
    '@context': 'https://schema.org', '@type': 'WebPage', name: title, url,
    description: LEGAL_ID[`${kind}.description`], inLanguage: 'id-ID', isPartOf: { '@id': `${SITE}/#website` },
  };
  return `${head({ title: `${title} - I Need Convert`, description: LEGAL_ID[`${kind}.description`], url, schema })}
<body data-page="legal" data-legal="${kind}" data-i18n-extra="legal">
  ${header({ home: false })}

  <main id="main" tabindex="-1" class="article-page pattern-dots">
    <div class="container narrow legal-layout">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><a href="/" data-i18n="articles.home">Beranda</a></li>
          <li aria-current="page" data-i18n="${kind}.title">${esc(title)}</li>
        </ol>
      </nav>
      <article class="post legal">
        <header class="post-head">
          <h1 data-i18n="${kind}.title">${esc(title)}</h1>
          <p class="post-meta">${ICON_CAL}<span data-i18n="legal.effective" data-i18n-date="${LEGAL_DATE}">Berlaku sejak ${fmtDate(LEGAL_DATE)}</span></p>
        </header>
        <div class="post-body legal-body" data-i18n-html="${kind}.body">
          ${LEGAL_ID[`${kind}.body`]}
        </div>
      </article>
    </div>
  </main>

  ${footer()}
  <script type="module" src="/src/article.js"></script>
</body>
</html>
`;
}

export function generate() {
  for (const dir of ['artikel', 'kebijakan-privasi', 'syarat-ketentuan']) rmSync(resolve(ROOT, dir), { recursive: true, force: true });
  mkdirSync(resolve(ROOT, 'public/artikel/img'), { recursive: true });
  const inputs = { main: resolve(ROOT, 'index.html') };
  const write = (rel, html, key) => {
    const file = resolve(ROOT, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    inputs[key] = file;
  };
  write('artikel/index.html', listPage(), 'artikel');
  write('kebijakan-privasi/index.html', legalPage('privacy', '/kebijakan-privasi/'), 'privacy');
  write('syarat-ketentuan/index.html', legalPage('terms', '/syarat-ketentuan/'), 'terms');
  ARTICLES.forEach((a, i) => {
    write(`artikel/${a.slug}/index.html`, articlePage(a, i), a.slug);
  });
  return inputs;
}
