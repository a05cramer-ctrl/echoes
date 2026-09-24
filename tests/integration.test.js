// Runs the real API handlers against a real Postgres, with Helius/Jupiter/DexScreener faked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { install, state, call } from './mockweb.js';
import { swapTx, transferTx, W1, W2, MINT_A, MINT_B, SOL } from './fixtures.js';

execSync(`psql -h 127.0.0.1 -p 5433 -U postgres -qc "drop database if exists echoes_test" -c "create database echoes_test"`);
process.env.POSTGRES_URL = 'postgres://postgres@127.0.0.1:5433/echoes_test?sslmode=require';
process.env.HELIUS_API_KEY = 'test-helius';
install();

const api = {};
for (const n of ['analyze', 'echo', 'echoes', 'agent', 'feed', 'stats', 'webhook']) api[n] = (await import(`../api/${n}.js`)).default;
const { env } = await import('../lib/env.js');
const { close, q } = await import('../lib/db.js');
const AUTH = { authorization: env.HELIUS_WEBHOOK_SECRET };

// W1: fast in-and-out trader.  W2: whale.
const t0 = 1_760_000_000;
state.history[W1] = [];
for (let i = 0; i < 8; i++) {
  state.history[W1].push(swapTx({ wallet: W1, side: 'buy', mint: 'Coin' + i + 'x'.repeat(10), sol: 0.4, tokens: 1000, ts: t0 + i * 1800 }));
  state.history[W1].push(swapTx({ wallet: W1, side: 'sell', mint: 'Coin' + i + 'x'.repeat(10), sol: i % 3 ? 0.7 : 0.2, tokens: 1000, ts: t0 + i * 1800 + 240 }));
}
state.history[W1].push(transferTx(W1, 3));
state.history[W1].reverse(); // helius returns newest first
state.history[W2] = [swapTx({ wallet: W2, side: 'buy', mint: MINT_B, sol: 25, tokens: 5000, ts: t0 }), swapTx({ wallet: W2, side: 'buy', mint: MINT_A, sol: 10, tokens: 9000, ts: t0 + 60 })];
state.tokens[MINT_A] = { symbol: 'BONK', name: 'Bonk', icon: 'https://img.test/bonk.png' };
state.tokens[MINT_B] = { symbol: 'WIF', name: 'dogwifhat', icon: 'javascript:alert(1)' };
state.tokens['Coin1xxxxxxxxxx'] = { symbol: 'NEWPUMP', name: 'fresh', icon: '', dasOnly: true };
state.balances[W1] = 9;
state.balances[W2] = 400;

test.after(async () => { await close(); });

let c1, c2, c3;

test('stats on an empty lab', async () => {
  const r = await call(api.stats);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.echoes, 0);
  assert.equal(r.body.echoTrades, 0);
  assert.equal(r.body.solUsd, 200);
  assert.deepEqual(r.body.ready, { database: true, helius: true });
});

test('analyze rejects junk and reads real history', async () => {
  assert.equal((await call(api.analyze, { query: { wallet: 'nope' } })).status, 400);
  const r = await call(api.analyze, { query: { wallet: W1 } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.swaps, 16);
  assert.equal(r.body.closed, 8);
  assert.equal(r.body.medianHoldMin, 4);
  assert.equal(r.body.build, 'Scalper');
  assert.equal(r.body.scannedTxs, 17);
  const again = await call(api.analyze, { query: { wallet: W1 } });
  assert.equal(again.body.cached, true);
  const w2 = await call(api.analyze, { query: { wallet: W2 } });
  assert.equal(w2.body.build, 'Whale');
});

test('grow echoes', async () => {
  let r = await call(api.echo, { method: 'POST', body: { wallet: W1, name: 'night<owl>!' }, ip: '2.2.2.2' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  c1 = r.body.echo;
  assert.equal(c1.name, 'nightowl.echo');
  assert.equal(c1.build, 'Scalper');
  assert.equal(c1.cash_sol, 1);
  assert.equal(r.body.echo.created_ip, undefined);
  assert.equal(state.hooks.length, 1);
  assert.deepEqual(state.hooks[0].accountAddresses, [W1]);
  assert.equal(state.hooks[0].webhookURL, 'https://echoes.test/api/webhook');
  assert.equal(state.hooks[0].authHeader, env.HELIUS_WEBHOOK_SECRET);

  r = await call(api.echo, { method: 'POST', body: { wallet: W1, name: 'nightowl' }, ip: '3.3.3.3' });
  assert.equal(r.status, 200);
  c2 = r.body.echo;
  assert.equal(c2.name, "nightowl.echo"); // same name is allowed, each echo has its own id
  assert.equal(state.hooks.length, 1);
  assert.equal(state.hooks[0].accountAddresses.length, 1);

  r = await call(api.echo, { method: 'POST', body: { wallet: W2 }, ip: '2.2.2.2' });
  c3 = r.body.echo;
  assert.equal(c3.build, 'Whale');
  assert.equal(c3.name, W2.slice(0, 4) + W2.slice(-4) + '.echo');
  assert.deepEqual(state.hooks[0].accountAddresses, [W1, W2]);
});

test('echo guards: dupes, junk, empty wallets, rate limit', async () => {
  assert.equal((await call(api.echo, { method: 'POST', body: { wallet: W1 }, ip: '2.2.2.2' })).status, 409);
  assert.equal((await call(api.echo, { method: 'POST', body: { wallet: 'x' } })).status, 400);
  assert.equal((await call(api.echo, { method: 'GET' })).status, 405);
  const empty = '11111111111111111111111111111112';
  const r = await call(api.echo, { method: 'POST', body: { wallet: empty }, ip: '4.4.4.4' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /no swaps/);
  // 2.2.2.2 already made 2; third attempt counted (empty), fourth blocked
  state.history['So11111111111111111111111111111111111111112'] = [swapTx({ wallet: SOL, side: 'buy', mint: MINT_A, sol: 1, tokens: 1 })];
  assert.equal((await call(api.echo, { method: 'POST', body: { wallet: SOL }, ip: '2.2.2.2' })).status, 200);
  const blocked = await call(api.echo, { method: 'POST', body: { wallet: '11111111111111111111111111111113' }, ip: '2.2.2.2' });
  assert.equal(blocked.status, 429);
});

test('webhook needs the secret', async () => {
  const r = await call(api.webhook, { method: 'POST', body: [], headers: { authorization: 'wrong' } });
  assert.equal(r.status, 401);
});

test('original buys -> echoes buy on paper at his fill price', async () => {
  // W1 had 10 SOL, buys 1 SOL of BONK (10% of wallet)
  const tx = swapTx({ wallet: W1, side: 'buy', mint: MINT_A, sol: 1, tokens: 1_000_000, signature: 'LIVE1' });
  const r = await call(api.webhook, { method: 'POST', body: [tx, transferTx(W1, 1)], headers: AUTH });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.handled, 2);
  const again = await call(api.webhook, { method: 'POST', body: [tx], headers: AUTH });
  assert.equal(again.body.handled, 0, 'retries are ignored');

  const [a] = await q('select * from echoes where id = $1', [c1.id]);
  // Scalper k=1.5 -> 15% of 1 SOL
  assert.ok(Math.abs(a.cash_sol - 0.85) < 1e-9, a.cash_sol);
  assert.equal(a.trades, 1);
  const [p] = await q('select * from echo_positions where echo_id = $1', [c1.id]);
  assert.ok(Math.abs(p.tokens - 150_000) < 1e-6, p.tokens); // 0.15 SOL at 1e-6 SOL/token
  assert.equal(p.symbol, 'BONK');
});

test('whale echo skips small buys with a reason', async () => {
  state.balances[W2] = 399;
  await call(api.webhook, { method: 'POST', body: [swapTx({ wallet: W2, side: 'buy', mint: MINT_A, sol: 0.5, tokens: 100, signature: 'LIVE2' })], headers: AUTH });
  const [t] = await q('select * from echo_trades where echo_id = $1', [c3.id]);
  assert.equal(t.side, 'skip');
  assert.match(t.reason, /Whales only copy entries of 1 SOL or more/);
  const [c] = await q('select cash_sol from echoes where id = $1', [c3.id]);
  assert.equal(c.cash_sol, 1);
});

test('original sells 40% at 2x -> echoes sell 40% with realized profit', async () => {
  state.tokenBalances[`${W1}:${MINT_A}`] = 600_000;
  await call(api.webhook, { method: 'POST', body: [swapTx({ wallet: W1, side: 'sell', mint: MINT_A, sol: 0.8, tokens: 400_000, signature: 'LIVE3', ts: 1_760_000_900 })], headers: AUTH });
  const [a] = await q('select * from echoes where id = $1', [c1.id]);
  // sold 60k tokens at 2e-6 = 0.12 SOL, cost part 0.06
  assert.ok(Math.abs(a.cash_sol - 0.97) < 1e-9, a.cash_sol);
  assert.ok(Math.abs(a.realized_sol - 0.06) < 1e-9, a.realized_sol);
  assert.equal(a.wins, 1);
  assert.equal(a.best_symbol, 'BONK');
  const [p] = await q('select * from echo_positions where echo_id = $1', [c1.id]);
  assert.ok(Math.abs(p.tokens - 90_000) < 1e-6);
  const [t] = await q(`select * from echo_trades where echo_id = $1 and side = 'sell'`, [c1.id]);
  assert.match(t.reason, /He sold 40% of his \$BONK\. I sold 100% of mine\. Scalpers dump it all\.|He sold 40% of his \$BONK\. I sold 40% of mine\./);
});

test('echoes endpoint values bags at live prices', async () => {
  state.usd[MINT_A] = 200 * 3e-6; // BONK now 3e-6 SOL
  const r = await call(api.echoes);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const a = r.body.find((c) => c.id === c1.id);
  assert.ok(Math.abs(a.value - (0.97 + 90_000 * 3e-6)) < 1e-9, a.value);
  assert.ok(Math.abs(a.pnlPct - 24) < 1e-6, a.pnlPct);
  assert.equal(a.positions[0].symbol, 'BONK');
  assert.equal(a.positions[0].icon, 'https://img.test/bonk.png');
  assert.equal(a.created_ip, undefined);
  assert.equal(r.headers['cache-control'].includes('s-maxage=10'), true);
});

test('price fallbacks: dexscreener, then last fill', async () => {
  state.jupDown = true;
  state.dexUsd[MINT_A] = 200 * 4e-6;
  const { pricesInSol, solUsd } = await import('../lib/market.js');
  let px = await pricesInSol([MINT_A]);
  assert.ok(Math.abs(px[MINT_A] - 4e-6) < 1e-12, px[MINT_A]);
  delete state.dexUsd[MINT_A];
  px = await pricesInSol([MINT_A]);
  assert.ok(Math.abs(px[MINT_A] - 2e-6) < 1e-12, 'last fill ' + px[MINT_A]);
  state.jupDown = false;
  assert.equal(await solUsd(), 200);
});

test('token names: brand new pump coin resolves through Helius DAS; bad icons dropped', async () => {
  const { tokenInfo } = await import('../lib/market.js');
  assert.equal((await tokenInfo('Coin1xxxxxxxxxx')).symbol, 'NEWPUMP');
  assert.equal((await tokenInfo(MINT_B)).icon, '');
});

test('feed shows original move + echo reaction', async () => {
  const r = await call(api.feed);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.length >= 5);
  const sell = r.body.find((x) => x.side === 'sell');
  assert.equal(sell.origSide, 'sell');
  assert.equal(sell.origSol, 0.8);
  assert.equal(sell.symbol, 'BONK');
  assert.equal(sell.original, W1);
  assert.ok(sell.echoId);
  assert.ok(r.body[0].id > r.body[r.body.length - 1].id);
  const noSkips = await call(api.feed, { query: { skips: '0' } });
  assert.ok(noSkips.body.every((x) => x.side !== 'skip'));
});

test('agent page', async () => {
  const r = await call(api.agent, { query: { id: c1.id } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.echo.name, 'nightowl.echo');
  assert.equal(r.body.trades.length, 2);
  assert.equal(r.body.report.build, 'Scalper');
  assert.equal(r.body.siblings.length, 1);
  assert.equal((await call(api.agent, { query: { id: 'x' } })).status, 400);
  assert.equal((await call(api.agent, { query: { id: '00000000-0000-0000-0000-000000000000' } })).status, 404);
});

test('stats add up', async () => {
  const r = await call(api.stats);
  assert.equal(r.body.echoes, 4);
  assert.equal(r.body.originals, 3);
  assert.equal(r.body.echoTrades, 4);
  assert.equal(r.body.skips, 1);
  assert.equal(r.body.originalTrades, 3);
  assert.equal(r.body.topOriginals[0].wallet, W1);
  assert.equal(r.body.topOriginals[0].echoes, 2);
  assert.ok(r.body.recentScans.length >= 2);
});

test('parallel webhooks never double-spend an echo', async () => {
  state.balances[W1] = 5;
  const txs = Array.from({ length: 12 }, (_, i) => swapTx({ wallet: W1, side: 'buy', mint: MINT_B, sol: 1, tokens: 100, signature: 'PAR' + i }));
  const [before] = await q('select cash_sol from echoes where id = $1', [c1.id]);
  await Promise.all(txs.map((t) => call(api.webhook, { method: 'POST', body: [t], headers: AUTH })));
  const [after] = await q('select cash_sol, trades from echoes where id = $1', [c1.id]);
  const spent = (await q(`select coalesce(sum(sol_amount),0) s from echo_trades where echo_id = $1 and source_signature like 'PAR%' and side = 'buy'`, [c1.id]))[0].s;
  assert.ok(Math.abs(before.cash_sol - after.cash_sol - spent) < 1e-9, `${before.cash_sol} - ${after.cash_sol} vs ${spent}`);
  assert.ok(after.cash_sol >= 0);
});
