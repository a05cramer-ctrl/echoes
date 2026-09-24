// GET /api/stats  Real counters for the whole lab.
import { handler } from '../lib/http.js';
import { q, one } from '../lib/db.js';
import { env } from '../lib/env.js';
import { solUsd } from '../lib/market.js';

export default handler(async () => {
  const [c, t, s, w, top, recent, sol] = await Promise.all([
    one('select count(*)::int echoes, count(distinct source_wallet)::int originals from echoes'),
    one(`select count(*) filter (where side <> 'skip')::int trades, count(*) filter (where side = 'skip')::int skips,
                coalesce(sum(sol_amount) filter (where side <> 'skip'), 0) volume,
                count(*) filter (where side <> 'skip' and created_at > now() - interval '24 hours')::int trades24h
         from echo_trades`),
    one('select count(*)::int n from source_trades'),
    one('select count(*)::int n from wallet_reports'),
    q(`select source_wallet as wallet, count(*)::int echoes, min(build) as build from echoes
       group by source_wallet order by count(*) desc, min(created_at) limit 8`),
    q(`select wallet, report->>'build' as build, (report->>'swaps')::int as swaps, (report->>'winRate')::float as "winRate",
              (report->>'realizedSol')::float as "realizedSol", updated_at as at
       from wallet_reports where (report->>'swaps')::int > 0 order by updated_at desc limit 10`),
    solUsd().catch(() => 0),
  ]);
  return {
    echoes: c.echoes, originals: c.originals, echoTrades: t.trades, skips: t.skips, trades24h: t.trades24h,
    paperVolume: t.volume, originalTrades: s.n, scans: w.n, topOriginals: top, recentScans: recent,
    solUsd: sol, ready: { database: true, helius: !!env.HELIUS_API_KEY },
  };
}, { cache: 10 });
