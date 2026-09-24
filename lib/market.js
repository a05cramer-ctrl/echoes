// Token names and live prices. Jupiter first, DexScreener as backup, then the last real fill we saw.
import { SOL_MINT } from './env.js';
import { q } from './db.js';
import { assetInfo } from './rpc.js';

const JUP = 'https://lite-api.jup.ag';
const DEX = 'https://api.dexscreener.com';
const mem = new Map();

async function getJSON(url, ms = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const short = (mint) => mint.slice(0, 4) + '…';
const clean = (s, n) => String(s || '').replace(/[^\p{L}\p{N} ._$\-]/gu, '').trim().slice(0, n);

// { symbol, name, icon }
export async function tokenInfo(mint) {
  if (mint === SOL_MINT) return { symbol: 'SOL', name: 'Solana', icon: '' };
  if (mem.has(mint)) return mem.get(mint);
  const [row] = await q('select symbol, name, icon from tokens where mint = $1', [mint]).catch(() => []);
  if (row && row.symbol) { mem.set(mint, row); return row; }

  let info = null;
  const arr = await getJSON(`${JUP}/tokens/v2/search?query=${mint}`);
  const t = Array.isArray(arr) ? arr.find((x) => x.id === mint) : null;
  if (t) info = { symbol: clean(t.symbol, 16), name: clean(t.name, 40), icon: t.icon || '' };
  if (!info) {
    const pairs = await getJSON(`${DEX}/tokens/v1/solana/${mint}`);
    const p = Array.isArray(pairs) ? pairs.find((x) => x.baseToken?.address === mint) : null;
    if (p) info = { symbol: clean(p.baseToken.symbol, 16), name: clean(p.baseToken.name, 40), icon: p.info?.imageUrl || '' };
  }
  if (!info) {
    const a = await assetInfo(mint).catch(() => null);
    if (a && a.symbol) info = { symbol: clean(a.symbol, 16), name: clean(a.name, 40), icon: a.icon };
  }
  if (!info || !info.symbol) return { symbol: short(mint), name: '', icon: '' }; // not cached: try again next time
  if (!/^https:\/\//.test(info.icon)) info.icon = '';
  mem.set(mint, info);
  await q(
    `insert into tokens (mint, symbol, name, icon) values ($1,$2,$3,$4)
     on conflict (mint) do update set symbol = excluded.symbol, name = excluded.name, icon = excluded.icon, updated_at = now()`,
    [mint, info.symbol, info.name, info.icon],
  ).catch(() => {});
  return info;
}

let solCache = { at: 0, usd: 0 };
export async function solUsd() {
  if (Date.now() - solCache.at < 30_000 && solCache.usd) return solCache.usd;
  const j = await getJSON(`${JUP}/price/v3?ids=${SOL_MINT}`);
  let usd = Number(j?.[SOL_MINT]?.usdPrice || 0);
  if (!usd) {
    const pairs = await getJSON(`${DEX}/tokens/v1/solana/${SOL_MINT}`);
    const p = Array.isArray(pairs) ? pairs.filter((x) => x.baseToken?.address === SOL_MINT && /^USD/.test(x.quoteToken?.symbol || ''))
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0] : null;
    usd = Number(p?.priceUsd || 0);
  }
  if (usd) solCache = { at: Date.now(), usd };
  return usd || solCache.usd;
}

// Price of each mint in SOL. { mint: priceSol }. Missing mints are left out.
export async function pricesInSol(mints) {
  const want = [...new Set(mints)].filter((m) => m && m !== SOL_MINT);
  const out = {};
  if (!want.length) return out;
  const sol = await solUsd();

  if (sol) {
    for (let i = 0; i < want.length; i += 50) {
      const j = await getJSON(`${JUP}/price/v3?ids=${want.slice(i, i + 50).join(',')}`);
      for (const [m, v] of Object.entries(j || {})) {
        const usd = Number(v?.usdPrice || 0);
        if (usd > 0) out[m] = usd / sol;
      }
    }
    const missing = want.filter((m) => !out[m]);
    for (let i = 0; i < missing.length; i += 30) {
      const pairs = await getJSON(`${DEX}/tokens/v1/solana/${missing.slice(i, i + 30).join(',')}`);
      if (!Array.isArray(pairs)) continue;
      const best = {};
      for (const p of pairs) {
        const m = p.baseToken?.address;
        if (!missing.includes(m)) continue;
        if (!best[m] || (p.liquidity?.usd || 0) > (best[m].liquidity?.usd || 0)) best[m] = p;
      }
      for (const [m, p] of Object.entries(best)) {
        const usd = Number(p.priceUsd || 0);
        if (usd > 0) out[m] = usd / sol;
      }
    }
  }

  // Last resort: the most recent real fill we recorded for that coin.
  const still = want.filter((m) => !out[m]);
  if (still.length) {
    const rows = await q(
      `select distinct on (mint) mint, sol_amount / nullif(token_amount, 0) as px
       from source_trades where mint = any($1) and token_amount > 0 order by mint, ts desc`,
      [still],
    ).catch(() => []);
    for (const r of rows) if (r.px > 0) out[r.mint] = r.px;
  }
  return out;
}
