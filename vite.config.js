import { defineConfig } from 'vite';
import { generate, homeCards } from './scripts/pages.mjs';
import { header, footer } from './scripts/partials.mjs';

const inputs = generate();

export default defineConfig({
  plugins: [{
    name: 'ineedconvert-partials',
    transformIndexHtml(html) {
      return html
        .replace('<!--#header-->', header({ home: true, current: 'converter' }))
        .replace('<!--#footer-->', footer())
        .replace('<!--#articles-->', homeCards());
    },
  }],
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000, rollupOptions: { input: inputs } },
});
