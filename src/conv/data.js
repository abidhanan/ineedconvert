import { extOf, baseOf } from '../formats.js';
import { zipSync, unzipSync } from 'fflate';

const MIME = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv;charset=utf-8', tsv: 'text/tab-separated-values;charset=utf-8',
  json: 'application/json', yaml: 'application/yaml', xml: 'application/xml',
  html: 'text/html;charset=utf-8', txt: 'text/plain;charset=utf-8',
};

// ---------- spreadsheets ----------

export async function convertSheet(file, target) {
  const XLSX = await import('xlsx');
  const ext = extOf(file.name);
  const wb = ext === 'csv' || ext === 'tsv'
    ? XLSX.read(await file.text(), { type: 'string', FS: ext === 'tsv' ? '\t' : undefined, raw: false })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const base = baseOf(file.name);
  const many = wb.SheetNames.length > 1;
  const perSheet = (fn, e) => wb.SheetNames.map((s) => ({
    name: `${base}${many ? `-${s}` : ''}.${e}`,
    blob: new Blob([fn(wb.Sheets[s])], { type: MIME[e] }),
  }));
  switch (target) {
    case 'xlsx': case 'xls': case 'ods':
      return [{ name: `${base}.${target}`, blob: new Blob([XLSX.write(wb, { bookType: target === 'xls' ? 'biff8' : target, type: 'array' })], { type: MIME[target] }) }];
    case 'csv': return perSheet((s) => '﻿' + XLSX.utils.sheet_to_csv(s), 'csv');
    case 'tsv': return perSheet((s) => XLSX.utils.sheet_to_csv(s, { FS: '\t' }), 'tsv');
    case 'txt': return perSheet((s) => XLSX.utils.sheet_to_txt(s), 'txt');
    case 'html': return perSheet((s) => XLSX.utils.sheet_to_html(s), 'html');
    case 'json': {
      const obj = many
        ? Object.fromEntries(wb.SheetNames.map((s) => [s, XLSX.utils.sheet_to_json(wb.Sheets[s], { defval: null })]))
        : XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
      return [{ name: `${base}.json`, blob: new Blob([JSON.stringify(obj, null, 2)], { type: MIME.json }) }];
    }
  }
  throw new Error('err.unsupported');
}

// ---------- JSON / YAML / XML ----------

async function parse(file) {
  const ext = extOf(file.name), text = (await file.text()).replace(/^﻿/, '');
  try {
    if (ext === 'json') return JSON.parse(text);
    if (ext === 'yaml' || ext === 'yml') return (await import('js-yaml')).load(text);
    if (ext === 'xml') {
      const { XMLParser, XMLValidator } = await import('fast-xml-parser');
      const ok = XMLValidator.validate(text);
      if (ok !== true) throw new Error(ok.err?.msg || 'invalid xml');
      return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: true }).parse(text);
    }
  } catch (e) {
    throw new Error('err.data', { cause: e }); // malformed content: tell the user, not a vague failure
  }
  throw new Error('err.data');
}

const rowsOf = (data) => {
  if (Array.isArray(data)) return data.map((r) => (r && typeof r === 'object' ? flat(r) : { value: r }));
  if (data && typeof data === 'object') {
    const arr = Object.values(data).find(Array.isArray);
    return arr ? rowsOf(arr) : [flat(data)];
  }
  return [{ value: data }];
};
function flat(o, p = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) flat(v, key, out);
    else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return out;
}

export async function convertData(file, target) {
  const data = await parse(file);
  const name = `${baseOf(file.name)}.${target}`;
  let body;
  switch (target) {
    case 'json': body = JSON.stringify(data, null, 2); break;
    case 'yaml': body = (await import('js-yaml')).dump(data, { lineWidth: 120 }); break;
    case 'xml': {
      const { XMLBuilder } = await import('fast-xml-parser');
      const root = data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 1 ? data : { root: Array.isArray(data) ? { item: data } : data };
      body = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_', format: true }).build(root);
      break;
    }
    case 'csv': case 'xlsx': {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(rowsOf(data));
      if (target === 'csv') body = '﻿' + XLSX.utils.sheet_to_csv(ws);
      else {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data');
        body = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      }
      break;
    }
    default: throw new Error('err.unsupported');
  }
  return [{ name, blob: new Blob([body], { type: MIME[target] }) }];
}

// ---------- archives & universal ----------

export async function extractZip(file) {
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const out = Object.entries(files)
    .filter(([n]) => !n.endsWith('/') && !n.startsWith('__MACOSX/'))
    .map(([n, d]) => ({ name: n, blob: new Blob([d]) }));
  if (!out.length) throw new Error('err.empty');
  return out;
}

export async function toZip(file) {
  const z = zipSync({ [file.name]: new Uint8Array(await file.arrayBuffer()) }, { level: 6 });
  return [{ name: `${baseOf(file.name)}.zip`, blob: new Blob([z], { type: 'application/zip' }) }];
}

export async function toBase64(file) {
  const url = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  return [{ name: `${file.name}.base64.txt`, blob: new Blob([url.slice(url.indexOf(',') + 1)], { type: MIME.txt }) }];
}

export function zipOutputs(outputs, name) {
  const files = {};
  return Promise.all(outputs.map(async (o) => { files[o.name] = new Uint8Array(await o.blob.arrayBuffer()); }))
    .then(() => ({ name, blob: new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }) }));
}
