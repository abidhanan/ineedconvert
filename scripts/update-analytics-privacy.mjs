import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const legalDir = resolve(root, 'public/i18n/legal');
const saveDir = resolve(root, '..', 'ineedsave', 'content/legal');

function sections(html) {
  const starts = [...html.matchAll(/<h2>/g)].map((match) => match.index);
  return starts.map((start, index) => html.slice(start, starts[index + 1] ?? html.length));
}

for (const file of readdirSync(legalDir).filter((name) => name.endsWith('.json'))) {
  const locale = file.slice(0, -5);
  const sourcePath = resolve(saveDir, `privacy.${locale}.json`);
  let source;
  try {
    source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  } catch {
    throw new Error(`Missing translated analytics disclosure for ${locale}`);
  }

  const sourceSections = sections(source.body);
  const analyticsSection = sourceSections.find((section) => section.includes('tools.google.com/dlpage/gaoptout'));
  const cookieSection = sourceSections.find((section) => section.includes('Google Analytics') && section.includes('Microsoft Clarity') && !section.includes('gaoptout'));
  const analyticsCookie = cookieSection
    ? [...cookieSection.matchAll(/<li>[\s\S]*?<\/li>/g)].map((match) => match[0]).find((item) => item.includes('Google Analytics') && item.includes('Microsoft Clarity'))
    : null;
  if (!analyticsSection || !analyticsCookie) throw new Error(`Could not extract analytics disclosure for ${locale}`);

  const path = resolve(legalDir, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  let body = data['privacy.body'];

  // Remove the former "no analytics" claim in the data section.
  body = body.replace(/<li>(?:(?!<\/li>)[\s\S])*Google Analytics(?:(?!<\/li>)[\s\S])*<\/li>/, '');

  // Keep the language preference entry, replace the old no-cookie claim, and
  // add the locale-matched disclosure translated for I Need Save.
  const projectSections = sections(body);
  const projectCookie = projectSections.find((section) => section.includes('inc-lang'));
  if (!projectCookie) throw new Error(`Could not find cookie section for ${locale}`);
  const preference = projectCookie.match(/<li>(?:(?!<\/li>)[\s\S])*inc-lang(?:(?!<\/li>)[\s\S])*<\/li>/)?.[0];
  if (!preference) throw new Error(`Could not find language storage disclosure for ${locale}`);
  const updatedCookie = projectCookie.replace(/<ul>[\s\S]*?<\/ul>/, `<ul>${preference}${analyticsCookie.replace('ins-lang', 'inc-lang')}</ul>`);
  body = body.replace(projectCookie, `${updatedCookie}${analyticsSection.replace(/<li><strong>Vercel Web Analytics<\/strong>[\s\S]*?<\/li>/, '')}`);

  data['privacy.body'] = body;
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

// Keep the Indonesian generator source truthful so future page regeneration
// cannot restore the old "no analytics" wording.
const legalSourcePath = resolve(root, 'scripts/legal-id.mjs');
let legalSource = readFileSync(legalSourcePath, 'utf8');
legalSource = legalSource
  .replace('<li><strong>Tanpa analitik pelacak.</strong> Kami tidak memakai Google Analytics, piksel iklan, atau alat pelacak lain.</li>', '')
  .replace('<li>Kami tidak memasang cookie pelacak atau cookie iklan.</li>', '<li><strong>Cookie analitik pihak ketiga</strong> dari Google Analytics dan Microsoft Clarity, dijelaskan di bawah.</li>')
  .replace('</ul><h2>Layanan pihak ketiga</h2>', '</ul><h2>Analitik</h2><p>Kami memakai alat analitik untuk memahami cara website dipakai dan memperbaikinya:</p><ul><li><strong>Google Analytics 4</strong> (Google LLC): memakai cookie untuk mengukur halaman yang dibuka, perkiraan negara, jenis perangkat, dan interaksi di website. Data diproses oleh Google sesuai <a href="https://policies.google.com/privacy">Kebijakan Privasi Google</a>.</li><li><strong>Microsoft Clarity</strong>: dimuat setelah kamu mulai berinteraksi dengan halaman. Clarity mencatat interaksi seperti klik dan gulir untuk peta panas dan rekaman sesi, dan menyamarkan isi kolom input. Data diproses oleh Microsoft sesuai <a href="https://privacy.microsoft.com/privacystatement">Pernyataan Privasi Microsoft</a>.</li></ul><p>Kamu bisa menolak analitik dengan memblokir cookie pihak ketiga di pengaturan browser, memakai pemblokir pelacak, atau memasang <a href="https://tools.google.com/dlpage/gaoptout">Google Analytics Opt-out Browser Add-on</a>. Website tetap bisa dipakai sepenuhnya.</p><h2>Layanan pihak ketiga</h2>');
writeFileSync(legalSourcePath, legalSource);

console.log('Updated analytics privacy disclosures for every locale.');
