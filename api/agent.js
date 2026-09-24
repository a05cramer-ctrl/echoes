// GET /api/agent?id=...  One echo: its bag, every decision it made, and its original's report.
import { handler, fail } from '../lib/http.js';
import { q, one } from '../lib/db.js';
import { valueEchoes } from '../lib/paper.js';
import { shape } from '../lib/shape.js';

export default handler(async ({ query }) => {
  const id = String(query.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw fail(400, 'Unknown echo');
  const c = await one(
    `select id, name, source_wallet, build, cash_sol, trades, wins, losses, realized_sol, best_pnl_sol, best_symbol, last_trade_at, created_at
     from echoes where id = $1`, [id]);
  if (!c) throw fail(404, 'That echo does not exist');
  const [valued] = await valueEchoes([c]);
  const trades = await q(
    `select t.id, t.created_at as at, t.side, t.symbol, t.mint, t.sol_amount as sol, t.pnl_sol as pnl, t.reason, t.source_signature as signature,
            s.side as "origSide", s.sol_amount as "origSol", tk.icon
     from echo_trades t
     left join source_trades s on s.signature = t.source_signature and s.wallet = $2
     left join tokens tk on tk.mint = t.mint
     where t.echo_id = $1 order by t.created_at desc limit 80`, [id, c.source_wallet]);
  const rep = await one('select report from wallet_reports where wallet = $1', [c.source_wallet]);
  const siblings = await q('select id, name, build from echoes where source_wallet = $1 and id <> $2 order by created_at limit 12', [c.source_wallet, id]);
  return { echo: shape(valued), trades, report: rep?.report || null, siblings };
}, { cache: 8 });
