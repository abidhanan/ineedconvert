import { extOf, baseOf } from '../formats.js';
import { zipSync, strToU8 } from 'fflate';

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const textBlob = (s, type = 'text/plain') => new Blob([s], { type: `${type};charset=utf-8` });

const wrapHtml = (title, body) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:820px;margin:40px auto;padding:0 20px;line-height:1.6}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}</style>
</head><body>
${body}
</body></html>`;

// ---------- reading: every document becomes a list of blocks {type, text} plus HTML ----------

function blocksFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks = [];
  const walk = (el) => {
    for (const n of el.children) {
      const tag = n.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) blocks.push({ type: 'h', level: +tag[1], text: n.textContent.trim() });
      else if (tag === 'li') blocks.push({ type: 'li', text: n.textContent.trim() });
      else if (tag === 'p' || tag === 'pre' || tag === 'blockquote') {
        blocks.push({ type: tag === 'pre' ? 'pre' : 'p', text: n.textContent.trim() });
      } else if (tag === 'tr') blocks.push({ type: 'p', text: [...n.children].map((c) => c.textContent.trim()).join('    ') });
      else if (['script', 'style', 'head', 'title', 'meta'].includes(tag)) continue;
      else if (n.children.length) walk(n);
      else if (n.textContent.trim()) blocks.push({ type: 'p', text: n.textContent.trim() });
    }
  };
  walk(doc.body);
  return blocks.filter((b) => b.text);
}

const blocksFromText = (t) => t.replace(/\r\n?/g, '\n').split(/\n{2,}/).map((p) => ({ type: 'p', text: p.trim() })).filter((b) => b.text);

const blocksToText = (blocks) => blocks.map((b) => (b.type === 'li' ? `• ${b.text}` : b.text)).join('\n\n');

const blocksToMd = (blocks) => blocks.map((b) => (b.type === 'h' ? `${'#'.repeat(b.level)} ${b.text}` : b.type === 'li' ? `- ${b.text}` : b.type === 'pre' ? '```\n' + b.text + '\n```' : b.text)).join('\n\n');

const blocksToHtml = (blocks) => blocks.map((b) => (b.type === 'h' ? `<h${b.level}>${esc(b.text)}</h${b.level}>` : b.type === 'li' ? `<ul><li>${esc(b.text)}</li></ul>` : b.type === 'pre' ? `<pre>${esc(b.text)}</pre>` : `<p>${esc(b.text).replace(/\n/g, '<br>')}</p>`)).join('\n');

async function readPdf(file) {
  const pdfjs = await import('./pdfjs.js').then((m) => m.load());
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  return { pdf, pdfjs };
}

async function pdfBlocks(file, progress) {
  const { pdf } = await readPdf(file);
  const blocks = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    let text = '';
    for (const it of tc.items) text += it.str + (it.hasEOL ? '\n' : '');
    blocks.push(...blocksFromText(text));
    progress?.(i / pdf.numPages);
  }
  return blocks;
}

async function readDoc(file, progress) {
  const ext = extOf(file.name);
  if (ext === 'pdf') { const b = await pdfBlocks(file, progress); return { blocks: b, html: blocksToHtml(b) }; }
  if (ext === 'docx') {
    const mammoth = (await import('mammoth')).default;
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return { blocks: blocksFromHtml(value), html: value };
  }
  const text = await file.text();
  if (ext === 'md' || ext === 'markdown') {
    const { marked } = await import('marked');
    const html = await marked.parse(text);
    return { blocks: blocksFromHtml(html), html, md: text };
  }
  if (ext === 'html' || ext === 'htm') {
    const body = new DOMParser().parseFromString(text, 'text/html').body.innerHTML;
    return { blocks: blocksFromHtml(text), html: body };
  }
  const blocks = blocksFromText(text);
  return { blocks, html: blocksToHtml(blocks), text };
}

// ---------- writing ----------

function blocksToPdf(jsPDF, blocks) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const m = 56, W = doc.internal.pageSize.getWidth() - m * 2, H = doc.internal.pageSize.getHeight();
  let y = m;
  const clean = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/•/g, '-');
  for (const b of blocks) {
    const size = b.type === 'h' ? [0, 22, 18, 15, 13, 12, 12][b.level] : 11;
    doc.setFont(b.type === 'pre' ? 'courier' : 'helvetica', b.type === 'h' ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean(b.type === 'li' ? `•  ${b.text}` : b.text), W);
    const lh = size * 1.4;
    if (b.type === 'h') y += size * 0.4;
    for (const line of lines) {
      if (y + lh > H - m) { doc.addPage(); y = m; }
      doc.text(line, m, y + size);
      y += lh;
    }
    y += size * 0.6;
  }
  return doc.output('blob');
}

function blocksToDocx(blocks) {
  const x = (s) => esc(s).replace(/'/g, '&apos;');
  const run = (t, rpr = '') => t.split('\n').map((l, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r>${rpr}<w:t xml:space="preserve">${x(l)}</w:t></w:r>`).join('');
  const body = blocks.map((b) => {
    if (b.type === 'h') { const sz = [0, 40, 32, 28, 26, 24, 24][b.level]; return `<w:p><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>${run(b.text, `<w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr>`)}</w:p>`; }
    if (b.type === 'li') return `<w:p><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>${run('•\t' + b.text)}</w:p>`;
    if (b.type === 'pre') return `<w:p>${run(b.text, '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr>')}</w:p>`;
    return `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr>${run(b.text)}</w:p>`;
  }).join('');
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`),
  };
  return new Blob([zipSync(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

async function pdfToImages(file, target, progress) {
  const { pdf } = await readPdf(file);
  const mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[target];
  const out = [];
  const pad = String(pdf.numPages).length;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 2 });
    const c = document.createElement('canvas');
    c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise((r) => c.toBlob(r, mime, 0.92));
    const suffix = pdf.numPages > 1 ? `-${String(i).padStart(pad, '0')}` : '';
    out.push({ name: `${baseOf(file.name)}${suffix}.${target}`, blob });
    progress?.(i / pdf.numPages);
  }
  return out;
}

export async function convertDoc(file, target, progress) {
  const name = `${baseOf(file.name)}.${target}`;
  if (extOf(file.name) === 'pdf' && ['png', 'jpg', 'webp'].includes(target)) return pdfToImages(file, target, progress);
  const d = await readDoc(file, progress);
  switch (target) {
    case 'txt': return [{ name, blob: textBlob(d.text ?? blocksToText(d.blocks)) }];
    case 'md': return [{ name, blob: textBlob(d.md ?? blocksToMd(d.blocks), 'text/markdown') }];
    case 'html': return [{ name, blob: textBlob(wrapHtml(baseOf(file.name), d.html), 'text/html') }];
    case 'docx': return [{ name, blob: blocksToDocx(d.blocks) }];
    case 'pdf': {
      const { jsPDF } = await import('jspdf');
      return [{ name, blob: blocksToPdf(jsPDF, d.blocks) }];
    }
  }
  throw new Error('err.unsupported');
}
