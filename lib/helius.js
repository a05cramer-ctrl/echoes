// Helius enhanced-transaction parsing + webhook management.
import { env, requireEnv, SOL_MINT, LAMPORTS } from './env.js';

const API = 'https://api.helius.xyz/v0';
const STABLES = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

// Turn one Helius enhanced transaction into a SOL<->token swap for `wallet`, or null.
export function parseSwap(tx, wallet) {
  if (!tx || tx.transactionError) return null;
  const acct = (tx.accountData || []).find((a) => a.account === wallet);
  let solDelta = (acct?.nativeBalanceChange || 0) / LAMPORTS;
  if (tx.feePayer === wallet) solDelta += (tx.fee || 0) / LAMPORTS; // ignore network fee
  const tokens = {};
  for (const a of tx.accountData || []) {
    for (const c of a.tokenBalanceChanges || []) {
      if (c.userAccount !== wallet || !c.rawTokenAmount) continue;
      const amt = Number(c.rawTokenAmount.tokenAmount) / 10 ** Number(c.rawTokenAmount.decimals || 0);
      if (!Number.isFinite(amt)) continue;
      if (c.mint === SOL_MINT) { solDelta += amt; continue; } // wrapped SOL counts as SOL
      tokens[c.mint] = (tokens[c.mint] || 0) + amt;
    }
  }
  const moved = Object.entries(tokens).filter(([, v]) => Math.abs(v) > 0);
  if (moved.length !== 1) return null;           // only simple SOL <-> one-token swaps
  const [mint, tokenDelta] = moved[0];
  if (STABLES.has(mint)) return null;
  if (tokenDelta > 0 && solDelta < -0.0005) {
    return { side: 'buy', mint, sol: -solDelta, tokens: tokenDelta, signature: tx.signature, ts: tx.timestamp, wallet };
  }
  if (tokenDelta < 0 && solDelta > 0.0005) {
    return { side: 'sell', mint, sol: solDelta, tokens: -tokenDelta, signature: tx.signature, ts: tx.timestamp, wallet };
  }
  return null;
}

export async function walletHistory(wallet, pages = 2) {
  requireEnv('HELIUS_API_KEY');
  let before = '', all = [];
  for (let p = 0; p < pages; p++) {
    const url = `${API}/addresses/${wallet}/transactions?api-key=${env.HELIUS_API_KEY}&limit=100${before ? `&before=${before}` : ''}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`helius history ${r.status}`);
    const txs = await r.json();
    if (!Array.isArray(txs) || !txs.length) break;
    all = all.concat(txs);
    before = txs[txs.length - 1].signature;
    if (txs.length < 100) break;
  }
  return all;
}

// Keep one webhook pointing at our /api/webhook, and make sure `wallet` is on it.
export async function watchWallet(wallet, webhookURL) {
  requireEnv('HELIUS_API_KEY', 'HELIUS_WEBHOOK_SECRET');
  const k = `api-key=${env.HELIUS_API_KEY}`;
  const lr = await fetch(`${API}/webhooks?${k}`);
  if (!lr.ok) throw new Error(`helius webhook list ${lr.status}`);
  const list = await lr.json();
  const hooks = Array.isArray(list) ? list : [];
  const hook = hooks.find((h) => h.webhookURL === webhookURL) || hooks.find((h) => /\/api\/webhook$/.test(h.webhookURL || ''));
  const body = (addresses) => JSON.stringify({
    webhookURL, transactionTypes: ['ANY'], accountAddresses: addresses,
    webhookType: 'enhanced', authHeader: env.HELIUS_WEBHOOK_SECRET,
  });
  if (!hook) {
    const r = await fetch(`${API}/webhooks?${k}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body([wallet]) });
    if (!r.ok) throw new Error(`helius webhook create ${r.status} ${await r.text()}`);
    return 'created';
  }
  const addrs = hook.accountAddresses || [];
  if (addrs.includes(wallet) && hook.webhookURL === webhookURL && hook.authHeader === env.HELIUS_WEBHOOK_SECRET) return 'already';
  const r = await fetch(`${API}/webhooks/${hook.webhookID}?${k}`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: body([...new Set([...addrs, wallet])]),
  });
  if (!r.ok) throw new Error(`helius webhook update ${r.status} ${await r.text()}`);
  return 'added';
}
