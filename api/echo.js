// POST /api/echo {wallet, name}  Grow a paper-trading echo of a real wallet.
import { handler, fail, clientIp } from '../lib/http.js';
import { env, START_SOL, requireEnv } from '../lib/env.js';
import { isPubkey } from '../lib/rpc.js';
import { analyzeWallet } from '../lib/analyze.js';
import { watchWallet } from '../lib/helius.js';
import { q, one, limit } from '../lib/db.js';

export default handler(async ({ req, body }) => {
  requireEnv('DATABASE_URL', 'HELIUS_API_KEY');
  const wallet = isPubkey(body.wallet);
  if (!wallet) throw fail(400, 'Paste a valid Solana wallet to echo');
  const ip = clientIp(req);

  const dupe = await one('select id, name from echoes where source_wallet = $1 and created_ip = $2', [wallet, ip]);
  if (dupe) throw fail(409, `You already grew ${dupe.name}`);
  const { n } = await one('select count(*)::int n from echoes');
  if (n >= env.MAX_ECHOES) throw fail(503, 'The lab is full right now. Check back soon.');
  if (!(await limit(ip, 'echo', 3, 3600))) throw fail(429, 'Easy. 3 echoes per hour. Come back soon.');

  const cached = await one('select report, updated_at from wallet_reports where wallet = $1', [wallet]);
  let report = cached && Date.now() - cached.updated_at.getTime() < 24 * 3600e3 ? cached.report : null;
  if (!report) {
    report = await analyzeWallet(wallet);
    await q(
      `insert into wallet_reports (wallet, report, updated_at) values ($1, $2, now())
       on conflict (wallet) do update set report = excluded.report, updated_at = now()`,
      [wallet, report],
    );
  }
  if (!report.swaps) throw fail(400, 'That wallet has no swaps to learn from. Try one that trades.');

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = `${env.PUBLIC_URL || `https://${host}`}/api/webhook`;
  try {
    await watchWallet(wallet, url);
  } catch (e) {
    console.error('watch', e.message);
    throw fail(502, 'Could not hook the wallet up to Helius. Try again in a minute.');
  }

  const name = String(body.name || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 16) || wallet.slice(0, 4) + wallet.slice(-4);
  const echo = await one(
    `insert into echoes (name, source_wallet, build, cash_sol, created_ip) values ($1,$2,$3,$4,$5)
     returning id, name, source_wallet, build, cash_sol, created_at`,
    [name + '.echo', wallet, report.build, START_SOL, ip],
  );
  return { echo: { ...echo, value: START_SOL, pnlPct: 0, trades: 0, positions: [] }, report };
}, { methods: ['POST'] });
