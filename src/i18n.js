// Language support: the HTML ships in Indonesian; other languages are fetched from /i18n/<code>.json
// and applied in place. The choice is remembered in localStorage. Same picker as ineedsave.com.
import { BY_CODE, LANGS, RTL, SCRIPT_FONT, flagSrc, match } from './languages.js';

const KEY = 'inc-lang';
const cache = {};
let current = 'id';
let strings = {};
const listeners = new Set();

export function t(key, vars) {
  let s = strings[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
export const has = (key) => key in strings;
export const lang = () => current;
export const onChange = (fn) => listeners.add(fn);

const getJson = (url) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

// Pages with their own long texts (e.g. the legal pages) name an extra bundle: /i18n/<extra>/<code>.json.
const EXTRA = (document.body.dataset.i18nExtra || '').split(' ').filter(Boolean);

function fetchStrings(code) {
  cache[code] ||= Promise.all([
    getJson(`/i18n/${code}.json`),
    ...EXTRA.map((x) => getJson(`/i18n/${x}/${code}.json`).catch(() => ({}))),
  ]).then((all) => Object.assign({}, ...all))
    .catch(() => (code === 'en' ? {} : fetchStrings('en')));
  return cache[code];
}

function fontLink(id, family, text) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;700&display=swap`
    + (text ? `&text=${encodeURIComponent(text)}` : '');
  document.head.append(link);
}

function translateDom() {
  for (const node of document.querySelectorAll('[data-i18n]')) {
    // data-i18n-date: a YYYY-MM-DD date shown as {date}, written the way the chosen language writes dates.
    const iso = node.dataset.i18nDate;
    let date;
    if (iso) try { date = new Intl.DateTimeFormat(current, { dateStyle: 'long' }).format(new Date(`${iso}T12:00:00`)); } catch { date = iso; }
    if (has(node.dataset.i18n)) node.textContent = t(node.dataset.i18n, iso ? { date } : undefined);
  }
  for (const node of document.querySelectorAll('[data-i18n-html]')) if (has(node.dataset.i18nHtml)) node.innerHTML = t(node.dataset.i18nHtml);
  for (const node of document.querySelectorAll('[data-i18n-attr]')) {
    const vars = node.dataset.i18nVars ? JSON.parse(node.dataset.i18nVars) : undefined;
    for (const pair of node.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      node.setAttribute(attr.trim(), t(key.trim(), vars));
    }
  }
  // Dates written the way the chosen language writes them.
  for (const node of document.querySelectorAll('[data-date]')) {
    try { node.textContent = new Intl.DateTimeFormat(current, { dateStyle: 'long' }).format(new Date(`${node.dataset.date}T12:00:00`)); } catch { /* keep the Indonesian date */ }
  }
  // Legal and article pages take their title from their own keys.
  const page = document.body.dataset.page;
  const slug = document.body.dataset.article;
  const titleKey = page === 'legal' ? `${document.body.dataset.legal}.title` : slug ? `a.${slug}.title` : page === 'article' ? null : 'meta.title';
  if (titleKey && has(titleKey)) {
    document.title = page === 'legal' || slug ? `${t(titleKey)} - I Need Convert` : t(titleKey);
    const descKey = page === 'legal' ? `${document.body.dataset.legal}.description` : slug ? `a.${slug}.excerpt` : 'meta.description';
    const description = has(descKey) ? t(descKey) : '';
    const meta = {
      'meta[name="description"]': description,
      'meta[property="og:title"]': document.title,
      'meta[property="og:description"]': description,
      'meta[name="twitter:title"]': document.title,
      'meta[name="twitter:description"]': description,
    };
    for (const [selector, content] of Object.entries(meta)) {
      if (content) document.querySelector(selector)?.setAttribute('content', content);
    }
  }
}

function updateButton() {
  if (!document.getElementById('lang-flag')) return;
  const l = BY_CODE[current.toLowerCase()];
  document.getElementById('lang-flag').src = flagSrc(l.flag);
  document.getElementById('lang-name').textContent = l.native;
  document.getElementById('lang-button').setAttribute('aria-label', `${t('lang.button')}: ${l.native}`);
}

async function switchTo(code) {
  const l = BY_CODE[code.toLowerCase()];
  if (!l) return;
  try { strings = await fetchStrings(l.code); } catch { return; }
  current = l.code;
  const root = document.documentElement;
  root.lang = current;
  root.dir = RTL.has(current) ? 'rtl' : 'ltr';
  const family = SCRIPT_FONT[l.script];
  if (family) fontLink(`font-${l.script}`, family);
  root.style.setProperty('--font-script', family ? `"${family}"` : '"Noto Sans"');
  translateDom();
  updateButton();
  for (const fn of listeners) fn(current);
}

// ---------- picker ----------
let menuFontsLoaded = false;
function loadMenuFonts() {
  if (menuFontsLoaded) return;
  menuFontsLoaded = true;
  const byScript = {};
  for (const l of LANGS) if (SCRIPT_FONT[l.script]) byScript[l.script] = (byScript[l.script] || '') + l.native;
  for (const [script, text] of Object.entries(byScript)) fontLink(`font-menu-${script}`, SCRIPT_FONT[script], [...new Set(text)].join(''));
}

function setupPicker() {
  const picker = document.getElementById('lang-picker');
  if (!picker) return;
  const button = document.getElementById('lang-button');
  const panel = document.getElementById('lang-panel');
  const search = document.getElementById('lang-search');
  const list = document.getElementById('lang-list');
  const empty = document.getElementById('lang-empty');
  let options = [];
  let active = -1;

  function setActive(index, scroll = true) {
    options[active]?.classList.remove('active');
    active = index;
    const option = options[active];
    if (!option) return;
    option.classList.add('active');
    search.setAttribute('aria-activedescendant', option.id);
    if (scroll) {
      const box = list.getBoundingClientRect();
      const item = option.getBoundingClientRect();
      if (item.top < box.top) list.scrollTop -= box.top - item.top;
      else if (item.bottom > box.bottom) list.scrollTop += item.bottom - box.bottom;
    }
  }

  function localName(code) {
    try { return new Intl.DisplayNames([current], { type: 'language' }).of(code) || ''; } catch { return ''; }
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const items = LANGS.filter((l) => !q || l.native.toLowerCase().includes(q)
      || l.english.toLowerCase().includes(q) || l.code.toLowerCase().startsWith(q)
      || localName(l.code).toLowerCase().includes(q));
    options = items.map((l) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'lang-option';
      option.id = `lang-opt-${l.code}`;
      option.setAttribute('role', 'option');
      option.tabIndex = -1;
      option.dataset.code = l.code;
      option.setAttribute('aria-selected', String(l.code === current));
      const flag = document.createElement('img');
      flag.className = 'flag';
      flag.alt = '';
      flag.width = 20;
      flag.height = 15;
      flag.loading = 'lazy';
      flag.src = flagSrc(l.flag);
      const label = document.createElement('span');
      label.className = 'lang-option-label';
      label.lang = l.code;
      label.textContent = l.native;
      if (SCRIPT_FONT[l.script]) label.style.fontFamily = `"Noto Sans", "${SCRIPT_FONT[l.script]}", sans-serif`;
      option.append(flag, label);
      return option;
    });
    list.replaceChildren(...options);
    empty.hidden = options.length > 0;
    active = -1;
    setActive(q ? 0 : options.findIndex((o) => o.dataset.code === current), false);
  }

  function open() {
    loadMenuFonts();
    search.value = '';
    render();
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    const selected = options[active];
    if (selected) list.scrollTop = selected.offsetTop - list.clientHeight / 2 + selected.offsetHeight / 2;
    if (matchMedia('(hover: hover)').matches) search.focus({ preventScroll: true });
  }

  function close(focusButton = false) {
    if (panel.hidden) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) button.focus({ preventScroll: true });
  }

  function choose(code) {
    close(true);
    if (code === current) return;
    try { localStorage.setItem(KEY, code); } catch { /* storage disabled */ }
    switchTo(code);
  }

  button.addEventListener('click', () => (panel.hidden ? open() : close()));
  search.addEventListener('input', render);
  list.addEventListener('click', (e) => { const o = e.target.closest('.lang-option'); if (o) choose(o.dataset.code); });
  list.addEventListener('mousemove', (e) => {
    const index = options.indexOf(e.target.closest('.lang-option'));
    if (index >= 0 && index !== active) setActive(index, false);
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' && options[active]) { e.preventDefault(); choose(options[active].dataset.code); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(true); });
  document.addEventListener('pointerdown', (e) => { if (!picker.contains(e.target)) close(); });
}

// Saved choice first, then the browser's languages, then Indonesian (the page's own language).
function initialLanguage() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage disabled */ }
  if (match(saved)) return match(saved);
  for (const tag of navigator.languages || [navigator.language]) { const m = match(tag); if (m) return m; }
  return 'id';
}

setupPicker();
export const ready = switchTo(initialLanguage());
