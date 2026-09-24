/* PREVIEW BUILD ONLY. Sample data so the page can be looked at before the backend is connected.
   The real site (public/index.html) does not include this file. */
(() => {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:400;background:#ffd23f;color:#1d1600;font:700 14px "Pixelify Sans",monospace;padding:8px 14px;border-radius:10px;box-shadow:0 4px 0 #000;white-space:nowrap';
  bar.textContent = 'PREVIEW · sample data, not live';
  document.body.append(bar);

  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let seed = 12345;
  const rr = () => ((seed = Math.imul(seed ^ (seed >>> 15), seed | 1) + 0x6d2b79f5 | 0) >>> 0) / 4294967296;
  const key = () => { let s = ''; for (let i = 0; i < 44; i++) s += B58[(rr() * 58) | 0]; return s; };
  const uuid = () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((rr() * 16) | 0).toString(16));
  const pickr = (a) => a[(rr() * a.length) | 0];
  const now = () => new Date().toISOString();

  const BUILDS = {
    Copycat: { k: 1.0, floor: 0.03, cap: 0.35 }, Scalper: { k: 1.5, floor: 0.04, cap: 0.30 }, Whale: { k: 1.5, floor: 0.05, cap: 0.50 },
    Sniper: { k: 2.0, floor: 0.05, cap: 0.40 }, Degen: { k: 3.0, floor: 0.06, cap: 0.50 }, Swing: { k: 1.0, floor: 0.04, cap: 0.40 },
  };
  const f = (n) => (n >= 1 ? (Math.round(n * 100) / 100) : (Math.round(n * 1000) / 1000)).toString();
  function decide(i) {
    const B = BUILDS[i.build], $ = '$' + i.symbol, e = i.event;
    if (e.side === 'buy') {
      if (i.build === 'Whale' && e.sol < 1) return { action: 'skip', reason: `He bought ${f(e.sol)} SOL of ${$}. Whales only copy entries of 1 SOL or more.` };
      if (i.build === 'Sniper' && i.position) return { action: 'skip', reason: `He added to ${$}. Snipers only take the first entry.` };
      if (i.cash < 0.005) return { action: 'skip', reason: `He bought ${$}. I'm out of paper SOL until something sells.` };
      const frac = Math.min(1, e.sol / (i.origSolAfter + e.sol));
      const size = Math.min(Math.min(Math.max(frac * B.k, B.floor), B.cap) * i.cash, i.cash);
      return { action: 'buy', sol: size, reason: `He bought ${f(e.sol)} SOL of ${$}, ${Math.max(1, Math.round(frac * 100))}% of his wallet. I went in with ${f(size)} SOL.` };
    }
    if (!i.position) return { action: 'skip', reason: `He sold ${$}. I don't hold it.` };
    let frac = e.frac, why = '';
    if (i.build === 'Scalper' && frac >= 0.5 && frac < 1) { frac = 1; why = ' Scalpers dump it all.'; }
    if (i.build === 'Swing' && Date.now() - i.position.openedAt < 1800e3) { frac /= 2; why = ' Too early for a swing, so I only trimmed half as much.'; }
    return { action: 'sell', fraction: frac, reason: `He sold ${Math.round(e.frac * 100)}% of his ${$}. I sold ${Math.round(frac * 100)}% of mine.${why}` };
  }

  const COINS = ['BLORP', 'ZAPCAT', 'MOONPIE', 'GLITCH', 'NUGGET', 'SPROUT', 'WOBBLE', 'PIXEL', 'TOAST', 'BEEP', 'NOODLE', 'COMET'].map((s) => ({ symbol: s, mint: key(), px: 1e-6 * (1 + rr() * 60) }));
  const STYLES = ['Scalper', 'Whale', 'Sniper', 'Degen', 'Copycat', 'Swing', 'Scalper', 'Degen', 'Copycat'];
  const ORIGS = STYLES.map((b) => ({ w: key(), build: b, bal: b === 'Whale' ? 600 : 5 + rr() * 30, hold: {} }));
  const NAMES = ['nightowl', 'gmgirl', 'apebot', 'chadwick', 'lilbyte', 'jeetkiller', 'moonboi', 'bagz', 'wenlambo', 'sers', 'copium', 'hodlr', 'fren', 'gigabrain', 'npc420', 'basedbot'];
  const echoes = [], trades = [], reports = {}, byId = {};
  let tid = 0;

  function report(w, build) {
    if (reports[w]) return reports[w];
    const r0 = seed; seed = [...w].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7);
    const swaps = 40 + ((rr() * 160) | 0), days = Math.round((1 + rr() * 6) * 10) / 10, closed = (swaps / 2.3) | 0;
    const B = build || pickr(Object.keys(BUILDS));
    const hold = { Scalper: 4, Whale: 180, Sniper: 25, Degen: 90, Copycat: 140, Swing: 2200 }[B] * (0.6 + rr() * 0.8);
    const buyS = B === 'Whale' ? 4 + rr() * 10 : 0.2 + rr() * 1.2;
    const r = {
      wallet: w, swaps, buys: (swaps / 2) | 0, sells: swaps - ((swaps / 2) | 0), coins: 6 + ((rr() * 20) | 0), days, tradesPerDay: Math.round((swaps / days) * 10) / 10,
      avgBuySol: buyS, medianBuySol: Math.round(buyS * 100) / 100, biggestBuySol: Math.round(buyS * 3 * 100) / 100, medianHoldMin: Math.round(hold),
      winRate: Math.round((0.35 + rr() * 0.4) * 100) / 100, closed, open: (rr() * 4) | 0, realizedSol: Math.round((rr() * 14 - 4) * 100) / 100,
      hours: Array.from({ length: 24 }, () => (rr() * 12) | 0), dna: Array.from({ length: 48 }, () => ({ s: rr() < 0.5 ? 'b' : 's', sol: Math.round(buyS * (0.2 + rr() * 2) * 100) / 100 })),
      best: [0, 1].map(() => { const c = pickr(COINS); return { mint: c.mint, symbol: c.symbol, pnlSol: Math.round(rr() * 300) / 100, icon: '' }; }).sort((a, b) => b.pnlSol - a.pnlSol),
      worst: [{ ...(() => { const c = pickr(COINS); return { mint: c.mint, symbol: c.symbol }; })(), pnlSol: -Math.round(rr() * 150) / 100, icon: '' }],
      favorite: (() => { const c = pickr(COINS); return { mint: c.mint, symbol: c.symbol, count: 5 + ((rr() * 20) | 0), icon: '' }; })(),
      build: B, scannedTxs: swaps + ((rr() * 40) | 0), at: Math.floor(Date.now() / 1000) - 60,
    };
    seed = r0; reports[w] = r; return r;
  }

  function addEcho(o, name, ago) {
    const c = { id: uuid(), name: name + '.echo', source_wallet: o.w, build: o.build, created_at: new Date(Date.now() - ago).toISOString(), cash: 1, pos: {}, trades: 0, wins: 0, losses: 0, realized: 0, best: null, lastTradeAt: null };
    echoes.push(c); byId[c.id] = c; report(o.w, o.build); return c;
  }
  ORIGS.forEach((o, i) => { addEcho(o, NAMES[i], (20 - i) * 3600e3); if (i % 2 === 0) addEcho(o, NAMES[i + 8] || NAMES[i] + '2', (10 - i) * 3600e3); });

  function fire(silentAt) {
    const o = pickr(ORIGS), c = pickr(COINS);
    const held = o.hold[c.mint] || 0;
    let ev;
    if (held > 0 && rr() < 0.5) { const frac = rr() < 0.5 ? 1 : 0.3 + rr() * 0.5, tok = held * frac; o.hold[c.mint] = held - tok; ev = { side: 'sell', sol: tok * c.px, tokens: tok, frac }; o.bal += ev.sol; }
    else { const sol = o.build === 'Whale' ? 0.5 + rr() * 12 : 0.05 + rr() * 2; ev = { side: 'buy', sol, tokens: sol / c.px }; o.hold[c.mint] = held + ev.tokens; o.bal = Math.max(0.5, o.bal - sol); }
    const sig = key() + key().slice(0, 44);
    for (const cl of echoes.filter((x) => x.source_wallet === o.w)) {
      const p = cl.pos[c.mint];
      const d = decide({ build: cl.build, event: ev, symbol: c.symbol, origSolAfter: o.bal, cash: cl.cash, position: p && p.tokens > 0 ? p : null });
      const at = silentAt ? new Date(silentAt).toISOString() : now();
      const row = { id: ++tid, at, side: d.action === 'skip' ? 'skip' : d.action, symbol: c.symbol, mint: c.mint, sol: null, pnl: null, reason: d.reason, signature: sig, echoId: cl.id, echo: cl.name, build: cl.build, original: o.w, origSide: ev.side, origSol: ev.sol, icon: '' };
      if (d.action === 'buy') {
        cl.cash -= d.sol; const pp = (cl.pos[c.mint] ||= { tokens: 0, cost: 0, openedAt: Date.now(), symbol: c.symbol, mint: c.mint });
        if (pp.tokens <= 0) pp.openedAt = Date.now(); pp.tokens += d.sol / c.px; pp.cost += d.sol; row.sol = d.sol; cl.trades++; cl.lastTradeAt = at;
      } else if (d.action === 'sell') {
        const tok = p.tokens * d.fraction, proceeds = tok * c.px, cost = p.cost * d.fraction, pnl = proceeds - cost;
        p.tokens -= tok; p.cost -= cost; cl.cash += proceeds; row.sol = proceeds; row.pnl = pnl; cl.trades++; cl.realized += pnl; cl.lastTradeAt = at;
        if (pnl > 0) cl.wins++; else if (pnl < 0) cl.losses++;
        if (!cl.best || pnl > cl.best.pnlSol) cl.best = { symbol: c.symbol, pnlSol: pnl };
      }
      trades.push(row);
    }
  }
  function drift() { for (const c of COINS) c.px *= Math.exp((rr() - 0.495) * 0.035); }
  for (let i = 0; i < 90; i++) { drift(); fire(Date.now() - (90 - i) * 40e3); }
  setInterval(() => { drift(); if (rr() < 0.8) fire(); }, 2600);

  const coinBy = Object.fromEntries(COINS.map((c) => [c.mint, c]));
  function shape(c) {
    const positions = Object.values(c.pos).filter((p) => p.tokens > 1e-9).map((p) => { const v = p.tokens * coinBy[p.mint].px; return { mint: p.mint, symbol: p.symbol, icon: '', tokens: p.tokens, costSol: p.cost, valueSol: v, pnlPct: p.cost > 0 ? (v - p.cost) / p.cost * 100 : 0, priced: true, openedAt: new Date(p.openedAt).toISOString() }; }).sort((a, b) => b.valueSol - a.valueSol);
    const value = c.cash + positions.reduce((a, p) => a + p.valueSol, 0);
    return { id: c.id, name: c.name, build: c.build, source_wallet: c.source_wallet, created_at: c.created_at, cash: c.cash, value, pnlPct: (value - 1) * 100, trades: c.trades, wins: c.wins, losses: c.losses, realized: c.realized, best: c.best, lastTradeAt: c.lastTradeAt, positions };
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const err = (m, s) => Object.assign(new Error(m), { status: s });

  window.ECHO_API = {
    async get(path) {
      await wait(120);
      const [p, qs] = path.split('?'); const q = new URLSearchParams(qs || '');
      if (p === 'stats') {
        const real = trades.filter((t) => t.side !== 'skip');
        const top = {}; for (const c of echoes) (top[c.source_wallet] ||= { wallet: c.source_wallet, echoes: 0, build: c.build }).echoes++;
        return { echoes: echoes.length, originals: new Set(echoes.map((c) => c.source_wallet)).size, echoTrades: real.length, skips: trades.length - real.length, trades24h: real.length, paperVolume: real.reduce((a, t) => a + (t.sol || 0), 0), originalTrades: new Set(trades.map((t) => t.signature)).size, scans: Object.keys(reports).length, topOriginals: Object.values(top).sort((a, b) => b.echoes - a.echoes).slice(0, 8), recentScans: Object.values(reports).slice(-3).map((r) => ({ wallet: r.wallet, build: r.build, swaps: r.swaps, winRate: r.winRate, realizedSol: r.realizedSol })), solUsd: 0, ready: { database: true, helius: true } };
      }
      if (p === 'echoes') return echoes.map(shape);
      if (p === 'feed') return trades.slice(-50).reverse();
      if (p === 'analyze') { await wait(1400); const w = q.get('wallet'); const known = ORIGS.find((o) => o.w === w); return report(w, known?.build); }
      if (p === 'agent') { const c = byId[q.get('id')]; if (!c) throw err('That echo does not exist', 404); return { echo: shape(c), trades: trades.filter((t) => t.echoId === c.id).slice(-80).reverse(), report: reports[c.source_wallet], siblings: echoes.filter((x) => x.source_wallet === c.source_wallet && x.id !== c.id).map((x) => ({ id: x.id, name: x.name, build: x.build })) }; }
      throw err('not found', 404);
    },
    async post(path, body) {
      await wait(1600);
      if (path !== 'echo') throw err('not found', 404);
      const r = report(body.wallet);
      if (!r.swaps) throw err('That wallet has no swaps to learn from.', 400);
      let o = ORIGS.find((x) => x.w === body.wallet);
      if (!o) { o = { w: body.wallet, build: r.build, bal: 10 + rr() * 20, hold: {} }; ORIGS.push(o); }
      let name = String(body.name || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 16) || body.wallet.slice(0, 4) + body.wallet.slice(-4);
      const c = addEcho(o, name, 0);
      return { echo: { id: c.id, name: c.name, source_wallet: c.source_wallet, build: c.build, cash_sol: 1, created_at: c.created_at, value: 1, pnlPct: 0, trades: 0, positions: [] }, report: r };
    },
  };
  // the preview can't reach DexScreener, so the coin panel says so instead of inventing numbers
  const realFetch = window.fetch.bind(window);
  window.fetch = (u, o) => (String(u).includes('dexscreener') ? Promise.reject(new Error('preview')) : realFetch(u, o));
  addEventListener('DOMContentLoaded', () => {});
  setTimeout(() => document.querySelectorAll('#tokr b').forEach((b) => (b.textContent = 'live on site')), 50);
})();
