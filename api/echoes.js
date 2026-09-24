// GET /api/echoes  Every echo with its real paper value (for the floor and leaderboard).
import { handler } from '../lib/http.js';
import { q } from '../lib/db.js';
import { valueEchoes } from '../lib/paper.js';
import { shape } from '../lib/shape.js';


export default handler(async () => {
  const echoes = await q(
    `select id, name, source_wallet, build, cash_sol, trades, wins, losses, realized_sol, best_pnl_sol, best_symbol, last_trade_at, created_at
     from echoes order by created_at desc limit 400`,
  );
  const valued = await valueEchoes(echoes);
  return valued.map((c) => ({ ...shape(c), positions: c.positions.slice(0, 6) }));
}, { cache: 10 });
