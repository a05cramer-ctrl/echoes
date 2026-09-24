// POST /api/webhook  Helius calls this when an echoed wallet trades. Its echoes react on paper.
import { handler, fail } from '../lib/http.js';
import { env } from '../lib/env.js';
import { q } from '../lib/db.js';
import { parseSwap } from '../lib/helius.js';
import { tokenInfo } from '../lib/market.js';
import { solBalance, tokenBalance } from '../lib/rpc.js';
import { react } from '../lib/paper.js';

export default handler(async ({ req, body }) => {
  if (!env.HELIUS_WEBHOOK_SECRET || req.headers.authorization !== env.HELIUS_WEBHOOK_SECRET) throw fail(401, 'nope');
  const txs = Array.isArray(body) ? body : [body];
  let handled = 0;
  for (const tx of txs) {
    const accounts = [...new Set([tx?.feePayer, ...(tx?.accountData || []).map((a) => a.account)].filter(Boolean))];
    if (!accounts.length) continue;
    const echoes = await q('select id, source_wallet from echoes where source_wallet = any($1)', [accounts]);
    for (const w of [...new Set(echoes.map((c) => c.source_wallet))]) {
      const ev = parseSwap(tx, w);
      if (!ev) continue;
      const info = await tokenInfo(ev.mint);
      const ins = await q(
        `insert into source_trades (signature, wallet, side, mint, symbol, sol_amount, token_amount, ts)
         values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing returning signature`,
        [ev.signature, w, ev.side, ev.mint, info.symbol, ev.sol, ev.tokens, new Date((ev.ts || Date.now() / 1000) * 1000)],
      );
      if (!ins.length) continue; // Helius retried a transaction we already handled
      const ctx = {
        origSolAfter: await solBalance(w).catch(() => null),
        origTokensLeft: ev.side === 'sell' ? await tokenBalance(w, ev.mint).catch(() => null) : null,
      };
      for (const c of echoes.filter((c) => c.source_wallet === w)) {
        try {
          if (await react(c.id, ev, ctx)) handled++;
        } catch (e) {
          console.error('react', c.id, e.message);
        }
      }
    }
  }
  return { ok: true, handled };
}, { methods: ['POST'] });
