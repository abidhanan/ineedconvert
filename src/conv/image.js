import { extOf, baseOf } from '../formats.js';
import { convertMedia } from './ffmpeg.js';

const canvasMime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif' };

function loadImg(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('err.image')); };
    img.src = url;
  });
}

// Decode any supported image into a canvas.
async function toCanvas(file) {
  const ext = extOf(file.name);
  let src = file;
  if (ext === 'heic' || ext === 'heif') {
    // Safari decodes HEIC natively; elsewhere fall back to the bundled decoder.
    try {
      await createImageBitmap(file).then((b) => b.close());
    } catch {
      try {
        const { default: heic2any } = await import('heic2any');
        const out = await heic2any({ blob: file, toType: 'image/png' });
        src = Array.isArray(out) ? out[0] : out;
      } catch (e) {
        throw new Error('err.image', { cause: e }); // heic2any rejects with a plain object, not an Error
      }
    }
  } else if (ext === 'tif' || ext === 'tiff') {
    const [png] = await convertMedia(file, 'png');
    src = png.blob;
  }
  if (ext === 'svg') {
    // An SVG without the xmlns attribute is not drawn by <img>; add it.
    const text = await file.text();
    if (!/<svg[^>]*\sxmlns\s*=/.test(text)) src = new Blob([text.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')], { type: 'image/svg+xml' });
    else src = new Blob([text], { type: 'image/svg+xml' });
  }
  let w, h, draw;
  try {
    if (ext === 'svg' || ext === 'ico') throw 0; // use <img> so SVG/ICO sizes resolve correctly
    const bmp = await createImageBitmap(src);
    w = bmp.width; h = bmp.height; draw = bmp;
  } catch {
    const img = await loadImg(src);
    w = img.naturalWidth || 1024; h = img.naturalHeight || 1024;
    if (ext === 'svg' && Math.max(w, h) < 1024) { const s = 1024 / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
    draw = img;
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(draw, 0, 0, w, h);
  return c;
}

const toBlob = (c, type, q = 0.92) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('err.image'))), type, q));

function flatten(c) {
  const f = document.createElement('canvas');
  f.width = c.width; f.height = c.height;
  const ctx = f.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, f.width, f.height);
  ctx.drawImage(c, 0, 0);
  return f;
}

function encodeBMP(c) {
  const { width: w, height: h } = c;
  const px = c.getContext('2d').getImageData(0, 0, w, h).data;
  const row = Math.ceil((w * 3) / 4) * 4;
  const size = 54 + row * h;
  const buf = new ArrayBuffer(size);
  const v = new DataView(buf);
  v.setUint16(0, 0x4d42, true); v.setUint32(2, size, true); v.setUint32(10, 54, true);
  v.setUint32(14, 40, true); v.setInt32(18, w, true); v.setInt32(22, h, true);
  v.setUint16(26, 1, true); v.setUint16(28, 24, true); v.setUint32(34, row * h, true);
  const out = new Uint8Array(buf);
  for (let y = 0; y < h; y++) {
    let o = 54 + (h - 1 - y) * row;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = px[i + 3] / 255;
      out[o++] = px[i + 2] * a + 255 * (1 - a);
      out[o++] = px[i + 1] * a + 255 * (1 - a);
      out[o++] = px[i] * a + 255 * (1 - a);
    }
  }
  return new Blob([buf], { type: 'image/bmp' });
}

async function encodeICO(c) {
  const s = Math.min(256, Math.max(c.width, c.height));
  const k = document.createElement('canvas');
  k.width = k.height = s;
  const r = Math.min(s / c.width, s / c.height);
  const w = c.width * r, h = c.height * r;
  k.getContext('2d').drawImage(c, (s - w) / 2, (s - h) / 2, w, h);
  const png = new Uint8Array(await (await toBlob(k, 'image/png')).arrayBuffer());
  const head = new DataView(new ArrayBuffer(22));
  head.setUint16(2, 1, true); head.setUint16(4, 1, true);
  head.setUint8(6, s === 256 ? 0 : s); head.setUint8(7, s === 256 ? 0 : s);
  head.setUint16(10, 1, true); head.setUint16(12, 32, true);
  head.setUint32(14, png.length, true); head.setUint32(18, 22, true);
  return new Blob([head.buffer, png], { type: 'image/x-icon' });
}

export async function convertImage(file, target, progress) {
  const name = `${baseOf(file.name)}.${target}`;
  const ext = extOf(file.name);
  // Animated GIF → video, or GIF/TIFF output: hand to ffmpeg.
  if (ext === 'gif' && (target === 'mp4' || target === 'webm')) return convertMedia(file, target, progress);
  const c = await toCanvas(file);
  if (canvasMime[target]) {
    const blob = await toBlob(target === 'jpg' ? flatten(c) : c, canvasMime[target]);
    if (blob.type !== canvasMime[target]) throw new Error('err.browser');
    return [{ name, blob }];
  }
  if (target === 'bmp') return [{ name, blob: encodeBMP(c) }];
  if (target === 'ico') return [{ name, blob: await encodeICO(c) }];
  if (target === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const w = c.width * 0.75, h = c.height * 0.75; // px → pt
    const doc = new jsPDF({ orientation: w > h ? 'l' : 'p', unit: 'pt', format: [w, h], compress: true });
    doc.addImage(flatten(c).toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h);
    return [{ name, blob: doc.output('blob') }];
  }
  // gif / tiff: encode a PNG first, then let ffmpeg write the target format.
  const png = new File([await toBlob(c, 'image/png')], `${baseOf(file.name)}.png`, { type: 'image/png' });
  return convertMedia(png, target, progress);
}

export async function avifSupported() {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const b = await new Promise((r) => c.toBlob(r, 'image/avif'));
  return b?.type === 'image/avif';
}
