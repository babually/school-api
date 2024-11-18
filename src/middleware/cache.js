export const cache = async (c, next) => {
  if (c.req.method !== 'GET') return await next();

  const cacheKey = new URL(c.req.url).pathname;
  const cached = await c.env.CACHE.get(cacheKey);

  if (cached) {
    return c.json(JSON.parse(cached));
  }

  await next();

  // Cache successful responses for 5 minutes
  if (c.res.status === 200) {
    await c.env.CACHE.put(cacheKey, c.res.body, { expirationTtl: 300 });
  }
};