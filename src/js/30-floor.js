/* ================= the floor ================= */
const floor = (() => {
  const cv = $('#floor'), out = cv.getContext('2d');
  const W = 320, H = 172, buf = document.createElement('canvas'); buf.width = W; buf.height = H;
  const L = buf.getContext('2d');
  const TOP = 80, BOT = 162, LEFT = 14, RIGHT = W - 14, DOOR = 26;
  const SPEED = { Scalper: 24, Degen: 28, Sniper: 20, Copycat: 15, Whale: 9, Swing: 7 };
  let scale = 3, dpr = 1, bots = new Map(), order = [], hover = null, spot = null, spotT = 0, t = 0;
  let parts = [], labels = [], visible = true, pnlAll = 0, alive = 0;
  const px = (x, y, w, h, c) => { L.fillStyle = c; L.fillRect(Math.round(x), Math.round(y), w, h); };

  function size() { const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.width * dpr * H / W); scale = cv.width / W; }
  new ResizeObserver(size).observe(cv); size();
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(cv);

  function spawn(c, atDoor) {
    const rn = rnd(c.id);
    const b = {
      id: c.id, c, lk: look(c),
      x: atDoor ? DOOR : LEFT + 10 + rn() * (RIGHT - LEFT - 20), y: atDoor ? TOP + 6 : TOP + 6 + rn() * (BOT - TOP - 6),
      tx: 0, ty: 0, wait: rn() * 3, dir: 1, step: 0, jump: 0, vy: 0, bubble: null, ph: rn() * 10, blink: 0, entering: !!atDoor, trail: [], trailT: 0,
    };
    target(b, atDoor ? { x: DOOR + 40 + R() * 60, y: TOP + 20 + R() * 40 } : null);
    b.wait = atDoor ? 0 : b.wait;
    bots.set(c.id, b);
    return b;
  }
  function target(b, p) { b.tx = p ? p.x : LEFT + 10 + R() * (RIGHT - LEFT - 20); b.ty = p ? p.y : TOP + 6 + R() * (BOT - TOP - 6); }

  // keep at most 72 on the floor: the most recently active + the top of the board
  function sync(echoes) {
    alive = echoes.length;
    const tot = echoes.reduce((a, c) => a + (c.value || 0), 0);
    pnlAll = echoes.length ? ((tot - echoes.length) / echoes.length) * 100 : 0;
    const byAct = [...echoes].sort((a, b) => new Date(b.lastTradeAt || b.created_at) - new Date(a.lastTradeAt || a.created_at));
    const byPnl = [...echoes].sort((a, b) => b.pnlPct - a.pnlPct);
    const keep = new Set([...byPnl.slice(0, 12), ...byAct].slice(0, 72).map((c) => c.id));
    for (const id of [...bots.keys()]) if (!keep.has(id)) bots.delete(id);
    for (const c of echoes) {
      if (!keep.has(c.id)) continue;
      const b = bots.get(c.id);
      if (b) { b.c = c; } else spawn(c, false);
    }
    order = byPnl.map((c) => c.id);
    $('#fCount').textContent = fmt.int(alive);
    const fp = $('#fPnl'); fp.textContent = alive ? fmt.pct(pnlAll) : '—'; fp.className = cls(pnlAll);
    const best = byPnl[0];
    $('#fBest').innerHTML = best ? `${esc(best.name)} <span class="${cls(best.pnlPct)}">${fmt.pct(best.pnlPct)}</span>` : 'nobody yet';
  }

  function event(ev, loud) {
    let b = bots.get(ev.echoId);
    const c = S.byId.get(ev.echoId);
    if (!b && c) b = spawn(c, false);
    if (!b) return;
    const txt = ev.side === 'buy' ? `BUY ${sym(ev.symbol)}` : ev.side === 'sell' ? `SOLD ${sym(ev.symbol)}${ev.pnl != null ? ' ' + fmt.sgn(ev.pnl) : ''}` : `pass ${sym(ev.symbol)}`;
    const col = ev.side === 'buy' ? '#5cf2a8' : ev.side === 'sell' ? ((ev.pnl ?? 0) >= 0 ? '#ffd23f' : '#ff5f7a') : '#7f7bb0';
    const talking = [...bots.values()].filter((x) => x.bubble).length;
    if (talking < 7 || ev.side !== 'skip') b.bubble = talking < 9 ? { text: txt, color: col, t: ev.side === 'skip' ? 2.5 : 4.5 } : b.bubble;
    if (ev.side !== 'skip') {
      b.vy = -3.2; b.wait = 0.8;
      for (let i = 0; i < 10; i++) parts.push({ x: b.x, y: b.y - 22, vx: (R() - 0.5) * 1.6, vy: -R() * 1.8 - 0.4, g: 0.06, l: 40, c: ev.side === 'buy' ? pick(['#5cf2a8', '#34e0ff']) : pick(['#ffd23f', '#ff8a3d']) });
      parts.push({ coin: 1, x: b.x, y: b.y - 26, vx: 0, vy: -0.6, g: 0, l: 50, c: col });
      for (let k = 0; k < 3; k++) parts.push({ ring: 1, x: b.x, y: b.y - 1, r: 3 + k * 5, vr: 0.55, l: 44 - k * 6, c: col });
      if (loud) (ev.side === 'buy' ? sfx.buy : sfx.sell)();
    }
  }

  function spotlight(id) {
    spot = id; spotT = 6;
    const b = bots.get(id); if (b) { b.vy = -3; b.bubble = { text: 'hi!', color: '#34e0ff', t: 3 }; }
  }

  function drawRoom() {
    // wall
    px(0, 0, W, TOP - 6, '#141130');
    for (let y = 10; y < TOP - 6; y += 12) px(0, y, W, 1, '#1a1640');
    px(0, 2, W, 4, '#2a2552');
    for (let i = 0; i < 5; i++) { const x = ((t * 22 + i * 71) % (W + 10)) - 5; px(x, 3, 3, 2, '#34e0ff'); }
    // back tubes
    const tubes = [52, 76, 244, 268];
    tubes.forEach((x, i) => {
      px(x - 1, 18, 16, 3, '#3c3673'); px(x - 1, 58, 16, 4, '#3c3673');
      px(x, 21, 14, 37, '#0d1a2c'); px(x, 30 + Math.sin(t + i) * 1, 14, 28 - Math.sin(t + i) * 1, '#135a73');
      L.globalAlpha = 0.3; px(x + 2, 22, 2, 34, '#e8fbff'); L.globalAlpha = 1;
      if (R() < 0.1) parts.push({ x: x + 2 + R() * 10, y: 56, vx: 0, vy: -0.3, l: 60, c: '#9ff3ff', top: 32 });
    });
    // monitor
    const mx = W / 2 - 58, my = 12, mw = 116, mh = 44;
    px(mx - 3, my - 3, mw + 6, mh + 6, '#2a2552'); px(mx, my, mw, mh, '#07061a');
    px(mx + mw / 2 - 4, my + mh + 3, 8, 8, '#2a2552');
    // mini chart of lab p&l bars (one bar per echo on the floor, sorted)
    const vals = order.slice(0, 40).map((id) => bots.get(id)?.c.pnlPct ?? 0);
    const mx0 = mx + 6, base = my + 32;
    px(mx0, base, mw - 12, 1, '#2f2a5c');
    vals.forEach((v, i) => { const h = clamp(Math.round(v / 6), -10, 10); px(mx0 + i * 2.6, h >= 0 ? base - h : base + 1, 2, Math.abs(h) || 1, v >= 0 ? '#5cf2a8' : '#ff5f7a'); });
    labels.push({ x: W / 2, y: my + 9, text: `${fmt.int(alive)} ALIVE`, size: 7.5, color: '#f1f0ff', font: 'pix', align: 'center' });
    labels.push({ x: W / 2, y: my + 18, text: alive ? `LAB P&L ${fmt.pct(pnlAll)}` : 'LAB EMPTY', size: 5.5, color: pnlAll >= 0 ? '#5cf2a8' : '#ff5f7a', align: 'center' });
    // door
    px(DOOR - 12, TOP - 40, 24, 34, '#2a2552'); px(DOOR - 10, TOP - 38, 20, 32, '#0c0a1f');
    px(DOOR - 10, TOP - 38, 20, 3, ((t * 2) | 0) % 2 ? '#5cf2a8' : '#1f5c4d');
    labels.push({ x: DOOR, y: TOP - 46, text: 'BIRTH', size: 4.8, color: '#5cf2a8', font: 'pix', align: 'center' });
    // floor
    px(0, TOP - 6, W, H - TOP + 6, '#1d1a3c');
    for (let x = 0; x < W; x += 8) { px(x, TOP - 6, 4, 2, '#ffd23f'); }
    for (let y = TOP; y < H; y += 8) for (let x = ((y / 8) % 2) * 8; x < W; x += 16) px(x, y, 8, 8, '#211d44');
    if (document.body.classList.contains('party')) {
      for (let i = 0; i < 6; i++) { L.globalAlpha = 0.12; const cx = W / 2 + Math.sin(t * 2 + i) * 120, cy = 110 + Math.cos(t * 1.7 + i) * 25; L.fillStyle = pick(['#ff5fa2', '#34e0ff', '#ffd23f', '#5cf2a8']); L.beginPath(); L.ellipse(cx, cy, 30, 10, 0, 0, 7); L.fill(); L.globalAlpha = 1; }
    }
  }

  function step(dt) {
    t += dt;
    if (spotT > 0) spotT -= dt; else spot = null;
    const party = document.body.classList.contains('party');
    for (const b of bots.values()) {
      if (b.blink > 0) b.blink -= dt; else if (R() < dt * 0.3) b.blink = 0.14;
      b.vy += 0.25; b.jump = Math.max(0, b.jump - b.vy); if (b.jump === 0) b.vy = 0;
      if (party && b.jump === 0 && R() < 0.04) b.vy = -2;
      if (b.bubble) { b.bubble.t -= dt; if (b.bubble.t <= 0) b.bubble = null; }
      if (b.wait > 0) { b.wait -= dt; continue; }
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
      const sp = (SPEED[b.c.build] || 14) * (b.rush ? 2.4 : 1) * (party ? 1.6 : 1);
      if (d < 1.5) { b.wait = b.rush ? 0.5 : 1 + R() * 4; b.rush = 0; b.entering = false; target(b); continue; }
      b.x += (dx / d) * sp * dt; b.y += (dy / d) * sp * dt; b.dir = dx < 0 ? -1 : 1;
      b.step += dt * sp * 0.4;
      b.trailT -= dt; if (b.trailT <= 0) { b.trailT = 0.09; b.trail.unshift({ x: b.x, y: b.y, step: (b.step | 0) % 2 === 1 }); if (b.trail.length > 3) b.trail.pop(); }
    }
  }

  function render() {
    labels = [];
    drawRoom();
    const list = [...bots.values()].sort((a, b) => a.y - b.y);
    const top3 = order.slice(0, 3);
    for (const b of list) {
      const x = Math.round(b.x - 9), y = Math.round(b.y - 20 - b.jump);
      // shadow
      L.globalAlpha = 0.35; px(b.x - 6, b.y - 1, 12, 2, '#000'); L.globalAlpha = 1;
      if (b.id === spot) { L.globalAlpha = 0.18 + Math.sin(t * 6) * 0.06; L.fillStyle = '#34e0ff'; L.beginPath(); L.ellipse(b.x, b.y, 14, 5, 0, 0, 7); L.fill(); L.globalAlpha = 1; }
      const moving = b.wait <= 0;
      const mood = b.c.pnlPct > 5 ? 1 : b.c.pnlPct < -5 ? -1 : 0;
      const o = { ...b.lk, step: moving && ((b.step | 0) % 2 === 1), blink: b.blink > 0, lx: b.dir, happy: !!(mood > 0 || (b.bubble && b.bubble.color !== '#7f7bb0')), sad: mood < 0 && !b.bubble, dim: ((t * 2 + b.ph) | 0) % 3 === 0 };
      if (b.lk.h === 2) o.scan = Math.round((Math.sin(t * 3 + b.ph) * 0.5 + 0.5) * 13) + 1;
      if (moving && b.trail.length) {
        // the echo: fading copies trail behind every walking robot
        const gh = { h: b.lk.h, c: b.lk.c, k: b.lk.k, bd: b.lk.bd, ghost: '#34e0ff' };
        for (let k = b.trail.length - 1; k >= 1; k--) {
          const tr = b.trail[k];
          L.globalAlpha = k === 1 ? 0.28 : 0.14;
          L.drawImage(sprite(gh, `g|${gh.h}|${gh.bd}`), Math.round(tr.x - 9), Math.round(tr.y - 20 - b.jump));
        }
        L.globalAlpha = 1;
      } else if (!moving) b.trail.length = 0;
      L.drawImage(sprite(o, `${o.h}|${o.c}|${o.k}|${o.bd}|${+o.step}|${+o.blink}|${o.lx}|${+o.happy}|${+o.sad}|${+o.dim}|${o.scan || 0}`), x, y);
      if (top3[0] === b.id && alive > 1) drawCrown(L, x + 7, y - 4);
      const showTag = b === hover || b.id === spot || top3.includes(b.id) || b.bubble;
      if (b.bubble) {
        const bt = b.bubble; labels.push({ x: b.x, y: y - 9, text: bt.text, size: 5.2, color: bt.color, font: 'pix', align: 'center', bg: true });
      } else if (showTag) {
        const rank = top3.indexOf(b.id);
        labels.push({ x: b.x, y: y - 6, text: (rank >= 0 ? '#' + (rank + 1) + ' ' : '') + b.c.name.replace(/\.echo$/, ''), size: 4.6, color: '#f1f0ff', align: 'center', bg: true });
        if (b === hover) labels.push({ x: b.x, y: b.y + 5, text: fmt.pct(b.c.pnlPct), size: 4.6, color: b.c.pnlPct >= 0 ? '#5cf2a8' : '#ff5f7a', align: 'center', font: 'pix' });
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += p.g || 0; p.l--;
      if (p.top && p.y < p.top) p.l = 0;
      if (p.l <= 0) { parts.splice(i, 1); continue; }
      if (p.ring) { p.r += p.vr; L.globalAlpha = Math.min(1, p.l / 30) * 0.8; L.strokeStyle = p.c; L.lineWidth = 1; L.beginPath(); L.ellipse(Math.round(p.x) + 0.5, Math.round(p.y) + 0.5, p.r, p.r * 0.35, 0, 0, 7); L.stroke(); L.globalAlpha = 1; continue; }
      if (p.coin) { px(p.x - 2, p.y - 2, 5, 5, '#0c0a1f'); px(p.x - 1, p.y - 1, 3, 3, p.c); }
      else px(p.x, p.y, 1, 1, p.c);
    }
    if (!alive) {
      labels.push({ x: W / 2, y: 104, text: 'no echoes yet', size: 9, color: '#b9b6e3', font: 'pix', align: 'center' });
      labels.push({ x: W / 2, y: 116, text: 'scan a wallet up top and grow the first one', size: 5, color: '#7f7bb0', align: 'center' });
    }
    out.imageSmoothingEnabled = false;
    out.clearRect(0, 0, cv.width, cv.height);
    out.drawImage(buf, 0, 0, cv.width, cv.height);
    for (const l of labels) {
      const fs = Math.max(10 * dpr, l.size * scale);
      out.font = `${l.font === 'pix' ? 700 : 500} ${fs}px ${l.font === 'pix' ? '"Pixelify Sans"' : '"Geist Mono"'}, monospace`;
      out.textAlign = 'center'; out.textBaseline = 'middle';
      const x = l.x * scale, y = l.y * scale;
      if (l.bg) { const w = out.measureText(l.text).width + fs * 0.8; out.fillStyle = '#07061ae6'; out.fillRect(Math.round(x - w / 2), Math.round(y - fs * 0.65), Math.round(w), Math.round(fs * 1.3)); out.fillStyle = l.color; out.fillRect(Math.round(x - 1.5 * dpr), Math.round(y + fs * 0.65), 3 * dpr, 3 * dpr); }
      else { out.fillStyle = '#07061a'; out.fillText(l.text, x + scale * 0.5, y + scale * 0.5); }
      out.fillStyle = l.color; out.fillText(l.text, x, y);
    }
  }

  function at(e) {
    const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    let best = null, bd = 1e9;
    for (const b of bots.values()) { const dx = x - b.x, dy = y - (b.y - 10 - b.jump); if (Math.abs(dx) < 10 && Math.abs(dy) < 12) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = b; } } }
    return { x, y, b: best };
  }
  cv.addEventListener('pointermove', (e) => { const a = at(e); hover = a.b; cv.style.cursor = hover ? 'pointer' : 'crosshair'; });
  cv.addEventListener('pointerleave', () => (hover = null));
  cv.addEventListener('click', (e) => {
    const a = at(e);
    if (a.b) { sfx.blip(); return profile.open(a.b.id); }
    if (a.y < TOP) return;
    sfx.coin();
    for (let i = 0; i < 16; i++) parts.push({ x: a.x, y: a.y, vx: (R() - 0.5) * 2.4, vy: -R() * 2, g: 0.1, l: 30, c: pick(['#ffd23f', '#34e0ff', '#ff5fa2']) });
    for (const b of bots.values()) if (Math.hypot(b.x - a.x, b.y - a.y) < 90) { b.tx = a.x + (R() - 0.5) * 24; b.ty = clamp(a.y + (R() - 0.5) * 14, TOP + 6, BOT); b.wait = R() * 0.3; b.rush = 1; }
  });

  return {
    sync, event, spotlight,
    tick(dt) { step(dt); if (visible) render(); },
    enter(c) { const b = spawn(c, true); b.bubble = { text: 'hello world', color: '#34e0ff', t: 4 }; spotlight(c.id); },
  };
})();
