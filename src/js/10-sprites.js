/* ================= sprites ================= */
const HEADS = [
  // 0 box (scalper)
  ['.......OKKO.......', '........OO........', '..OOOOOOOOOOOOOO..', '.OBBBBBBBBBBBBBbO.', '.OBOOOOOOOOOOOObO.', 'OOBOSSSSSSSSSSObOO', 'OMBOSSSSSSSSSSObMO', 'OMBOSSSSSSSSSSObMO', 'OOBOSSSSSSSSSSObOO', '.OBOOOOOOOOOOOObO.', '.ObbbbbbbbbbbbbbO.', '..OOOOOOOOOOOOOO..'],
  // 1 dome (whale)
  ['........KK........', '........OO........', '.....OOOOOOOO.....', '...OOBBBBBBBBOO...', '..OBBBBBBBBBBBbO..', '.OBBOOOOOOOOOObbO.', '.OBOSSSSSSSSSSObO.', '.OBOSSSSSSSSSSObO.', '.OBOSSSSSSSSSSObO.', '.OBBOOOOOOOOOObbO.', '..ObbbbbbbbbbbbO..', '...OOOOOOOOOOOO...'],
  // 2 visor (sniper)
  ['..OK..........KO..', '...O..........O...', '..OOOOOOOOOOOOOO..', '.OBBBBBBBBBBBBBbO.', '.OBBBBBBBBBBBBBbO.', 'OOOOOOOOOOOOOOOOOO', 'OSSSSSSSSSSSSSSSSO', 'OOOOOOOOOOOOOOOOOO', 'OMBBBBBBBBBBBBBbMO', '.OBBBBBBBBBBBBBbO.', '.ObbbbbbbbbbbbbbO.', '..OOOOOOOOOOOOOO..'],
  // 3 cyclops (degen)
  ['.......OKKO.......', '........OO........', '....OOOOOOOOOO....', '...OBBBBBBBBBBO...', '...OBOOOOOOOObO...', '..OOBOSSSSSSObOO..', '..OMBOSSSSSSObMO..', '..OMBOSSSSSSObMO..', '..OOBOSSSSSSObOO..', '...OBOOOOOOOObO...', '...ObbbbbbbbbbO...', '....OOOOOOOOOO....'],
  // 4 cat ears (copycat)
  ['..OO..........OO..', '..OKO........OKO..', '..OBBOOOOOOOOBBO..', '.OBBBBBBBBBBBBBbO.', '.OBOOOOOOOOOOOObO.', 'OOBOSSSSSSSSSSObOO', 'OMBOSSSSSSSSSSObMO', 'OMBOSSSSSSSSSSObMO', 'OOBOSSSSSSSSSSObOO', '.OBOOOOOOOOOOOObO.', '.ObbbbbbbbbbbbbbO.', '..OOOOOOOOOOOOOO..'],
  // 5 tv (swing)
  ['...M..........M...', '....M........M....', '.....M......M.....', '.OOOOOOOOOOOOOOOO.', 'OBBBBBBBBBBBBBBBbO', 'OBOOOOOOOOOOOBBBbO', 'OBOSSSSSSSSSOBKBbO', 'OBOSSSSSSSSSOBBBbO', 'OBOSSSSSSSSSOBKBbO', 'OBOOOOOOOOOOOBBBbO', 'ObbbbbbbbbbbbbbbbO', '.OOOOOOOOOOOOOOOO.']];
const BODIES = [
  ['....OMMMMMMMMO....', '..OOBBBBBBBBBBOO..', '.OMOBBOOOOOOBbOMO.', '.OMOBBOKKKKObbOMO.', '.OOOBBOOOOOOBbOOO.', '...OBBBBBBBBBbO...', '...OOOOOOOOOOOO...', '....OMO....OMO....'],
  ['....OMMMMMMMMO....', '..OOBBBBBBBBBBOO..', '.OMOBBBWTTWBBbOMO.', '.OMOBBBBTTBBbbOMO.', '.OOOBBBBTTBBBbOOO.', '...OBBBBBBBBBbO...', '...OOOOOOOOOOOO...', '....OMO....OMO....']];
const HUMAN = ['......OOOOOO......', '....OOHHHHHHOO....', '...OHHHHHHHHHHO...', '..OHHHOOOOOOHHHO..', '..OHHOFFFFFFOHHO..', '..OHOFFFFFFFFOHO..', '..OHOFFFFFFFFOHO..', '..OHOFFFFFFFFOHO..', '..OHHOFFFFFFOHHO..', '...OHHOOOOOOHHO...', '..OOHHHHHHHHHHOO..', '.OHHHHHHHHHHHHHHO.', 'OHHHHHHHHHHHHHHHhO', 'OHHOHHHHHHHHHHOhhO', 'OHHOHHOOOOOOHHOhhO', 'OFFOHHOPPPPOHHOFFO', 'OOOOHHOOOOOOHhOOOO', '...OHHHHHHHHhhO...', '...OOOOOOOOOOOO...', '....OGO....OGO....'];
const WALK = { bot: '...OMO......OMO...', human: '...OGO......OGO...' };
const BODY = [['#8b6cff', '#6446d6'], ['#ff8a3d', '#d4611a'], ['#2ec4b6', '#1b8f85'], ['#ff5fa2', '#d33a7c'], ['#ffd23f', '#d6a912'], ['#34e0ff', '#12a9c9'], ['#ff4d5e', '#c9283a'], ['#5cf2a8', '#27b877'], ['#e8ecf5', '#aab2c8']];
const LIGHT = ['#ff5fa2', '#ffd23f', '#5cf2a8', '#34e0ff', '#ffffff', '#ff8a3d'];
const HOODIES = [['#3a4170', '#2b3156'], ['#6b2d5c', '#4f1f44'], ['#1f5c4d', '#164538'], ['#5c4a1f', '#453716'], ['#23405c', '#193047'], ['#5c1f2d', '#451621']];

const BUILDS = {
  Scalper: { h: 0, c: 5, col: '#34e0ff', line: 'In and out in minutes. Lives on the 1m chart.', pick: 'holds ≤ 10 min, 5+ trades a day', size: '1.5× his conviction', range: '4–30% a trade', rule: 'dumps it all when he sells half' },
  Whale: { h: 1, c: 0, col: '#8b6cff', line: 'Sizes big, trades rarely, moves charts when it does.', pick: 'median buy ≥ 3 SOL', size: '1.5× his conviction', range: '5–50% a trade', rule: 'only copies entries of 1 SOL+' },
  Sniper: { h: 2, c: 6, col: '#ff4d5e', line: 'Gets in first, gets out fast. Visor never blinks.', pick: 'holds ≤ 1h, wins 50%+', size: '2× his conviction', range: '5–40% a trade', rule: 'first entry only, never adds' },
  Degen: { h: 3, c: 3, col: '#ff5fa2', line: 'One eye, all in. Buys whatever is moving.', pick: '15+ trades a day, wins < 45%', size: '3× his conviction', range: '6–50% a trade', rule: 'up to half the bag on one coin' },
  Copycat: { h: 4, c: 4, col: '#ffd23f', line: 'Pure mirror. Whatever he does, it does.', pick: 'everyone else', size: '1× his conviction', range: '3–35% a trade', rule: 'mirrors every buy and sell' },
  Swing: { h: 5, c: 7, col: '#5cf2a8', line: 'Holds for hours or days. Changes the channel, not the coin.', pick: 'holds a day or more', size: '1× his conviction', range: '4–40% a trade', rule: 'holds 30 min min, early sells trim half' },
};
const BUILD_NAMES = Object.keys(BUILDS);
const bcol = (b) => (BUILDS[b] || BUILDS.Copycat).col;

function drawBot(ctx, x, y, o = {}) {
  const mask = o.mask, human = !!o.human;
  const map = human ? HUMAN : HEADS[o.h || 0].concat(BODIES[o.bd || 0]);
  const [b1, b2] = BODY[o.c || 0];
  const k = o.dim ? '#3a3150' : o.k || LIGHT[0];
  const hd = HOODIES[o.hood || 0];
  const pal = o.ghost
    ? { O: o.ghost, B: o.ghost + '88', b: o.ghost + '66', S: '#0c0a1f', M: o.ghost + 'aa', K: o.ghost, W: o.ghost, T: o.ghost, H: o.ghost + '88', h: o.ghost + '66', F: o.ghost + 'aa', P: o.ghost, G: o.ghost }
    : human ? { O: '#0f1222', H: hd[0], h: hd[1], F: o.skin || '#f1c49c', P: '#34e0ff', G: '#ff5fa2' }
    : { O: '#0f1222', B: b1, b: b2, S: '#151a33', M: '#8a93c8', K: k, W: '#ffffff', T: k };
  for (let r = 0; r < map.length; r++) {
    const row = r === 19 && o.step ? WALK[human ? 'human' : 'bot'] : map[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]; if (ch === '.') continue; if (mask && !mask(c, r)) continue;
      ctx.fillStyle = pal[ch] || '#0f1222'; ctx.fillRect(x + c, y + r, 1, 1);
    }
  }
  if (o.ghost) return;
  const lx = clamp(o.lx || 0, -1, 1), ly = o.ly || 0;
  if (mask && !mask(8, 6)) return;
  if (human) {
    ctx.fillStyle = '#0f1222';
    if (o.blink) { ctx.fillRect(x + 6 + lx, y + 6, 2, 1); ctx.fillRect(x + 10 + lx, y + 6, 2, 1); }
    else { ctx.fillRect(x + 7 + lx, y + 6 + ly, 1, 1); ctx.fillRect(x + 10 + lx, y + 6 + ly, 1, 1); }
    ctx.fillStyle = '#c98f6a'; ctx.fillRect(x + 8, y + 8, 2, 1); return;
  }
  const E = o.eye || '#ffffff', h = o.h || 0; ctx.fillStyle = E;
  if (h === 2) {
    const t = o.t || 0, pos = o.scan ?? Math.round((Math.sin(t * 3 + (o.ph || 0)) * 0.5 + 0.5) * 13) + 1;
    ctx.fillStyle = '#3a1020'; ctx.fillRect(x + 1, y + 6, 16, 1);
    ctx.fillStyle = o.dim ? '#ff5f6d' : '#ff3b5c'; ctx.fillRect(x + pos, y + 6, 3, 1); ctx.fillStyle = '#ffd0d8'; ctx.fillRect(x + pos + 1, y + 6, 1, 1); return;
  }
  if (h === 3) {
    if (o.blink) { ctx.fillRect(x + 7, y + 7, 4, 1); return; }
    ctx.fillRect(x + 7, y + 5, 4, 4); ctx.fillStyle = '#0f1222'; ctx.fillRect(x + 8 + (lx > 0 ? 1 : 0), y + 6 + (ly < 0 ? -1 : 0), 2, 2);
    if (o.happy) { ctx.fillStyle = '#151a33'; ctx.fillRect(x + 7, y + 8, 4, 1); } return;
  }
  const dx = h === 5 ? -1 : 0;
  if (o.blink) { ctx.fillRect(x + 6 + lx + dx, y + 7, 2, 1); ctx.fillRect(x + 10 + lx + dx, y + 7, 2, 1); }
  else if (o.happy) { ctx.fillRect(x + 6 + lx + dx, y + 6, 2, 1); ctx.fillRect(x + 5 + lx + dx, y + 7, 1, 1); ctx.fillRect(x + 8 + lx + dx, y + 7, 1, 1); ctx.fillRect(x + 10 + lx + dx, y + 6, 2, 1); ctx.fillRect(x + 9 + lx + dx, y + 7, 1, 1); ctx.fillRect(x + 12 + lx + dx, y + 7, 1, 1); }
  else if (o.sad) { ctx.fillRect(x + 6 + lx + dx, y + 7, 2, 1); ctx.fillRect(x + 7 + lx + dx, y + 6, 1, 1); ctx.fillRect(x + 10 + lx + dx, y + 7, 2, 1); ctx.fillRect(x + 10 + lx + dx, y + 6, 1, 1); }
  else { ctx.fillRect(x + 6 + lx + dx, y + 6 + ly, 2, 2); ctx.fillRect(x + 10 + lx + dx, y + 6 + ly, 2, 2); }
  if (h === 4 && !o.blink) { ctx.fillStyle = '#ff9fc6'; ctx.fillRect(x + 8 + dx, y + 8, 2, 1); }
}
function drawCrown(ctx, x, y) {
  const m = ['Y.Y.Y', 'YYYYY', 'YRYRY'];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { const ch = m[r][c]; if (ch === '.') continue; ctx.fillStyle = ch === 'Y' ? '#ffd23f' : '#ff4d5e'; ctx.fillRect(x + c, y + r, 1, 1); }
}

// Visual identity of an echo: head from its build, colors from its id.
function look(c) {
  const b = BUILDS[c.build] || BUILDS.Copycat, h = hash(c.id || c.name || 'x');
  return { h: b.h, c: 1 + (h % 8), k: LIGHT[(h >>> 4) % 6], bd: (h >>> 12) % 2 };
}
function humanLook(wallet) { const h = hash(wallet || 'anon'); return { human: true, hood: h % HOODIES.length, skin: ['#f1c49c', '#e0ac7e', '#c68b59', '#8d5a3b', '#f7d7b5'][(h >>> 5) % 5] }; }

/* ---------- living avatars (feed, board, cards) ---------- */
const avatars = new Set();
function avatar(o, cls) {
  const c = document.createElement('canvas'); c.width = 18; c.height = 22; c.className = 'px' + (cls ? ' ' + cls : '');
  const a = { cv: c, ctx: c.getContext('2d'), o, ph: R() * 10, blink: 0, lx: 0, ly: 0, nextLook: R() * 3, bounce: 0, happy: 0 };
  c._a = a; avatars.add(a); drawAvatar(a, 0); return c;
}
function drawAvatar(a, T) {
  const bob = RM ? 0 : ((T * 1.6 + a.ph) | 0) % 2;
  const dance = document.body.classList.contains('party') ? Math.round(Math.sin(T * 12 + a.ph) * 1) : 0;
  const y = a.bounce > 0 ? 0 : 1 + bob;
  a.ctx.clearRect(0, 0, 18, 22);
  a.ctx.save(); if (dance) a.ctx.translate(dance, 0);
  drawBot(a.ctx, 0, y, { ...a.o, t: T, ph: a.ph, blink: a.blink > 0, lx: a.lx, ly: a.ly, happy: a.happy > 0 || (a.o.mood > 0), sad: a.o.mood < 0 && !(a.happy > 0), dim: !a.o.human && ((T * 2 + a.ph) | 0) % 3 === 0 });
  a.ctx.restore();
}
function tickAvatars(T, dt) {
  for (const a of avatars) {
    if (!a.cv.isConnected) { if (a.gone) avatars.delete(a); else a.gone = 1; continue; }
    a.gone = 0;
    if (a.blink > 0) a.blink -= dt; else if (R() < dt * 0.35) a.blink = 0.14;
    if (a.bounce > 0) a.bounce -= dt; if (a.happy > 0) a.happy -= dt;
    a.nextLook -= dt; if (a.nextLook < 0) { a.lx = pick([-1, 0, 0, 1]); a.ly = R() < 0.2 ? -1 : 0; a.nextLook = 1.2 + R() * 2.5; }
    drawAvatar(a, T);
  }
}
function poke(cv) { if (cv && cv._a) { cv._a.bounce = 0.28; cv._a.happy = 1.2; } }
const botAvatar = (echo, cls) => avatar({ ...look(echo), mood: echo.pnlPct > 5 ? 1 : echo.pnlPct < -5 ? -1 : 0 }, cls);

// logo bots
$$('.js-logo').forEach((c) => { const a = { cv: c, ctx: c.getContext('2d'), o: { c: 7, k: '#ff5fa2', h: 0, bd: 0 }, ph: R() * 5, blink: 0, lx: 0, ly: 0, nextLook: 2, bounce: 0, happy: 0 }; c._a = a; avatars.add(a); });

// cached sprite images for canvases that draw many bots
const sprCache = new Map();
function sprite(o, key) {
  if (sprCache.has(key)) return sprCache.get(key);
  const c = document.createElement('canvas'); c.width = 18; c.height = 20; drawBot(c.getContext('2d'), 0, 0, o);
  if (sprCache.size > 900) sprCache.clear();
  sprCache.set(key, c); return c;
}
