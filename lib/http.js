// Helpers for Vercel serverless handlers.
export function send(res, status, data, cacheSec = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', cacheSec ? `public, s-maxage=${cacheSec}, stale-while-revalidate=${cacheSec * 4}` : 'no-store');
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export function handler(fn, { methods = ['GET'], cache = 0 } = {}) {
  return async (req, res) => {
    if (!methods.includes(req.method)) return send(res, 405, { error: 'method not allowed' });
    try {
      let body;
      try { body = await readBody(req); } catch { throw fail(400, 'Bad request body'); }
      const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
      const out = await fn({ req, res, body, query });
      if (!res.writableEnded) send(res, 200, out ?? { ok: true }, cache);
    } catch (e) {
      if (!e.expose) console.error(e);
      if (!res.writableEnded) {
        send(res, e.status || 500, { error: e.expose ? e.message : 'Something went wrong, try again', ...(e.setup ? { setup: e.setup } : {}) });
      }
    }
  };
}

export function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  e.expose = true;
  return e;
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || 'unknown';
}
