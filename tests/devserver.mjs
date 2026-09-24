// Local full-stack server: real API handlers + real Postgres, fake Helius/Jupiter, optional market simulator.
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { install, state } from './mockweb.js';
import { swapTx } from './fixtures.js';

const args = new Set(process.argv.slice(2));
const PORT = Number(process.env.PORT || 8787);
const DB = args.has('--empty') ? 'echoes_empty' : 'echoes_dev';
if (args.has('--reset')) execSync(`psql -h 127.0.0.1 -p 5433 -U postgres -qc "drop database if exists ${DB}" -c "create database ${DB}"`);
process.env.POSTGRES_URL = `postgres://postgres@127.0.0.1:5433/${DB}`;
if (!args.has('--nohelius')) process.env.HELIUS_API_KEY = 'test-helius';
install();

const api = {};
for (const n of ['analyze', 'echo', 'echoes', 'agent', 'feed', 'stats', 'webhook']) api[n] = (await import(`../api/${n}.js`)).default;
const { env } = await import('../lib/env.js');

// ---- a little fake market ----
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const seedRand = (s) => () => ((s = Math.imul(s ^ (s >>> 15), s | 1) + 0x6d2b79f5 | 0) >>> 0) / 4294967296;
const rr = seedRand(7);
const key = () => { for (;;) { let s = ''; for (let i = 0; i < 44; i++) s += B58[(rr() * 58) | 0]; if (/^[1-9A-HJ-NP-Za-km-z]{44}$/.test(s)) { const n = [...s].reduce((a, c) => a * 58n + BigInt(B58.indexOf(c)), 0n); if (n < 2n ** 256n && n >= 2n ** 248n) return s; } } };
const COINS = ['GIGA', 'PNUT', 'MOODENG', 'FARTCOIN', 'CHILLGUY', 'GOAT', 'ZEREBRO', 'AURA', 'SPX', 'POPCAT', 'MEW', 'BRETT', 'NEIRO', 'LUCE', 'FWOG', 'BOME'].map((s) => ({ symbol: s, mint: key(), px: 1e-6 * (1 + rr() * 50) }));
for (const c of COINS) { state.tokens[c.mint] = { symbol: c.symbol, name: c.symbol.toLowerCase(), icon: '' }; state.usd[c.mint] = c.px * 200; }
const ORIGS = Array.from({ length: 9 }, (_, i) => ({ w: key(), style: ['scalp', 'whale', 'degen', 'swing', 'snipe', 'mirror', 'scalp', 'degen', 'mirror'][i], hold: {} }));
const t0 = Math.floor(Date.now() / 1000) - 5 * 86400;
for (const o of ORIGS) {
  state.balances[o.w] = o.style === 'whale' ? 800 : 5 + rr() * 40;
  const h = [];
  const n = o.style === 'degen' ? 90 : o.style === 'scalp' ? 70 : o.style === 'whale' ? 12 : 30;
  for (let i = 0; i < n; i++) {
    const c = COINS[(rr() * COINS.length) | 0];
    const sol = o.style === 'whale' ? 3 + rr() * 20 : 0.1 + rr() * 1.5;
    const ts = t0 + Math.floor((i / n) * 5 * 86400);
    const hold = o.style === 'swing' ? 86400 * (1 + rr()) : o.style === 'scalp' ? 60 + rr() * 400 : o.style === 'snipe' ? 300 + rr() * 2000 : 600 + rr() * 8000;
    h.push(swapTx({ wallet: o.w, side: 'buy', mint: c.mint, sol, tokens: sol / c.px, ts }));
    h.push(swapTx({ wallet: o.w, side: 'sell', mint: c.mint, sol: sol * (0.4 + rr() * 1.4), tokens: sol / c.px, ts: ts + Math.floor(hold) }));
  }
  state.history[o.w] = h.sort((a, b) => b.timestamp - a.timestamp);
}
export const ORIGINALS = ORIGS.map((o) => o.w);
console.log('originals', ORIGINALS.join(' '));

async function fire(o) {
  const c = COINS[(Math.random() * COINS.length) | 0];
  const held = o.hold[c.mint] || 0;
  const side = held > 0 && Math.random() < 0.55 ? 'sell' : 'buy';
  let sol, tokens;
  if (side === 'buy') { sol = o.style === 'whale' ? 1 + Math.random() * 15 : 0.05 + Math.random() * 2; tokens = sol / c.px; o.hold[c.mint] = held + tokens; state.balances[o.w] = Math.max(0.5, state.balances[o.w] - sol); }
  else { tokens = held * (Math.random() < 0.5 ? 1 : 0.3 + Math.random() * 0.5); sol = tokens * c.px; o.hold[c.mint] = held - tokens; state.balances[o.w] += sol; }
  state.tokenBalances[`${o.w}:${c.mint}`] = o.hold[c.mint];
  const tx = swapTx({ wallet: o.w, side, mint: c.mint, sol, tokens, ts: Math.floor(Date.now() / 1000) });
  await callApi(api.webhook, 'POST', { body: JSON.stringify([tx]), headers: { authorization: env.HELIUS_WEBHOOK_SECRET } });
}
function drift() { for (const c of COINS) { c.px *= Math.exp((Math.random() - 0.48) * 0.08); state.usd[c.mint] = c.px * 200; } }

// ---- http ----
function callApi(fn, method, { body = '', headers = {}, url = '/api', ip = '127.0.0.1' } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url, 'http://x');
    const req = { method, url, headers: { host: 'localhost:' + PORT, 'x-forwarded-for': ip, ...headers }, query: Object.fromEntries(u.searchParams), body: body ? JSON.parse(body) : undefined };
    let status = 200, hdrs = {};
    const res = { set statusCode(v) { status = v; }, get statusCode() { return status; }, setHeader: (k, v) => (hdrs[k] = v), end: (s) => { res.writableEnded = true; resolve({ status, hdrs, body: s }); }, writableEnded: false };
    fn(req, res);
  });
}
const TYPES = { html: 'text/html', js: 'text/javascript', png: 'image/png', jpg: 'image/jpeg', css: 'text/css' };
const LAT = Number(process.env.LAT || 120);
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) {
    const name = u.pathname.slice(5);
    if (!api[name]) { res.writeHead(404); return res.end('{}'); }
    let body = ''; for await (const ch of req) body += ch;
    await new Promise((r) => setTimeout(r, name === 'analyze' || name === 'echo' ? LAT * 6 : LAT));
    const out = await callApi(api[name], req.method, { body, url: req.url, headers: req.headers, ip: req.socket.remoteAddress + (process.env.IPX || '') });
    res.writeHead(out.status, out.hdrs); return res.end(out.body);
  }
  const f = new URL('../public' + (u.pathname === '/' ? '/index.html' : u.pathname), import.meta.url);
  if (!existsSync(f)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'content-type': TYPES[f.pathname.split('.').pop()] || 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(PORT, () => console.log('dev server http://localhost:' + PORT, DB));

if (args.has('--seed')) {
  // grow echoes through the real API, from several "users"
  let ip = 0;
  for (const o of ORIGS) {
    const n = 1 + (o.style === 'degen' || o.style === 'scalp' ? 2 : 0);
    for (let k = 0; k < n; k++) await callApi(api.echo, 'POST', { body: JSON.stringify({ wallet: o.w, name: ['nightowl', 'gm', 'ape', 'chad', 'lilbot', 'jeet', 'moon', 'bagz', 'rugme', 'wen', 'sol', 'cope', 'hodl', 'ser', 'fren', 'giga', 'mog', 'pepe', 'npc', 'based'][(ip * 3 + k) % 20] }), ip: '10.0.0.' + ip++ });
  }
  for (let i = 0; i < 70; i++) { drift(); await fire(ORIGS[(Math.random() * ORIGS.length) | 0]); }
  console.log('seeded');
}
if (args.has('--sim')) {
  setInterval(() => { drift(); if (Math.random() < 0.8) fire(ORIGS[(Math.random() * ORIGS.length) | 0]).catch((e) => console.error(e)); }, Number(process.env.SIM_MS || 2500));
}
