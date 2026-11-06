import './style.css';
import './analytics.js';
import { t, has, onChange } from './i18n.js';
import { showToast, initPage } from './page.js';

initPage();

const storage = {
  get(area, key) { try { return area.getItem(key); } catch { return null; } },
  set(area, key, value) { try { area.setItem(key, value); } catch { /* storage disabled */ } },
};

const formatCount = (value) => {
  const count = Number(value) || 0;
  const options = { notation: count >= 10000 ? 'compact' : 'standard' };
  try { return new Intl.NumberFormat(document.documentElement.lang || 'id', options).format(count); } catch {
    return new Intl.NumberFormat('en', options).format(count);
  }
};

const updateStats = (body) => fetch('/api/stats', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}).then((response) => response.json()).catch(() => null);

// Article views, likes and shares are aggregate counters stored in Upstash Redis.
const statsBar = document.querySelector('.post-stats');
if (statsBar) {
  const slug = statsBar.dataset.slug;
  const output = {
    views: statsBar.querySelector('[data-views]'),
    likes: statsBar.querySelector('[data-likes]'),
    shares: statsBar.querySelector('[data-shares]'),
  };
  const likeButton = statsBar.querySelector('[data-like]');
  const likedKey = `inc-liked:${slug}`;
  let liked = storage.get(localStorage, likedKey) === '1';
  let enabled = false;
  const counts = { views: 0, likes: 0, shares: 0 };

  const render = () => {
    output.views.textContent = formatCount(counts.views);
    output.likes.textContent = formatCount(enabled ? counts.likes : Math.max(counts.likes, liked ? 1 : 0));
    output.shares.textContent = formatCount(counts.shares);
    likeButton.setAttribute('aria-pressed', String(liked));
  };
  const apply = (data) => {
    if (!data?.enabled) return;
    enabled = true;
    Object.assign(counts, { views: data.views, likes: data.likes, shares: data.shares });
    render();
  };

  const viewedKey = `inc-viewed:${slug}`;
  if (storage.get(sessionStorage, viewedKey) !== '1') {
    storage.set(sessionStorage, viewedKey, '1');
    updateStats({ slug, action: 'view' }).then(apply);
  } else {
    fetch(`/api/stats?slugs=${slug}`)
      .then((response) => response.json())
      .then((data) => data?.enabled && apply({ enabled: true, ...data.stats[slug] }))
      .catch(() => {});
  }

  likeButton.addEventListener('click', async () => {
    liked = !liked;
    storage.set(localStorage, likedKey, liked ? '1' : '0');
    counts.likes = Math.max(0, counts.likes + (liked ? 1 : -1));
    render();
    apply(await updateStats({ slug, action: liked ? 'like' : 'unlike' }));
  });

  const shared = async () => {
    counts.shares += 1;
    render();
    apply(await updateStats({ slug, action: 'share' }));
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(statsBar.dataset.url);
      showToast(t('share.copied'));
    } catch {
      window.prompt(has('stats.copyPrompt') ? t('stats.copyPrompt') : 'Copy this link:', statsBar.dataset.url);
    }
    shared();
  };

  statsBar.querySelector('[data-share]').addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: statsBar.dataset.title, url: statsBar.dataset.url });
        shared();
      } catch { /* sharing was cancelled */ }
      return;
    }
    copyLink();
  });
  statsBar.querySelectorAll('[data-share-link]').forEach((link) => link.addEventListener('click', shared));
  statsBar.querySelector('[data-copy]').addEventListener('click', copyLink);
  onChange(render);
  render();
}

// Rank the sidebar by aggregate views and show the three Upstash counters.
const popularList = document.querySelector('[data-popular]');
let currentPopularStats = {};
const fillPopularCounts = (stats) => {
  if (!popularList) return;
  if (stats) currentPopularStats = stats;
  for (const item of popularList.querySelectorAll('li[data-slug]')) {
    const values = currentPopularStats[item.dataset.slug] || {};
    for (const key of ['views', 'likes', 'shares']) {
      item.querySelector(`[data-${key}]`).textContent = formatCount(values[key]);
    }
  }
};
if (popularList && Array.isArray(window.INC_ARTICLES)) {
  const template = popularList.querySelector('li');
  fetch('/api/stats?popular=20').then((response) => response.json()).then(async (data) => {
    if (!data?.enabled || !template) return;
    const known = new Set(window.INC_ARTICLES);
    const current = popularList.dataset.current;
    const ranked = (data.popular || []).filter((slug) => known.has(slug) && slug !== current);
    const remaining = window.INC_ARTICLES.filter((slug) => slug !== current && !ranked.includes(slug));
    const top = [...ranked, ...remaining].slice(0, 4);
    popularList.replaceChildren(...top.map((slug) => {
      const item = template.cloneNode(true);
      item.dataset.slug = slug;
      item.querySelector('a').href = `/artikel/${slug}/`;
      item.querySelector('img').src = `/artikel/img/${slug}.webp`;
      const title = item.querySelector('.popular-title');
      title.dataset.i18n = `a.${slug}.title`;
      title.textContent = t(`a.${slug}.title`);
      return item;
    }));
    const stats = await fetch(`/api/stats?slugs=${top.join(',')}`).then((response) => response.json()).catch(() => null);
    if (stats?.enabled) fillPopularCounts(stats.stats);
  }).catch(() => {});
  onChange(() => fillPopularCounts());
}

// /artikel/: picking a category shows only its articles.
const filter = document.querySelector('[data-category-filter]');
if (filter) {
  const cards = [...document.querySelectorAll('.article-grid .article-card')];
  filter.addEventListener('click', (e) => {
    const chip = e.target.closest('.category-chip');
    if (!chip) return;
    for (const c of filter.querySelectorAll('.category-chip')) c.setAttribute('aria-pressed', String(c === chip));
    const cat = chip.dataset.category;
    for (const card of cards) card.hidden = !!cat && !card.dataset.categories.split('|').includes(cat);
  });
}

// Article text is swapped wholesale when the language changes, so the middle photo is put back
// in front of the same heading (the one the server placed it before) and its caption translated.
const body = document.querySelector('.post-body[data-mid]');
const mid = body && +body.dataset.mid;
const figure = mid && body.querySelector('.post-figure');
if (figure) {
  onChange(() => {
    const heading = body.querySelectorAll('h2')[mid - 1];
    if (heading) heading.before(figure);
    else body.append(figure);
    const cap = figure.querySelector('[data-i18n]');
    if (cap && has(cap.dataset.i18n)) cap.textContent = t(cap.dataset.i18n);
  });
}
