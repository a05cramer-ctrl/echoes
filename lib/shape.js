// Public shape of an echo (never includes who created it).
import { START_SOL } from './env.js';

export const shape = (c) => ({
  id: c.id, name: c.name, build: c.build, source_wallet: c.source_wallet, created_at: c.created_at,
  cash: c.cash_sol, value: c.value, pnlPct: ((c.value - START_SOL) / START_SOL) * 100,
  trades: c.trades, wins: c.wins, losses: c.losses, realized: c.realized_sol,
  best: c.best_symbol ? { symbol: c.best_symbol, pnlSol: c.best_pnl_sol } : null,
  lastTradeAt: c.last_trade_at, positions: c.positions,
});
