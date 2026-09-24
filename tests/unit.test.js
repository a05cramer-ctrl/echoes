import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, BUILDS } from '../lib/strategy.js';
import { parseSwap } from '../lib/helius.js';
import { reportFromSwaps, pickBuild } from '../lib/analyze.js';
import { isPubkey } from '../lib/rpc.js';
import { swapTx, transferTx, W1, MINT_A, MINT_B, USDC, SOL } from './fixtures.js';

const ev = (side, sol, tokens = 1000) => ({ side, mint: MINT_A, sol, tokens });
const base = { symbol: 'BONK', cash: 1, position: null, now: 10_000, origSolAfter: 9, origTokensLeft: 0 };

test('isPubkey accepts real keys and rejects junk', () => {
  assert.equal(isPubkey(W1), W1);
  assert.equal(isPubkey(SOL), SOL);
  assert.equal(isPubkey('  ' + W1 + ' '), W1);
  assert.equal(isPubkey('hello'), null);
  assert.equal(isPubkey(W1 + 'a'), null);
  assert.equal(isPubkey('0OIl' + W1.slice(4)), null);
});

test('copycat mirrors conviction: 1 SOL of a 10 SOL wallet = 10% of bag', () => {
  const d = decide({ ...base, build: 'Copycat', event: ev('buy', 1) });
  assert.equal(d.action, 'buy');
  assert.ok(Math.abs(d.sol - 0.1) < 1e-9, d.sol);
  assert.match(d.reason, /10% of his wallet/);
});

test('every build respects its floor and cap', () => {
  for (const [b, cfg] of Object.entries(BUILDS)) {
    const tiny = decide({ ...base, build: b, event: ev('buy', b === 'Whale' ? 1 : 0.01), origSolAfter: 10_000 });
    assert.equal(tiny.action, 'buy', b);
    assert.ok(Math.abs(tiny.sol - cfg.floor) < 1e-9, `${b} floor ${tiny.sol}`);
    const huge = decide({ ...base, build: b, event: ev('buy', 50), origSolAfter: 1 });
    assert.ok(Math.abs(huge.sol - cfg.cap) < 1e-9, `${b} cap ${huge.sol}`);
  }
});

test('degen triples conviction', () => {
  const d = decide({ ...base, build: 'Degen', event: ev('buy', 1) });
  assert.ok(Math.abs(d.sol - 0.3) < 1e-9, d.sol);
});

test('whale skips small entries, sniper skips adds', () => {
  assert.equal(decide({ ...base, build: 'Whale', event: ev('buy', 0.5) }).action, 'skip');
  assert.equal(decide({ ...base, build: 'Whale', event: ev('buy', 2) }).action, 'buy');
  const s = decide({ ...base, build: 'Sniper', event: ev('buy', 1), position: { tokens: 5, openedAt: 0 } });
  assert.equal(s.action, 'skip');
  assert.match(s.reason, /first entry/);
});

test('unknown wallet balance falls back to 10% conviction', () => {
  const d = decide({ ...base, build: 'Copycat', event: ev('buy', 1), origSolAfter: null });
  assert.ok(Math.abs(d.sol - 0.1) < 1e-9);
  assert.doesNotMatch(d.reason, /of his wallet/);
});

test('broke echo skips buys', () => {
  assert.equal(decide({ ...base, build: 'Degen', cash: 0.001, event: ev('buy', 1) }).action, 'skip');
});

test('sells mirror the fraction he sold', () => {
  const d = decide({ ...base, build: 'Copycat', event: ev('sell', 1, 250), origTokensLeft: 750, position: { tokens: 10, openedAt: 0 } });
  assert.equal(d.action, 'sell');
  assert.ok(Math.abs(d.fraction - 0.25) < 1e-9);
  assert.match(d.reason, /sold 25% of his/);
});

test('scalper dumps all when he sells half or more', () => {
  const d = decide({ ...base, build: 'Scalper', event: ev('sell', 1, 600), origTokensLeft: 400, position: { tokens: 10, openedAt: 0 } });
  assert.equal(d.fraction, 1);
});

test('swing only trims half when selling early', () => {
  const d = decide({ ...base, build: 'Swing', now: 1000, event: ev('sell', 1, 1000), origTokensLeft: 0, position: { tokens: 10, openedAt: 900 } });
  assert.equal(d.fraction, 0.5);
  const late = decide({ ...base, build: 'Swing', now: 10_000, event: ev('sell', 1, 1000), origTokensLeft: 0, position: { tokens: 10, openedAt: 900 } });
  assert.equal(late.fraction, 1);
});

test('sell without a position is a skip', () => {
  assert.equal(decide({ ...base, build: 'Copycat', event: ev('sell', 1) }).action, 'skip');
});

test('parseSwap reads buys and sells, ignores fees', () => {
  const b = parseSwap(swapTx({ wallet: W1, side: 'buy', mint: MINT_A, sol: 0.5, tokens: 1_000_000 }), W1);
  assert.equal(b.side, 'buy');
  assert.equal(b.mint, MINT_A);
  assert.ok(Math.abs(b.sol - 0.5) < 1e-9, b.sol);
  assert.equal(b.tokens, 1_000_000);
  const s = parseSwap(swapTx({ wallet: W1, side: 'sell', mint: MINT_A, sol: 0.8, tokens: 1_000_000 }), W1);
  assert.equal(s.side, 'sell');
  assert.ok(Math.abs(s.sol - 0.8) < 1e-9, s.sol);
});

test('parseSwap counts wrapped SOL as SOL', () => {
  const b = parseSwap(swapTx({ wallet: W1, side: 'buy', mint: MINT_B, sol: 2, tokens: 300, wsol: true }), W1);
  assert.equal(b.side, 'buy');
  assert.ok(Math.abs(b.sol - 2) < 1e-9, b.sol);
});

test('parseSwap ignores transfers, stablecoins, failed txs, other wallets', () => {
  assert.equal(parseSwap(transferTx(W1, 1), W1), null);
  assert.equal(parseSwap(swapTx({ wallet: W1, side: 'buy', mint: USDC, sol: 1, tokens: 150 }), W1), null);
  assert.equal(parseSwap({ ...swapTx({ wallet: W1, side: 'buy', mint: MINT_A, sol: 1, tokens: 5 }), transactionError: { x: 1 } }, W1), null);
  assert.equal(parseSwap(swapTx({ wallet: W1, side: 'buy', mint: MINT_A, sol: 1, tokens: 5 }), 'someoneElse'), null);
  assert.equal(parseSwap(null, W1), null);
});

test('reportFromSwaps computes real stats and picks a build', () => {
  const t0 = 1_760_000_000;
  const swaps = [];
  // 6 round trips, ~5 min holds, 4 winners
  for (let i = 0; i < 6; i++) {
    const mint = 'M' + i;
    swaps.push({ side: 'buy', mint, sol: 0.5, tokens: 100, ts: t0 + i * 3600 });
    swaps.push({ side: 'sell', mint, sol: i < 4 ? 0.9 : 0.2, tokens: 100, ts: t0 + i * 3600 + 300 });
  }
  const r = reportFromSwaps('w', swaps);
  assert.equal(r.swaps, 12);
  assert.equal(r.closed, 6);
  assert.equal(r.winRate, 0.67);
  assert.equal(r.medianHoldMin, 5);
  assert.equal(r.medianBuySol, 0.5);
  assert.ok(Math.abs(r.realizedSol - (4 * 0.4 - 2 * 0.3)) < 0.01);
  assert.equal(r.hours.reduce((a, b) => a + b, 0), 12);
  assert.equal(r.dna.length, 12);
  assert.equal(r.best[0].pnlSol, 0.4);
  assert.equal(r.worst[0].pnlSol, -0.3);
  assert.ok(['Scalper', 'Sniper'].includes(r.build), r.build);
  assert.ok(r.traits.speed >= 0 && r.traits.speed <= 3);
});

test('pickBuild rules', () => {
  assert.equal(pickBuild({ swaps: 0 }), 'Copycat');
  assert.equal(pickBuild({ swaps: 5, medianBuySol: 5 }), 'Whale');
  assert.equal(pickBuild({ swaps: 5, medianBuySol: 0.2, medianHoldMin: 4, tradesPerDay: 30 }), 'Scalper');
  assert.equal(pickBuild({ swaps: 5, medianBuySol: 0.2, medianHoldMin: 3000, tradesPerDay: 1 }), 'Swing');
  assert.equal(pickBuild({ swaps: 5, medianBuySol: 0.2, medianHoldMin: 120, tradesPerDay: 40, winRate: 0.3 }), 'Degen');
  assert.equal(pickBuild({ swaps: 5, medianBuySol: 0.2, medianHoldMin: 30, tradesPerDay: 2, winRate: 0.7 }), 'Sniper');
  assert.equal(pickBuild({ swaps: 5, medianBuySol: 0.2, medianHoldMin: 300, tradesPerDay: 2, winRate: 0.4 }), 'Copycat');
});

test('empty history is safe', () => {
  const r = reportFromSwaps('w', []);
  assert.equal(r.swaps, 0);
  assert.equal(r.build, 'Copycat');
  assert.equal(r.lastTradeAt, null);
});

test('round trips: re-trading the same coin counts separate holds', () => {
  const t0 = 1_760_000_000, s = [];
  for (let i = 0; i < 5; i++) {
    s.push({ side: 'buy', mint: 'SAME', sol: 1, tokens: 100, ts: t0 + i * 86400 });
    s.push({ side: 'buy', mint: 'SAME', sol: 1, tokens: 100, ts: t0 + i * 86400 + 30 });
    s.push({ side: 'sell', mint: 'SAME', sol: 1.5, tokens: 150, ts: t0 + i * 86400 + 120 });
    s.push({ side: 'sell', mint: 'SAME', sol: 0.8, tokens: 50, ts: t0 + i * 86400 + 180 });
  }
  s.push({ side: 'sell', mint: 'OLD', sol: 2, tokens: 10, ts: t0 + 5 }); // bought before the window: ignored
  const r = reportFromSwaps('w', s);
  assert.equal(r.closed, 5);
  assert.equal(r.medianHoldMin, 3);
  assert.equal(r.winRate, 1);
  assert.equal(r.realizedSol, 1.5);
  assert.equal(r.best[0].mint, 'SAME');
  assert.equal(r.open, 0);
  assert.equal(r.coins, 2);
});
