// Paper trading: an echo reacts to its original's real trade at the real fill price.
// No wallets, no keys, no funds. Every echo's bag is a number in the database.
import { q, tx } from './db.js';
import { decide } from './strategy.js';
import { tokenInfo, pricesInSol } from './market.js';

// Returns the recorded echo trade, or null if this echo already reacted to that transaction.
export async function react(echoId, event, ctx) {
  const info = await tokenInfo(event.mint);
  let px = event.tokens > 0 ? event.sol / event.tokens : 0;           // his own fill price
  if (!(px > 0)) px = (await pricesInSol([event.mint]))[event.mint] || 0;

  return tx(async (sql) => {
    const [c] = await sql('select * from echoes where id = $1 for update', [echoId]);
    if (!c) return null;
    const [pos] = await sql('select * from echo_positions where echo_id = $1 and mint = $2 for update', [echoId, event.mint]);
    const d = decide({
      build: c.build, event, symbol: info.symbol,
      origSolAfter: ctx.origSolAfter, origTokensLeft: ctx.origTokensLeft,
      cash: c.cash_sol,
      position: pos && pos.tokens > 0 ? { tokens: pos.tokens, openedAt: pos.opened_at.getTime() / 1000 } : null,
      now: Date.now() / 1000,
    });
    if (d.action !== 'skip' && !(px > 0)) {
      d.action = 'skip';
      d.reason = `${d.reason.split('.')[0]}. Skipped: no price for $${info.symbol} yet.`;
    }

    const rec = async (row) => {
      const [t] = await sql(
        `insert into echo_trades (echo_id, source_signature, side, mint, symbol, sol_amount, token_amount, price_sol, pnl_sol, reason)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (echo_id, source_signature) do nothing returning *`,
        [echoId, event.signature, row.side, event.mint, info.symbol, row.sol ?? null, row.tokens ?? null, row.px ?? null, row.pnl ?? null, d.reason],
      );
      return t || null;
    };

    if (d.action === 'skip') return rec({ side: 'skip' });

    if (d.action === 'buy') {
      const tokens = d.sol / px;
      const t = await rec({ side: 'buy', sol: d.sol, tokens, px });
      if (!t) return null;
      await sql(`update echoes set cash_sol = cash_sol - $2, trades = trades + 1, last_trade_at = now() where id = $1`, [echoId, d.sol]);
      await sql(
        `insert into echo_positions (echo_id, mint, symbol, tokens, cost_sol) values ($1,$2,$3,$4,$5)
         on conflict (echo_id, mint) do update set
           tokens = echo_positions.tokens + excluded.tokens,
           cost_sol = echo_positions.cost_sol + excluded.cost_sol,
           symbol = excluded.symbol,
           opened_at = case when echo_positions.tokens <= 0 then now() else echo_positions.opened_at end`,
        [echoId, event.mint, info.symbol, tokens, d.sol],
      );
      return t;
    }

    const tokens = pos.tokens * d.fraction;
    const proceeds = tokens * px;
    const costPart = pos.cost_sol * d.fraction;
    const pnl = proceeds - costPart;
    const t = await rec({ side: 'sell', sol: proceeds, tokens, px, pnl });
    if (!t) return null;
    const left = pos.tokens - tokens;
    await sql(
      `update echoes set cash_sol = cash_sol + $2, trades = trades + 1, last_trade_at = now(),
         realized_sol = realized_sol + $3,
         wins = wins + (case when $3 > 0 then 1 else 0 end),
         losses = losses + (case when $3 < 0 then 1 else 0 end),
         best_symbol = case when best_pnl_sol is null or $3 > best_pnl_sol then $4 else best_symbol end,
         best_pnl_sol = greatest(coalesce(best_pnl_sol, $3), $3)
       where id = $1`,
      [echoId, proceeds, pnl, info.symbol],
    );
    await sql('update echo_positions set tokens = $3, cost_sol = $4 where echo_id = $1 and mint = $2',
      [echoId, event.mint, left <= pos.tokens * 1e-9 ? 0 : left, left <= pos.tokens * 1e-9 ? 0 : pos.cost_sol - costPart]);
    return t;
  });
}

// Value echoes: paper SOL + open coins at live price (cost if no price).
export async function valueEchoes(echoes) {
  if (!echoes.length) return [];
  const positions = await q(
    `select p.echo_id, p.mint, p.symbol, p.tokens, p.cost_sol, p.opened_at, t.icon
     from echo_positions p left join tokens t on t.mint = p.mint
     where p.echo_id = any($1) and p.tokens > 0`,
    [echoes.map((c) => c.id)],
  );
  const px = await pricesInSol(positions.map((p) => p.mint));
  const by = {};
  for (const p of positions) {
    const valueSol = px[p.mint] ? p.tokens * px[p.mint] : p.cost_sol;
    (by[p.echo_id] ||= []).push({
      mint: p.mint, symbol: p.symbol, icon: p.icon || '', tokens: p.tokens, costSol: p.cost_sol, valueSol,
      pnlPct: p.cost_sol > 0 ? ((valueSol - p.cost_sol) / p.cost_sol) * 100 : 0, priced: !!px[p.mint], openedAt: p.opened_at,
    });
  }
  return echoes.map((c) => {
    const held = (by[c.id] || []).sort((a, b) => b.valueSol - a.valueSol);
    return { ...c, positions: held, value: c.cash_sol + held.reduce((a, h) => a + h.valueSol, 0) };
  });
}
