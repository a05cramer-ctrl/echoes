// GET /api/analyze?wallet=...  Real report of a wallet's on-chain trading (cached 2 hours).
import { handler, fail, clientIp } from '../lib/http.js';
import { isPubkey } from '../lib/rpc.js';
import { analyzeWallet } from '../lib/analyze.js';
import { one, q, limit } from '../lib/db.js';
import { requireEnv } from '../lib/env.js';

export default handler(async ({ req, query }) => {
  const wallet = isPubkey(query.wallet);
  if (!wallet) throw fail(400, 'That is not a Solana wallet address');
  const cached = await one('select report, updated_at from wallet_reports where wallet = $1', [wallet]);
  if (cached && Date.now() - cached.updated_at.getTime() < 2 * 3600e3) return { ...cached.report, cached: true };
  requireEnv('HELIUS_API_KEY');
  if (!(await limit(clientIp(req), 'scan', 12, 3600))) throw fail(429, 'Scanner is cooling down. Try again in a bit.');
  const report = await analyzeWallet(wallet);
  await q(
    `insert into wallet_reports (wallet, report, updated_at) values ($1, $2, now())
     on conflict (wallet) do update set report = excluded.report, updated_at = now()`,
    [wallet, report],
  );
  return report;
});
