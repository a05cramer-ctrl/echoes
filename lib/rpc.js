// Read-only Solana RPC calls through Helius (no keys, no signing).
import { env, requireEnv, LAMPORTS } from './env.js';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function isPubkey(s) {
  s = String(s || '').trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return null;
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(B58.indexOf(c));
  let bytes = 0;
  while (n > 0n) { n >>= 8n; bytes++; }
  const lead = s.match(/^1*/)[0].length;
  return bytes + lead === 32 ? s : null;
}

async function call(method, params) {
  requireEnv('HELIUS_API_KEY');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: ctl.signal,
    });
    const j = await r.json();
    if (j.error) throw new Error(`rpc ${method}: ${j.error.message}`);
    return j.result;
  } finally {
    clearTimeout(t);
  }
}

export async function solBalance(wallet) {
  return (await call('getBalance', [wallet, { commitment: 'confirmed' }])).value / LAMPORTS;
}

export async function tokenBalance(wallet, mint) {
  const r = await call('getTokenAccountsByOwner', [wallet, { mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
  return r.value.reduce((a, x) => a + Number(x.account.data.parsed.info.tokenAmount.uiAmount || 0), 0);
}

// Token name/symbol/image from Helius DAS (works for brand new pump.fun coins too).
export async function assetInfo(mint) {
  const a = await call('getAsset', { id: mint });
  const m = a?.content?.metadata || {};
  return { symbol: m.symbol || a?.token_info?.symbol || '', name: m.name || '', icon: a?.content?.links?.image || '' };
}
