import { handleStats } from './stats.js';

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'cross-origin-opener-policy': 'same-origin',
};

function secure(response) {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(name, value);
  }
  return secured;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === 'www.ineedconvert.com') {
      url.protocol = 'https:';
      url.hostname = 'ineedconvert.com';
      url.port = '';
      return Response.redirect(url, 308);
    }

    const response = url.pathname === '/api/stats'
      ? await handleStats(request, env)
      : await env.ASSETS.fetch(request);
    return secure(response);
  },
};

export { secure };
