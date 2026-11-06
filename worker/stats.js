const KEYS = {
  views: 'inc:article:views',
  likes: 'inc:article:likes',
  shares: 'inc:article:shares',
};

const SLUG = /^[a-z0-9-]{3,80}$/;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

async function redis(env, commands) {
  const response = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!response.ok) throw new Error(`Upstash Redis returned ${response.status}`);
  return (await response.json()).map((item) => item.result);
}

async function counts(env, slugs) {
  const commands = slugs.flatMap((slug) => [
    ['ZSCORE', KEYS.views, slug],
    ['ZSCORE', KEYS.likes, slug],
    ['ZSCORE', KEYS.shares, slug],
  ]);
  const results = await redis(env, commands);
  return Object.fromEntries(slugs.map((slug, index) => [slug, {
    views: Number(results[index * 3]) || 0,
    likes: Math.max(0, Number(results[index * 3 + 1]) || 0),
    shares: Number(results[index * 3 + 2]) || 0,
  }]));
}

export async function handleStats(request, env) {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return json({ enabled: false });
  }

  try {
    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      if (params.has('popular')) {
        const amount = Math.min(Math.max(Number(params.get('popular')) || 4, 1), 20);
        const [popular] = await redis(env, [['ZREVRANGE', KEYS.views, 0, amount + 5]]);
        return json({ enabled: true, popular: popular || [] });
      }

      const slugs = (params.get('slugs') || params.get('slug') || '')
        .split(',')
        .filter((slug) => SLUG.test(slug))
        .slice(0, 20);
      if (!slugs.length) return json({ error: 'bad slug' }, 400);
      return json({ enabled: true, stats: await counts(env, slugs) });
    }

    if (request.method === 'POST') {
      let body = {};
      try {
        body = await request.json();
      } catch {
        // Invalid JSON is handled as a bad request below.
      }
      const { slug = '', action = '' } = body || {};
      const change = {
        view: ['views', 1],
        like: ['likes', 1],
        unlike: ['likes', -1],
        share: ['shares', 1],
      }[action];
      if (!SLUG.test(slug) || !change) return json({ error: 'bad request' }, 400);
      await redis(env, [['ZINCRBY', KEYS[change[0]], change[1], slug]]);
      return json({ enabled: true, ...(await counts(env, [slug]))[slug] });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (error) {
    console.error('Upstash stats request failed', error);
    return json({ enabled: false });
  }
}
