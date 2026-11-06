import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

function environment(overrides = {}) {
  return {
    ASSETS: {
      fetch(request) {
        return new Response(new URL(request.url).pathname);
      },
    },
    ...overrides,
  };
}

test('redirects www to the canonical apex domain', async () => {
  const response = await worker.fetch(
    new Request('https://www.ineedconvert.com/artikel/?x=1'),
    environment(),
  );
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://ineedconvert.com/artikel/?x=1');
});

test('serves static assets with security headers', async () => {
  const response = await worker.fetch(new Request('https://ineedconvert.com/'), environment());
  assert.equal(await response.text(), '/');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
});

test('keeps stats disabled until Upstash secrets are configured', async () => {
  const response = await worker.fetch(
    new Request('https://ineedconvert.com/api/stats?slug=example'),
    environment(),
  );
  assert.deepEqual(await response.json(), { enabled: false });
});
