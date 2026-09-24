// GET /api/feed  Latest real events: what an original did and how its echo reacted.
import { handler } from '../lib/http.js';
import { q } from '../lib/db.js';

export default handler(async ({ query }) => {
  const skips = query.skips !== '0';
  const rows = await q(
    `select t.id, t.created_at as at, t.side, t.symbol, t.mint, t.sol_amount as sol, t.pnl_sol as pnl, t.reason,
            t.source_signature as signature, c.id as "echoId", c.name as echo, c.build, c.source_wallet as original,
            s.side as "origSide", s.sol_amount as "origSol", tk.icon
     from echo_trades t
     join echoes c on c.id = t.echo_id
     left join source_trades s on s.signature = t.source_signature and s.wallet = c.source_wallet
     left join tokens tk on tk.mint = t.mint
     ${skips ? '' : "where t.side <> 'skip'"}
     order by t.id desc limit 50`,
  );
  return rows;
}, { cache: 4 });
