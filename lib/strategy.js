// How an echo reacts to its original's real trade. Pure function (no I/O), unit-tested.
import { MIN_TRADE_SOL } from './env.js';

// k: how hard it leans on his conviction · floor/cap: min/max share of the echo's paper bag per entry
export const BUILDS = {
  Copycat: { k: 1.0, floor: 0.03, cap: 0.35, rule: 'Mirrors every buy and sell at his size.' },
  Scalper: { k: 1.5, floor: 0.04, cap: 0.30, rule: 'Copies fast. If he sells half or more, it dumps everything.' },
  Whale:   { k: 1.5, floor: 0.05, cap: 0.50, rule: 'Only copies entries of 1 SOL or more. Sizes up.' },
  Sniper:  { k: 2.0, floor: 0.05, cap: 0.40, rule: 'Only takes his first entry into a coin. Never adds.' },
  Degen:   { k: 3.0, floor: 0.06, cap: 0.50, rule: 'Triples his conviction. Up to half the bag on one coin.' },
  Swing:   { k: 1.0, floor: 0.04, cap: 0.40, rule: 'Holds 30 minutes minimum. Early sells only trim half.' },
};

const f = (n) => {
  if (n >= 100) return Math.round(n).toString();
  if (n >= 1) return (Math.round(n * 100) / 100).toString();
  return (Math.round(n * 1000) / 1000).toString();
};

/*
  build          one of BUILDS
  event          { side, mint, sol, tokens }   the original's real swap
  symbol         token symbol
  origSolAfter   original wallet SOL balance after the trade (null if unknown)
  origTokensLeft original's remaining tokens after a sell (null if unknown)
  cash           echo's paper SOL
  position       { tokens, openedAt } or null
  now            unix seconds
*/
export function decide(i) {
  const B = BUILDS[i.build] || BUILDS.Copycat;
  const { event } = i;
  const $ = `$${i.symbol}`;

  if (event.side === 'buy') {
    if (i.build === 'Whale' && event.sol < 1) return skip(`He bought ${f(event.sol)} SOL of ${$}. Whales only copy entries of 1 SOL or more.`);
    if (i.build === 'Sniper' && i.position) return skip(`He added to ${$}. Snipers only take the first entry.`);
    if (i.cash < MIN_TRADE_SOL) return skip(`He bought ${$}. I'm out of paper SOL until something sells.`);
    const known = typeof i.origSolAfter === 'number' && i.origSolAfter >= 0;
    const before = known ? i.origSolAfter + event.sol : 0;
    const frac = known && before > 0 ? Math.min(1, event.sol / before) : 0.1;
    let size = Math.min(Math.max(frac * B.k, B.floor), B.cap) * i.cash;
    size = Math.min(size, i.cash);
    if (size < MIN_TRADE_SOL) return skip(`He bought ${f(event.sol)} SOL of ${$}. My copy would be too small.`);
    const pct = Math.max(1, Math.round(frac * 100));
    return {
      action: 'buy', sol: size,
      reason: known
        ? `He bought ${f(event.sol)} SOL of ${$}, ${pct}% of his wallet. I went in with ${f(size)} SOL.`
        : `He bought ${f(event.sol)} SOL of ${$}. I went in with ${f(size)} SOL.`,
    };
  }

  if (!i.position || !(i.position.tokens > 0)) return skip(`He sold ${$}. I don't hold it.`);
  const left = typeof i.origTokensLeft === 'number' ? Math.max(0, i.origTokensLeft) : 0;
  const totalBefore = event.tokens + left;
  let frac = totalBefore > 0 ? Math.min(1, event.tokens / totalBefore) : 1;
  let why = '';
  if (i.build === 'Scalper' && frac >= 0.5 && frac < 1) { frac = 1; why = ' Scalpers dump it all.'; }
  if (i.build === 'Swing' && i.position.openedAt && i.now - i.position.openedAt < 1800) {
    frac = frac / 2;
    why = ' Too early for a swing, so I only trimmed half as much.';
  }
  const his = Math.max(1, Math.round((totalBefore > 0 ? event.tokens / totalBefore : 1) * 100));
  const mine = Math.max(1, Math.round(frac * 100));
  return { action: 'sell', fraction: frac, reason: `He sold ${his}% of his ${$}. I sold ${mine}% of mine.${why}` };
}

function skip(reason) {
  return { action: 'skip', reason };
}
