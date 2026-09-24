// Fake Helius / Jupiter / DexScreener so the real API code can run offline.
import { SOL } from './fixtures.js';

export const state = {
  history: {},            // wallet -> [enhanced tx]
  hooks: [],              // helius webhooks
  balances: {},           // wallet -> SOL
  tokenBalances: {},      // wallet:mint -> ui amount
  usd: { [SOL]: 200 },    // jupiter usd prices
  dexUsd: {},             // dexscreener usd prices
  tokens: {},             // mint -> {symbol,name,icon}
  jupDown: false,
  calls: [],
};

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export function install() {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method || 'GET').toUpperCase();
    state.calls.push(`${method} ${url.host}${url.pathname}`);
    const body = init.body ? JSON.parse(init.body) : null;

    if (url.host === 'api.helius.xyz') {
      if (url.searchParams.get('api-key') !== 'test-helius') return json({ error: 'bad key' }, 401);
      let m = url.pathname.match(/^\/v0\/addresses\/(\w+)\/transactions$/);
      if (m) {
        const all = state.history[m[1]] || [];
        const before = url.searchParams.get('before');
        const start = before ? all.findIndex((t) => t.signature === before) + 1 : 0;
        return json(all.slice(start, start + Number(url.searchParams.get('limit') || 100)));
      }
      if (url.pathname === '/v0/webhooks' && method === 'GET') return json(state.hooks);
      if (url.pathname === '/v0/webhooks' && method === 'POST') {
        const h = { webhookID: 'hook' + (state.hooks.length + 1), ...body };
        state.hooks.push(h);
        return json(h);
      }
      m = url.pathname.match(/^\/v0\/webhooks\/(\w+)$/);
      if (m && method === 'PUT') {
        const h = state.hooks.find((x) => x.webhookID === m[1]);
        Object.assign(h, body);
        return json(h);
      }
    }
    if (url.host === 'mainnet.helius-rpc.com') {
      const { method: rpc, params } = body;
      if (rpc === 'getBalance') return json({ jsonrpc: '2.0', id: 1, result: { value: Math.round((state.balances[params[0]] ?? 0) * 1e9) } });
      if (rpc === 'getTokenAccountsByOwner') {
        const amt = state.tokenBalances[`${params[0]}:${params[1].mint}`] ?? 0;
        return json({ jsonrpc: '2.0', id: 1, result: { value: amt ? [{ account: { data: { parsed: { info: { tokenAmount: { uiAmount: amt } } } } } }] : [] } });
      }
      if (rpc === 'getAsset') {
        const t = state.tokens[params.id];
        return json({ jsonrpc: '2.0', id: 1, result: t ? { content: { metadata: { symbol: t.symbol, name: t.name }, links: { image: t.icon } } } : null });
      }
    }
    if (url.host === 'lite-api.jup.ag') {
      if (state.jupDown) return json({ error: 'down' }, 503);
      if (url.pathname === '/price/v3') {
        const out = {};
        for (const id of url.searchParams.get('ids').split(',')) if (state.usd[id]) out[id] = { usdPrice: state.usd[id] };
        return json(out);
      }
      if (url.pathname === '/tokens/v2/search') {
        const id = url.searchParams.get('query');
        const t = state.tokens[id];
        return json(t && !t.dasOnly ? [{ id, ...t }] : []);
      }
    }
    if (url.host === 'api.dexscreener.com') {
      const ids = url.pathname.split('/').pop().split(',');
      const pairs = [];
      for (const id of ids) {
        if (state.dexUsd[id]) pairs.push({ baseToken: { address: id, symbol: state.tokens[id]?.symbol || 'X', name: '' }, quoteToken: { symbol: 'SOL' }, priceUsd: String(state.dexUsd[id]), liquidity: { usd: 1000 } });
      }
      return json(pairs);
    }
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return real(input, init);
    throw new Error('unexpected fetch ' + url);
  };
}

// Call a Vercel-style handler with a fake req/res.
export async function call(handler, { method = 'GET', query = {}, body, headers = {}, ip = '1.1.1.1' } = {}) {
  const req = { method, query, body, headers: { host: 'echoes.test', 'x-forwarded-for': ip, ...headers }, url: '/api' };
  let status = 200, out = '', hdrs = {};
  const res = {
    set statusCode(v) { status = v; }, get statusCode() { return status; },
    setHeader: (k, v) => { hdrs[k.toLowerCase()] = v; },
    end: (s) => { out = s; res.writableEnded = true; },
    writableEnded: false,
  };
  await handler(req, res);
  return { status, body: out ? JSON.parse(out) : null, headers: hdrs };
}
