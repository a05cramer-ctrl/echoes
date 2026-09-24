// Real wallet report from on-chain swap history, and the build its echo gets.
import { parseSwap, walletHistory } from './helius.js';
import { tokenInfo } from './market.js';

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r2 = (n) => Math.round(n * 100) / 100;
const lvl = (v, steps) => steps.filter((s) => v >= s).length; // 0..steps.length

export function pickBuild(r) {
  if (!r.swaps) return 'Copycat';
  if (r.medianBuySol >= 3) return 'Whale';
  if (r.medianHoldMin > 0 && r.medianHoldMin <= 10 && r.tradesPerDay >= 5) return 'Scalper';
  if (r.medianHoldMin >= 24 * 60) return 'Swing';
  if (r.tradesPerDay >= 15 && r.winRate < 0.45) return 'Degen';
  if (r.medianHoldMin > 0 && r.medianHoldMin <= 60 && r.winRate >= 0.5) return 'Sniper';
  return 'Copycat';
}

export function reportFromSwaps(wallet, swaps) {
  swaps = swaps.filter(Boolean).sort((a, b) => a.ts - b.ts);
  const buys = swaps.filter((s) => s.side === 'buy'), sells = swaps.filter((s) => s.side === 'sell');
  const per = {}, trips = [];
  const hours = Array(24).fill(0);
  // Walk every coin as round trips: first buy opens, selling ~everything closes.
  for (const s of swaps) {
    const p = (per[s.mint] ||= { mint: s.mint, n: 0, qty: 0, bought: 0, solIn: 0, solOut: 0, openTs: null });
    p.n++;
    if (s.ts) hours[new Date(s.ts * 1000).getUTCHours()]++;
    if (s.side === 'buy') {
      if (p.openTs === null) { p.openTs = s.ts; p.qty = 0; p.bought = 0; p.solIn = 0; p.solOut = 0; }
      p.qty += s.tokens; p.bought += s.tokens; p.solIn += s.sol;
    } else if (p.openTs !== null) {
      p.qty -= s.tokens; p.solOut += s.sol;
      if (p.qty <= p.bought * 0.1) {
        trips.push({ mint: s.mint, hold: (s.ts - p.openTs) / 60, pnl: p.solOut - p.solIn });
        p.openTs = null; p.qty = 0;
      }
    }
  }
  const mints = Object.values(per);
  const wins = trips.filter((t) => t.pnl > 0);
  const span = swaps.length ? Math.max(1, (swaps[swaps.length - 1].ts - swaps[0].ts) / 86400) : 0;
  const byMint = {};
  for (const t of trips) byMint[t.mint] = (byMint[t.mint] || 0) + t.pnl;
  const ranked = Object.entries(byMint).map(([mint, pnl]) => ({ mint, pnl })).sort((a, b) => b.pnl - a.pnl);
  const fav = [...mints].sort((a, b) => b.n - a.n)[0];
  const r = {
    wallet,
    swaps: swaps.length,
    buys: buys.length,
    sells: sells.length,
    coins: mints.length,
    days: Math.round(span * 10) / 10,
    tradesPerDay: swaps.length ? Math.round((swaps.length / span) * 10) / 10 : 0,
    avgBuySol: buys.length ? r2(buys.reduce((a, b) => a + b.sol, 0) / buys.length) : 0,
    medianBuySol: r2(median(buys.map((b) => b.sol))),
    biggestBuySol: r2(buys.reduce((a, b) => Math.max(a, b.sol), 0)),
    volumeSol: r2(swaps.reduce((a, s) => a + s.sol, 0)),
    medianHoldMin: Math.round(median(trips.map((t) => t.hold))),
    winRate: trips.length ? r2(wins.length / trips.length) : 0,
    closed: trips.length,
    open: mints.filter((p) => p.openTs !== null).length,
    realizedSol: r2(trips.reduce((a, t) => a + t.pnl, 0)),
    firstTradeAt: swaps.length ? swaps[0].ts : null,
    lastTradeAt: swaps.length ? swaps[swaps.length - 1].ts : null,
    hours,
    dna: swaps.slice(-48).map((s) => ({ s: s.side === 'buy' ? 'b' : 's', sol: r2(s.sol) })),
    best: ranked.filter((x) => x.pnl > 0).slice(0, 3).map((x) => ({ mint: x.mint, pnlSol: r2(x.pnl) })),
    worst: ranked.filter((x) => x.pnl < 0).slice(-1).map((x) => ({ mint: x.mint, pnlSol: r2(x.pnl) })),
    favorite: fav ? { mint: fav.mint, count: fav.n } : null,
  };
  r.build = pickBuild(r);
  // 0-3 bars for the character card
  r.traits = {
    speed: lvl(r.tradesPerDay, [2, 8, 25]),
    size: lvl(r.medianBuySol, [0.3, 1, 3]),
    nerve: lvl(r.medianHoldMin, [30, 240, 1440]),
  };
  return r;
}

export async function analyzeWallet(wallet) {
  const txs = await walletHistory(wallet, 2);
  const r = reportFromSwaps(wallet, txs.map((t) => parseSwap(t, wallet)));
  r.scannedTxs = txs.length;
  for (const b of [...r.best, ...r.worst, ...(r.favorite ? [r.favorite] : [])]) {
    const t = await tokenInfo(b.mint);
    b.symbol = t.symbol;
    b.icon = t.icon;
  }
  r.at = Math.floor(Date.now() / 1000);
  return r;
}
