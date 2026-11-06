import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const width = 1200;
const height = 630;
const dots = Array.from({ length: 50 * 27 }, (_, i) => {
  const x = 12 + (i % 50) * 24;
  const y = 12 + Math.floor(i / 50) * 24;
  return `<circle cx="${x}" cy="${y}" r="1.5" fill="#222225"/>`;
}).join('');

const image = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="1200" height="630" fill="#0A0A0A"/>
  <g>${dots}</g>
  <g transform="translate(0 72)">
  <rect x="490" y="70" width="220" height="220" rx="62" fill="#FAFAFA"/>
  <g fill="none" stroke="#0A0A0A" stroke-width="17" stroke-linecap="round" stroke-linejoin="round">
    <path d="M545 145h105m0 0-32-32m32 32-32 32"/>
    <path d="M655 215H550m0 0 32-32m-32 32 32 32"/>
  </g>
  <text x="600" y="415" fill="#FAFAFA" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="700" letter-spacing="-2">I Need Convert</text>
  </g>
</svg>`;

await sharp(Buffer.from(image)).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile('public/og-image.png');
await writeFile('public/og-image.svg', image);
console.log('Wrote public/og-image.png (1200x630) and public/og-image.svg');
