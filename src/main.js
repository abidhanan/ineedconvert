import './style.css';
import './analytics.js';
import { t, has, onChange } from './i18n.js';
import { initPage, showToast } from './page.js';
import { kindOf, targetsFor, extOf, baseOf } from './formats.js';

const $ = (s) => document.querySelector(s);
const drop = $('#drop'), input = $('#file'), list = $('#files'), results = $('#results');

let avif = true;
let uid = 0;
const items = new Map();

// ---------- helpers ----------

const fmtSize = (n) => {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB'];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`;
};

const labelOf = (target) => (target === 'extract' || target === 'base64' ? t(`target.${target}`) : target.toUpperCase());

function save({ name, blob }) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name.split('/').pop() });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

const ICON_X = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const CHEV = '<svg class="chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5"/></svg>';

// ---------- conversion dispatch ----------

async function convert(file, target, progress) {
  if (target === 'zip') return (await import('./conv/data.js')).toZip(file);
  if (target === 'base64') return (await import('./conv/data.js')).toBase64(file);
  if (target === 'extract') return (await import('./conv/data.js')).extractZip(file);
  switch (kindOf(file)) {
    case 'image': return (await import('./conv/image.js')).convertImage(file, target, progress);
    case 'video': case 'audio': return (await import('./conv/ffmpeg.js')).convertMedia(file, target, progress);
    case 'pdf': case 'doc': return (await import('./conv/docs.js')).convertDoc(file, target, progress);
    case 'sheet': return (await import('./conv/data.js')).convertSheet(file, target);
    case 'data': return (await import('./conv/data.js')).convertData(file, target);
  }
  throw new Error('err.unsupported');
}

// ---------- format dropdown (same look as the language picker; chevron turns on open/close) ----------

let openDropdown = null;

function dropdown(groups, value, onSelect) {
  const root = el('div', 'dd');
  const button = el('button', 'dd-button', `<span class="dd-value"></span>${CHEV}`);
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  const panel = el('div', 'dd-panel');
  panel.hidden = true;
  panel.setAttribute('role', 'listbox');
  root.append(button, panel);

  const options = [];
  const titles = [];
  for (const g of groups) {
    if (!g.options.length) continue;
    const title = el('p', 'dd-title');
    titles.push([title, g.key]);
    const grid = el('div', 'dd-grid');
    for (const v of g.options) {
      const o = el('button', 'dd-option');
      o.type = 'button';
      o.setAttribute('role', 'option');
      o.dataset.value = v;
      grid.append(o);
      options.push(o);
    }
    panel.append(title, grid);
  }

  const api = {
    root,
    value,
    set(v) {
      api.value = v;
      for (const o of options) o.setAttribute('aria-selected', String(o.dataset.value === v));
      button.querySelector('.dd-value').textContent = labelOf(v);
    },
    translate() {
      for (const [title, key] of titles) title.textContent = t(key);
      for (const o of options) {
        const label = labelOf(o.dataset.value);
        o.textContent = label;
        // Longer labels take more columns, so nothing is ever cut off.
        const len = [...label].length;
        o.style.gridColumn = len > 12 ? '1 / -1' : len > 6 ? 'span 2' : '';
      }
      button.querySelector('.dd-value').textContent = labelOf(api.value);
    },
    disable(d) { button.disabled = d; if (d) close(); },
  };

  function open() {
    if (openDropdown && openDropdown !== close) openDropdown();
    panel.hidden = false;
    root.classList.remove('dd-up');
    const r = panel.getBoundingClientRect();
    if (r.bottom > innerHeight - 8) {
      // Not enough room below: open upwards, or scroll just enough to show the whole menu.
      if (panel.parentElement.getBoundingClientRect().top > r.height + 80) root.classList.add('dd-up');
      else scrollBy({ top: r.bottom - innerHeight + 12, behavior: 'smooth' });
    }
    void panel.offsetWidth; // commit the closed state so the fade-in runs
    root.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    openDropdown = close;
    (options.find((o) => o.dataset.value === api.value) || options[0])?.focus({ preventScroll: true });
  }
  function close(focus = false) {
    if (panel.hidden) return;
    root.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    if (openDropdown === close) openDropdown = null;
    if (focus) button.focus({ preventScroll: true });
  }

  button.addEventListener('click', () => (panel.hidden ? open() : close()));
  panel.addEventListener('click', (e) => {
    const o = e.target.closest('.dd-option');
    if (!o) return;
    api.set(o.dataset.value);
    close(true);
    onSelect(o.dataset.value);
  });
  panel.addEventListener('keydown', (e) => {
    const i = options.indexOf(document.activeElement);
    const cols = Math.max(1, Math.round(panel.querySelector('.dd-grid').clientWidth / (options[0]?.offsetWidth || 1)));
    const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (move) { e.preventDefault(); options[Math.max(0, Math.min(options.length - 1, i + move))]?.focus(); }
    else if (e.key === 'Escape') { e.stopPropagation(); close(true); }
    else if (e.key === 'Tab') close();
  });
  document.addEventListener('pointerdown', (e) => { if (!root.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  api.set(value);
  api.translate();
  return api;
}

// ---------- file rows ----------

function kindLabel(kind) { return t(`kind.${kind || 'file'}`); }

function addFiles(files) {
  for (const file of files) {
    const id = ++uid;
    const { kind, list: targets, universal } = targetsFor(file, { avif });
    const row = el('li', 'file');
    const icon = el('div', 'file-icon', (extOf(file.name) || '?').slice(0, 4));
    if (kind === 'image' && /^image\/(png|jpe?g|webp|gif|svg|avif|bmp)/.test(file.type)) {
      const img = new Image();
      img.alt = '';
      img.src = URL.createObjectURL(file);
      img.onload = img.onerror = () => URL.revokeObjectURL(img.src);
      icon.textContent = '';
      icon.append(img);
    }
    const info = el('div', 'file-info');
    const name = el('p', 'file-name');
    name.textContent = file.name;
    name.title = file.name;
    const detail = el('p', 'file-detail');
    info.append(name, detail);

    const controls = el('div', 'file-controls');
    const to = el('span', 'file-to');
    const item = { id, file, kind, row, detail, to, busy: false, state: { key: 'base' } };
    item.dd = dropdown([
      { key: `kind.${kind || 'file'}`, options: targets },
      { key: 'kind.other', options: universal },
    ], targets[0] || universal[0], () => setState(item, { key: 'base' }));
    const btn = el('button', 'btn btn-primary btn-sm', '<span class="btn-label"></span><span class="spinner" aria-hidden="true"></span>');
    btn.type = 'button';
    const remove = el('button', 'file-remove', ICON_X);
    remove.type = 'button';
    controls.append(to, item.dd.root, btn, remove);

    const bar = el('div', 'progress', '<span></span>');
    bar.hidden = true;
    row.append(icon, info, controls, bar);
    list.append(row);

    Object.assign(item, { btn, remove, bar, name: file.name });
    items.set(id, item);
    translateItem(item);
    btn.addEventListener('click', () => run(item));
    remove.addEventListener('click', () => { if (item.busy) return; items.delete(id); row.remove(); sync(); });

    if (kind === 'video' || kind === 'audio' || ['gif', 'tif', 'tiff'].includes(extOf(file.name))) {
      import('./conv/ffmpeg.js').then((m) => m.preload());
    }
  }
  sync();
  results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Status line kept as data so it can be re-rendered when the language changes.
function setState(item, state) { item.state = state; renderState(item); }
function renderState(item) {
  const s = item.state;
  const d = item.detail;
  let text;
  switch (s.key) {
    case 'base': text = `${fmtSize(item.file.size)} · ${kindLabel(item.kind)}`; break;
    case 'busy': text = t('file.converting', { fmt: labelOf(s.target) }) + (s.p != null ? ` ${Math.round(s.p * 100)}%` : ''); break;
    case 'done': text = `${t('file.done', { s: s.secs })} · ${s.count > 1 ? t('file.nFiles', { n: s.count }) : fmtSize(s.size)}`; break;
    case 'error': text = has(s.msg) ? t(s.msg) : t('file.failed'); break;
  }
  d.textContent = text;
  d.classList.toggle('is-error', s.key === 'error');
  d.classList.toggle('is-done', s.key === 'done');
}

function translateItem(item) {
  item.to.textContent = t('file.to');
  item.btn.querySelector('.btn-label').textContent = t('file.convert');
  item.remove.setAttribute('aria-label', t('file.remove', { name: item.name }));
  item.dd.root.querySelector('.dd-button').setAttribute('aria-label', t('file.targetFor', { name: item.name }));
  item.dd.translate();
  renderState(item);
}

function sync() {
  results.hidden = items.size === 0;
  $('#convert-all').disabled = ![...items.values()].some((i) => !i.busy);
}

async function run(item) {
  if (item.busy) return;
  const target = item.dd.value;
  item.busy = true;
  item.btn.disabled = true;
  item.btn.classList.add('is-busy');
  item.dd.disable(true);
  item.bar.hidden = false;
  item.bar.classList.add('is-indeterminate');
  const fill = item.bar.firstElementChild;
  fill.style.width = '';
  setState(item, { key: 'base' });
  try {
    const outputs = await convert(item.file, target, (p) => {
      item.bar.classList.remove('is-indeterminate');
      fill.style.width = `${Math.round(p * 100)}%`;
    });
    await deliver(item, outputs, target);
  } catch (err) {
    console.error(err);
    setState(item, { key: 'error', msg: err?.message });
  } finally {
    item.busy = false;
    item.btn.disabled = false;
    item.btn.classList.remove('is-busy');
    item.dd.disable(false);
    item.bar.hidden = true;
    item.bar.classList.remove('is-indeterminate');
    sync();
  }
}

// One file downloads straight away; several (PDF pages, spreadsheet sheets) come as a single ZIP.
async function deliver(item, outputs, target) {
  if (outputs.length === 1) return save(outputs[0]);
  if (target === 'extract') {
    for (const o of outputs) { save(o); await new Promise((r) => setTimeout(r, 350)); }
    return;
  }
  const { zipOutputs } = await import('./conv/data.js');
  save(await zipOutputs(outputs, `${baseOf(item.file.name)}-${target}.zip`));
}

onChange(() => { for (const item of items.values()) translateItem(item); });

// ---------- events ----------

const pick = () => input.click();
drop.addEventListener('click', pick);
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
input.addEventListener('change', () => { if (input.files.length) addFiles([...input.files]); input.value = ''; });

let depth = 0;
addEventListener('dragenter', (e) => { if (e.dataTransfer?.types.includes('Files')) { depth++; drop.classList.add('is-over'); } });
addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; drop.classList.remove('is-over'); } });
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => {
  e.preventDefault();
  depth = 0;
  drop.classList.remove('is-over');
  const files = [...(e.dataTransfer?.files || [])];
  if (files.length) addFiles(files);
});
addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) { addFiles(files); showToast(t('results.pasted', { n: files.length })); }
});

$('#convert-all').addEventListener('click', async () => {
  for (const item of [...items.values()]) if (!item.busy) await run(item);
  showToast(t('results.allDone'));
});
$('#clear-all').addEventListener('click', () => {
  for (const [id, item] of items) if (!item.busy) { item.row.remove(); items.delete(id); }
  sync();
});

// ---------- articles carousel: moves on its own every few seconds (same as ineedsave) ----------

const track = document.querySelector('.carousel-track');
if (track) {
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rtl = () => document.documentElement.dir === 'rtl';
  const step = () => (track.firstElementChild?.getBoundingClientRect().width || 0) + parseFloat(getComputedStyle(track).columnGap || 0);
  const atEnd = () => Math.abs(track.scrollLeft) + track.clientWidth >= track.scrollWidth - 4;
  setInterval(() => {
    if (document.hidden) return;
    const behavior = reduced() ? 'auto' : 'smooth';
    if (atEnd()) track.scrollTo({ left: 0, behavior });
    else track.scrollBy({ left: step() * (rtl() ? -1 : 1), behavior });
  }, 4000);
}

initPage();
// Detect AVIF support without loading the image and media conversion modules.
// Those modules stay off the critical path until a user selects a file.
{
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  canvas.toBlob((blob) => { avif = blob?.type === 'image/avif'; }, 'image/avif');
}
