/* ================= the lab (hero canvas) ================= */
const lab = (() => {
  const cv = $('#labcv'), out = cv.getContext('2d');
  const buf = document.createElement('canvas'), L = buf.getContext('2d');
  let W = 240, H = 176, scale = 3, dpr = 1, lay = {};
  const st = {
    mode: 'idle', wallet: '', report: null, echo: null, t: 0,
    scan: 0, scanTarget: 0, liquid: 1, reveal: 1, flash: 0, open: 0, shake: 0,
    show: [], showI: 0, showT: 0, swap: 0, occupant: null, holdUntil: 0,
    parts: [], zaps: [], mouse: { x: -99, y: -99, in: false }, hopY: 0, monitor: 'STANDBY',
  };

  function layout() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    const cw = Math.max(200, r.width), ch = Math.max(160, r.height);
    H = 176; W = Math.round(H * cw / ch);
    if (W < 224) { W = 224; H = Math.round(W * ch / cw); }
    if (W > 400) { W = 400; H = Math.max(150, Math.round(W * ch / cw)); }
    buf.width = W; buf.height = H;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    scale = cv.width / W;
    const floorY = H - 30;
    const sx = Math.round(clamp(W * 0.17, 38, 70));
    const tw = 56, bx = Math.round(W - 22 - tw / 2);
    const hx = Math.round((sx + 26 + bx - tw / 2) / 2);
    lay = { floorY, sx, bx, tw, tubeTop: floorY - 76, hx, helixTop: 40, helixBot: floorY - 8 };
  }
  new ResizeObserver(layout).observe(cv);
  layout();

  const px = (x, y, w, h, c) => { L.fillStyle = c; L.fillRect(Math.round(x), Math.round(y), w, h); };
  const labels = [];
  const label = (x, y, text, o = {}) => labels.push({ x, y, text, ...o });

  // 2x sprite blit
  const tmp = document.createElement('canvas'); tmp.width = 18; tmp.height = 20; const T2 = tmp.getContext('2d');
  function big(o, x, y, k = 2) { T2.clearRect(0, 0, 18, 20); drawBot(T2, 0, 0, o); L.imageSmoothingEnabled = false; L.drawImage(tmp, Math.round(x), Math.round(y), 18 * k, 20 * k); }

  /* ---------- scene ---------- */
  function wall(t) {
    const { floorY } = lay;
    px(0, 0, W, floorY, '#141130');
    for (let y = 14; y < floorY; y += 16) px(0, y, W, 1, '#1a1640');
    for (let x = (t * 0) % 24; x < W; x += 24) px(x, 14, 1, floorY - 14, '#18143a');
    // ceiling pipes
    px(0, 4, W, 6, '#2a2552'); px(0, 5, W, 1, '#3c3673'); px(0, 9, W, 1, '#1c1840');
    for (let i = 0; i < 6; i++) { const x = ((t * 26 + i * 53) % (W + 20)) - 10; px(x, 6, 4, 2, '#34e0ff'); }
    for (let x = 18; x < W; x += 46) { px(x, 3, 5, 8, '#3c3673'); px(x + 1, 4, 3, 1, '#57538a'); }
    // wall lights
    for (let i = 0; i < Math.floor(W / 40); i++) {
      const x = 10 + i * 40, on = ((t * 2 + i * 1.7) | 0) % 5;
      px(x, 22, 5, 3, '#0c0a1f'); px(x + 1, 23, 1, 1, on ? '#5cf2a8' : '#1f5c4d'); px(x + 3, 23, 1, 1, on === 2 ? '#ff5fa2' : '#5c1f3d');
    }
    // hazard strip + floor
    for (let x = 0; x < W; x += 8) { px(x, floorY - 3, 4, 3, '#ffd23f'); px(x + 4, floorY - 3, 4, 3, '#1b1838'); }
    px(0, floorY, W, H - floorY, '#1d1a3c');
    for (let y = floorY + 4, i = 0; y < H; y += 5 + i, i++) px(0, y, W, 1, '#252150');
    const vp = W / 2;
    for (let i = -8; i <= 8; i++) { const x0 = vp + i * 22; for (let y = floorY; y < H; y += 2) { const k = (y - floorY) / (H - floorY); px(x0 + i * 22 * k * 1.4, y, 1, 1, '#2a2658'); } }
  }

  function sign(t) {
    const { sx, floorY } = lay, cy = Math.round(Math.max(30, (14 + floorY - 64) / 2)), w = 50, h = 16, x = sx - w / 2, y = cy - h / 2;
    const on = !(((t * 7) | 0) % 37 === 0 || ((t * 7) | 0) % 53 === 0);
    px(x - 1, y - 1, w + 2, h + 2, '#0c0a1f'); px(x, y, w, 1, on ? '#ff5fa2' : '#5c1f3d'); px(x, y + h - 1, w, 1, on ? '#ff5fa2' : '#5c1f3d'); px(x, y, 1, h, on ? '#ff5fa2' : '#5c1f3d'); px(x + w - 1, y, 1, h, on ? '#ff5fa2' : '#5c1f3d');
    px(sx - 1, y - 6, 1, 5, '#3c3673'); px(x + 6, y - 6, 1, 5, '#3c3673'); px(x + w - 7, y - 6, 1, 5, '#3c3673');
    if (on) label(sx, cy, 'ECHO CHAMBER', { size: 6.2, color: '#ffd0e4', font: 'pix', align: 'center', glow: '#ff5fa2', max: w - 6 });
  }
  const drone = { x: 0, y: 30, vx: 0, vy: 0 };
  const DRONE = ['P.P.P...P.P.P', '....OOOOO....', '...OCCCCCO...', '..OCWCCCWCO..', '...OCCCCCO...', '....OOKOO....'];
  function drawDrone(t) {
    const { sx, bx, hx, floorY, tubeTop } = lay;
    let tx, ty;
    if (st.mode === 'scanning') { tx = sx + Math.sin(t * 3) * 10; ty = floorY - 78; }
    else if (st.mode === 'growing' || st.mode === 'born') { tx = bx + Math.sin(t * 2.5) * 16; ty = tubeTop - 28; }
    else { tx = hx + Math.sin(t * 0.37) * (W * 0.38); ty = 34 + Math.sin(t * 0.83) * 10 + (Math.cos(t * 0.21) + 1) * 12; }
    drone.vx += (tx - drone.x) * 0.02; drone.vy += (ty - drone.y) * 0.02; drone.vx *= 0.86; drone.vy *= 0.86;
    drone.x += drone.vx; drone.y += drone.vy;
    const x0 = Math.round(drone.x - 6), y0 = Math.round(drone.y - 3 + Math.sin(t * 6));
    const blink = ((t * 2) | 0) % 3 === 0;
    for (let r = 0; r < DRONE.length; r++) for (let c = 0; c < 13; c++) {
      const ch = DRONE[r][c]; if (ch === '.') continue;
      if (ch === 'P') { if (((t * 30) | 0) % 2 === (c < 6 ? 0 : 1)) px(x0 + c, y0 + r, 1, 1, '#8a93c8'); continue; }
      px(x0 + c, y0 + r, 1, 1, { O: '#0f1222', C: '#57538a', W: st.mode === 'scanning' ? '#ff5fa2' : '#34e0ff', K: blink ? '#ffd23f' : '#5c4a1f' }[ch]);
    }
    if (st.mode === 'scanning' && R() < 0.5) { L.globalAlpha = 0.25; px(x0 + 5, y0 + 6, 3, 30, '#ff5fa2'); L.globalAlpha = 1; }
  }

  function monitor(t) {
    const { hx } = lay, x = hx - 30, y = 14, w = 60, h = 20;
    px(x - 2, y - 2, w + 4, h + 4, '#2a2552'); px(x, y, w, h, '#07061a');
    for (let i = 0; i < 6; i++) { const v = Math.sin(t * 2 + i) * 3; px(x + 4 + i * 9, y + 13 + v, 6, 1, '#1f5c4d'); }
    px(x + w / 2 - 3, y + h + 2, 6, 6, '#2a2552');
    const flash = st.mode === 'idle' && st.mflash && st.mflash.t > 0 ? st.mflash : null;
    if (flash) { label(hx, y + 7, flash.text, { size: 6, max: w - 8, color: flash.color, font: 'pix', align: 'center' }); return; }
    label(hx, y + 7, st.monitor, { size: 6.5, max: w - 8, color: st.mode === 'error' ? '#ff5f7a' : st.mode === 'idle' ? '#7f7bb0' : '#5cf2a8', font: 'pix', align: 'center', blink: st.mode === 'scanning' || st.mode === 'growing' });
  }

  function scanner(t) {
    const { sx, floorY } = lay, hx0 = sx - 18, hy = floorY - 44 + (st.mode === 'idle' ? 0 : 0);
    // arch
    const top = floorY - 64;
    px(sx - 27, top, 4, floorY - top, '#3c3673'); px(sx + 23, top, 4, floorY - top, '#3c3673');
    px(sx - 27, top, 54, 6, '#3c3673'); px(sx - 25, top + 1, 50, 1, '#57538a');
    px(sx - 3, top + 6, 6, 3, '#57538a');
    const busy = st.mode === 'scanning';
    for (let i = 0; i < 5; i++) px(sx - 23 + i * 11, top + 2, 3, 2, busy ? (((t * 10 + i) | 0) % 2 ? '#ff5fa2' : '#34e0ff') : i === ((t * 2) | 0) % 5 ? '#34e0ff' : '#1f3f5c');
    // pad
    px(sx - 24, floorY - 4, 48, 5, '#2a2552'); px(sx - 22, floorY - 4, 44, 1, busy || st.mode !== 'idle' ? '#34e0ff' : '#3c3673');
    L.globalAlpha = 0.18 + Math.sin(t * 3) * 0.06; px(sx - 20, floorY - 10, 40, 6, '#34e0ff'); L.globalAlpha = 1;
    // the original
    const scanned = st.mode !== 'idle' && st.mode !== 'error';
    const hl = scanned ? humanLook(st.wallet) : null;
    const bob = RM ? 0 : ((t * 1.3) | 0) % 2;
    const lx = st.mouse.in ? clamp(Math.round((st.mouse.x - sx) / 30), -1, 1) : 0;
    const o = { human: true, blink: ((t * 0.7) % 3.2) < 0.12, lx };
    T2.clearRect(0, 0, 18, 20);
    if (!scanned) drawBot(T2, 0, 0, { ...o, ghost: '#3c3673' });
    else if (st.mode === 'scanning') {
      const line = Math.floor(st.scan * 22);
      drawBot(T2, 0, 0, { ...o, ghost: '#3c3673' });
      drawBot(T2, 0, 0, { ...o, ...hl, mask: (c, r) => r < line });
    } else drawBot(T2, 0, 0, { ...o, ...hl });
    L.imageSmoothingEnabled = false; L.drawImage(tmp, hx0, hy + bob, 36, 40);
    if (!scanned) label(sx, hy - 8 + bob, '?', { size: 13, color: '#8b6cff', font: 'pix', align: 'center', bob: true });
    if (st.mode === 'scanning') {
      const ly = hy + st.scan * 40;
      L.globalAlpha = 0.35; px(sx - 23, ly - 2, 46, 5, '#ff5fa2'); L.globalAlpha = 1;
      px(sx - 23, ly, 46, 1, '#ffd0e4');
      if (R() < 0.6) st.parts.push({ x: sx - 20 + R() * 40, y: ly, vx: (R() - 0.5) * 0.8, vy: -R() * 0.8, l: 20, c: pick(['#ff5fa2', '#34e0ff', '#ffffff']) });
    }
    label(sx, floorY + 9, scanned ? short(st.wallet) : 'the original', { size: 6, color: scanned ? '#f1f0ff' : '#57538a', align: 'center' });
  }

  function helix(t) {
    const { hx, helixTop, helixBot, sx, bx, floorY, tw } = lay;
    // pipes
    px(sx + 27, floorY - 12, hx - sx - 27, 4, '#2a2552'); px(hx, floorY - 12, bx - tw / 2 - hx, 4, '#2a2552');
    const flowing = st.mode === 'scanning' || st.mode === 'growing' || st.mode === 'scanned';
    if (flowing) for (let i = 0; i < 8; i++) { const x = sx + 27 + ((t * 60 + i * 23) % (bx - tw / 2 - sx - 27)); px(x, floorY - 11, 3, 2, st.mode === 'growing' ? '#5cf2a8' : '#34e0ff'); }
    // column
    px(hx - 16, helixTop - 6, 32, 4, '#3c3673'); px(hx - 16, helixBot + 2, 32, 4, '#3c3673');
    L.globalAlpha = 0.12; px(hx - 14, helixTop - 2, 28, helixBot - helixTop + 4, '#8b6cff'); L.globalAlpha = 1;
    const dna = st.report?.dna || [];
    const speed = st.mode === 'scanning' ? 7 : st.mode === 'growing' ? 5 : 1.6;
    const amp = 11;
    const scroll = Math.floor(t * (st.mode === 'scanned' ? 3 : 0));
    for (let y = helixTop, i = 0; y <= helixBot; y += 3, i++) {
      const ph = y * 0.11 + t * speed, s = Math.sin(ph), cz = Math.cos(ph);
      const x1 = hx + s * amp, x2 = hx - s * amp;
      let col = '#8b6cff';
      if (dna.length && st.mode !== 'scanning') { const d = dna[(i + scroll) % dna.length]; col = d.s === 'b' ? '#5cf2a8' : '#ff5fa2'; }
      else if (st.mode === 'scanning') col = pick(['#5cf2a8', '#ff5fa2', '#8b6cff', '#34e0ff']);
      if (i % 2 === 0) { L.globalAlpha = 0.55; px(Math.min(x1, x2), y, Math.abs(x2 - x1), 1, col); L.globalAlpha = 1; }
      px(x1 - 1, y - 1, 3, 3, cz > 0 ? '#34e0ff' : '#1f6f88');
      px(x2 - 1, y - 1, 3, 3, cz > 0 ? '#12708a' : '#ff5fa2');
    }
  }

  function tube(t) {
    const { bx, tw, tubeTop, floorY } = lay;
    const x = bx - tw / 2, bot = floorY - 6, h = bot - tubeTop;
    // base + cap
    px(x - 4, bot, tw + 8, 8, '#3c3673'); px(x - 2, bot + 2, tw + 4, 1, '#57538a');
    for (let i = 0; i < 3; i++) px(x + 6 + i * 20, bot + 4, 3, 2, '#0c0a1f');
    const capY = tubeTop - 10 - st.open * 40;
    px(x - 4, capY, tw + 8, 10, '#3c3673'); px(x - 2, capY + 2, tw + 4, 1, '#57538a');
    for (let i = 0; i < 3; i++) px(x + 6 + i * 20, capY + 4, 3, 2, '#0c0a1f');
    // liquid
    const lh = Math.round(h * st.liquid), ly = bot - lh;
    px(x, tubeTop, tw, h, '#0d1a2c');
    if (lh > 0) {
      px(x, ly, tw, lh, st.mode === 'growing' ? '#1a6f6a' : '#135a73');
      L.globalAlpha = 0.5; for (let i = 0; i < tw; i += 2) px(x + i, ly + Math.round(Math.sin(t * 4 + i * 0.5)), 2, 1, '#6cebff'); L.globalAlpha = 1;
      if (R() < 0.35) st.parts.push({ x: x + 3 + R() * (tw - 6), y: bot - 2, vx: 0, vy: -0.3 - R() * 0.5, l: 60, c: '#9ff3ff', bub: 1, top: ly });
    }
    // occupant
    const occ = st.occupant;
    if (occ) {
      const bob = Math.round(Math.sin(t * 2) * 2);
      const ox = bx - 18, oy = bot - 44 + bob - st.hopY;
      const o = { ...occ.look, t, ph: 1, blink: ((t * 0.8) % 2.8) < 0.12, happy: st.mode === 'born', lx: st.mouse.in ? clamp(Math.round((st.mouse.x - bx) / 30), -1, 1) : 0 };
      if (occ.ghost) {
        if (((t * 8) | 0) % 7) { L.globalAlpha = 0.55 + Math.sin(t * 20) * 0.15; big({ ...o, ghost: '#34e0ff' }, ox, oy); L.globalAlpha = 1; }
      } else if (st.mode === 'growing') {
        const line = 20 - Math.floor(st.reveal * 21);
        T2.clearRect(0, 0, 18, 20);
        drawBot(T2, 0, 0, { ...o, ghost: '#5cf2a8' });
        drawBot(T2, 0, 0, { ...o, mask: (c, r) => r >= line });
        L.imageSmoothingEnabled = false; L.drawImage(tmp, ox, oy, 36, 40);
        px(bx - tw / 2 + 2, oy + line * 2, tw - 4, 1, '#ffffff');
      } else {
        const sw = st.swap;
        if (sw > 0) { big({ ...o, mask: (c, r) => ((r + ((t * 30) | 0)) % 3) !== 0 || sw < 0.3 }, ox, oy); }
        else big(o, ox, oy);
      }
      if (occ.label) label(bx, bot + 17, occ.label, { size: 6.5, color: '#f1f0ff', align: 'center', font: 'pix' });
      if (occ.sub) label(bx, bot + 25, occ.sub, { size: 5.2, color: occ.subColor || '#7f7bb0', align: 'center' });
      if (occ.tag) label(bx, tubeTop - 18 - st.open * 40, occ.tag, { size: 5.2, color: occ.tagColor || '#5cf2a8', align: 'center', font: 'pix' });
    } else {
      label(bx, tubeTop + h / 2, '?', { size: 18, color: '#2f5c73', align: 'center', font: 'pix' });
      label(bx, bot + 17, 'your echo', { size: 6.5, color: '#57538a', align: 'center', font: 'pix' });
    }
    // glass
    L.globalAlpha = 0.22; px(x, tubeTop, tw, h, '#8fe9ff'); L.globalAlpha = 0.5; px(x + 4, tubeTop + 4, 3, h - 8, '#e8fbff'); px(x + tw - 7, tubeTop + 6, 1, h - 12, '#e8fbff'); L.globalAlpha = 1;
    px(x - 1, tubeTop, 1, h, '#6cebff'); px(x + tw, tubeTop, 1, h, '#6cebff');
    // electrodes + zaps
    px(x - 8, tubeTop + 6, 4, 10, '#57538a'); px(x + tw + 4, tubeTop + 6, 4, 10, '#57538a');
    if (st.mode === 'growing' && R() < 0.45) { st.zaps.push({ l: 4, pts: zap(x - 4, tubeTop + 10, bx + (R() - 0.5) * 20, tubeTop + 20 + R() * 40) }); sfx.zap(); }
    if (st.mode === 'growing' && R() < 0.45) st.zaps.push({ l: 4, pts: zap(x + tw + 4, tubeTop + 10, bx + (R() - 0.5) * 20, tubeTop + 20 + R() * 40) });
  }
  function zap(x1, y1, x2, y2) { const pts = []; const n = 7; for (let i = 0; i <= n; i++) pts.push([x1 + (x2 - x1) * i / n + (i && i < n ? (R() - 0.5) * 8 : 0), y1 + (y2 - y1) * i / n + (i && i < n ? (R() - 0.5) * 6 : 0)]); return pts; }

  function rings(x, y, col, n = 3, flat = 1) { for (let k = 0; k < n; k++) st.parts.push({ ring: 1, x, y, r: 4 + k * 7, vr: 0.7, l: 50 - k * 8, c: col, flat }); }
  function particles() {
    for (let i = st.parts.length - 1; i >= 0; i--) {
      const p = st.parts[i];
      if (p.ring) { p.r += p.vr; p.l--; if (p.l <= 0) { st.parts.splice(i, 1); continue; } L.globalAlpha = Math.min(1, p.l / 25) * 0.9; L.strokeStyle = p.c; L.lineWidth = 1; L.beginPath(); L.ellipse(Math.round(p.x) + 0.5, Math.round(p.y) + 0.5, p.r, p.r * (p.flat || 1), 0, 0, 7); L.stroke(); L.globalAlpha = 1; continue; }
      p.x += p.vx; p.y += p.vy; p.l--;
      if (p.bub && p.y < p.top + 2) p.l = 0;
      if (p.g) p.vy += p.g;
      if (p.l <= 0) { st.parts.splice(i, 1); continue; }
      px(p.x, p.y, p.s || 1, p.s || 1, p.c);
    }
    for (let i = st.zaps.length - 1; i >= 0; i--) {
      const z = st.zaps[i]; z.l--; if (z.l <= 0) { st.zaps.splice(i, 1); continue; }
      L.strokeStyle = pick(['#ffffff', '#fff27a', '#9ff3ff']); L.lineWidth = 1; L.beginPath();
      z.pts.forEach(([x, y], j) => (j ? L.lineTo(Math.round(x) + 0.5, Math.round(y) + 0.5) : L.moveTo(Math.round(x) + 0.5, Math.round(y) + 0.5))); L.stroke();
    }
  }

  function render(t) {
    labels.length = 0;
    L.save();
    if (st.shake > 0) { L.translate(Math.round((R() - 0.5) * 3), Math.round((R() - 0.5) * 3)); st.shake -= 1 / 60; }
    wall(t); sign(t); monitor(t); helix(t); scanner(t); tube(t); drawDrone(t); particles();
    if (st.flash > 0) { L.globalAlpha = Math.min(1, st.flash); px(0, 0, W, H, '#ffffff'); L.globalAlpha = 1; st.flash -= 0.04; }
    L.restore();
    out.imageSmoothingEnabled = false;
    out.clearRect(0, 0, cv.width, cv.height);
    out.drawImage(buf, 0, 0, cv.width, cv.height);
    for (const l of labels) {
      if (l.blink && ((t * 2.5) | 0) % 2) continue;
      let fs = l.size * scale * 0.95;
      const face = (f) => `${l.font === 'pix' ? 700 : 500} ${f}px ${l.font === 'pix' ? '"Pixelify Sans"' : '"Geist Mono"'}, monospace`;
      out.font = face(fs);
      if (l.max) { const w = out.measureText(l.text).width, mw = l.max * scale; if (w > mw) { fs *= mw / w; out.font = face(fs); } }
      out.textAlign = l.align || 'left'; out.textBaseline = 'middle';
      if (l.glow) { out.save(); out.shadowColor = l.glow; out.shadowBlur = scale * 4; out.fillStyle = l.color; out.fillText(l.text, l.x * scale, l.y * scale); out.fillText(l.text, l.x * scale, l.y * scale); out.restore(); continue; }
      out.fillStyle = '#07061a'; out.fillText(l.text, l.x * scale + scale * 0.6, l.y * scale + scale * 0.6);
      out.fillStyle = l.color || '#fff'; out.fillText(l.text, l.x * scale, l.y * scale);
    }
  }

  /* ---------- behaviour ---------- */
  function update(dt) {
    st.t += dt;
    if (st.mode === 'scanning') { st.scan = Math.min(st.scanTarget, st.scan + dt * 0.45); if (R() < 0.3) sfx.scan(); st.liquid = Math.max(0.15, st.liquid - dt * 0.8); }
    if (st.mode === 'scanned') st.liquid = Math.min(0.35, st.liquid + dt);
    if (st.mode === 'growing') { st.liquid = Math.min(1, st.liquid + dt * 0.9); if (st.liquid > 0.6) st.reveal = Math.min(st.revealCap, st.reveal + dt * 0.55); st.monitor = `GROWING ${Math.round(st.reveal * 100)}%`; }
    if (st.mode === 'born') { st.open = Math.max(0, st.open - dt * 0.4); st.hopY = Math.max(0, st.hopY - dt * 30); }
    if (st.swap > 0) st.swap -= dt * 1.6;
    if (st.mflash) st.mflash.t -= dt;
    if (st.mode === 'idle' && st.show.length && performance.now() > st.holdUntil) {
      st.showT -= dt;
      if (st.showT <= 0) { st.showI = (st.showI + 1) % st.show.length; setOccupant(st.show[st.showI]); st.showT = 5; st.swap = 1; }
    }
  }
  function setOccupant(c) {
    if (!c) { st.occupant = null; return; }
    st.occupant = { id: c.id, look: look(c), label: c.name, sub: `${fmt.pct(c.pnlPct)} · ${c.trades} trades`, subColor: c.pnlPct > 0 ? '#5cf2a8' : c.pnlPct < 0 ? '#ff5f7a' : '#7f7bb0', tag: 'NEWEST ECHOES', tagColor: '#7f7bb0' };
  }

  // pointer
  function toBuf(e) { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; }
  cv.addEventListener('pointermove', (e) => { Object.assign(st.mouse, toBuf(e), { in: true }); const { bx, tw } = lay; const p = st.mouse; cv.style.cursor = st.occupant?.id && Math.abs(p.x - bx) < tw / 2 ? 'pointer' : 'crosshair'; });
  cv.addEventListener('pointerleave', () => (st.mouse.in = false));
  cv.addEventListener('click', (e) => {
    const p = toBuf(e), { bx, tw, sx } = lay;
    if (Math.abs(p.x - bx) < tw / 2 && st.occupant?.id) return profile.open(st.occupant.id);
    if (Math.abs(p.x - sx) < 26) { $('#wallet').focus(); sfx.blip(); }
    for (let i = 0; i < 12; i++) st.parts.push({ x: p.x, y: p.y, vx: (R() - 0.5) * 2, vy: (R() - 0.8) * 2, g: 0.08, l: 30, c: pick(['#34e0ff', '#ff5fa2', '#ffd23f']) });
  });

  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(cv);

  return {
    st, update, render: (t) => visible && render(t),
    showcase(echoes) {
      st.show = echoes.slice(0, 6);
      if (st.mode === 'idle' && performance.now() > st.holdUntil) {
        if (!st.occupant || !st.show.find((c) => c.id === st.occupant.id)) { st.showI = 0; setOccupant(st.show[0]); st.showT = 5; }
        else { const c = st.show.find((c) => c.id === st.occupant.id); setOccupant(c); }
      }
    },
    idle() { st.mode = 'idle'; st.monitor = 'STANDBY'; st.report = null; st.liquid = 1; st.reveal = 1; st.open = 0; setOccupant(st.show[st.showI]); },
    scanning(wallet) { st.mode = 'scanning'; st.wallet = wallet; st.scan = 0; st.scanTarget = 0.85; st.report = null; st.monitor = 'SCANNING'; st.occupant = null; },
    scanned(report) {
      st.scanTarget = 1; st.scan = 1; st.mode = 'scanned'; st.report = report; st.monitor = report.swaps ? `MATCH: ${report.build.toUpperCase()}` : 'NO SWAPS';
      const fakeId = report.wallet;
      st.occupant = report.swaps ? { ghost: true, look: { ...look({ id: fakeId, build: report.build }) }, label: report.build.toUpperCase(), sub: 'ready to grow', subColor: '#34e0ff', tag: 'MATCHED BUILD', tagColor: '#34e0ff' } : null;
      st.flash = 0.5;
    },
    fail() { st.mode = 'error'; st.monitor = 'ERROR'; st.shake = 0.3; setTimeout(() => { if (st.mode === 'error') { st.mode = st.report ? 'scanned' : 'idle'; st.monitor = st.report ? `MATCH: ${st.report.build.toUpperCase()}` : 'STANDBY'; if (!st.report) setOccupant(st.show[st.showI]); } }, 1400); },
    growing(name, build, wallet) {
      st.mode = 'growing'; st.liquid = 0.1; st.reveal = 0; st.revealCap = 0.72;
      st.occupant = { look: look({ id: 'pending' + wallet, build }), label: name + '.echo', sub: 'growing…', subColor: '#5cf2a8', tag: 'GROWING', tagColor: '#5cf2a8' };
    },
    grown() { st.revealCap = 1; },
    born(echo) {
      st.mode = 'born'; st.flash = 1; st.shake = 0.35; st.open = 1; st.hopY = 16; st.reveal = 1; st.liquid = 1; st.monitor = 'ALIVE';
      st.occupant = { id: echo.id, look: look(echo), label: echo.name, sub: `copying ${short(echo.source_wallet)}`, subColor: '#5cf2a8', tag: 'ALIVE · 1 PAPER SOL', tagColor: '#5cf2a8' };
      st.holdUntil = performance.now() + 30000;
      const { bx, tubeTop } = lay;
      rings(bx, tubeTop + 36, '#34e0ff', 4); rings(bx, tubeTop + 36, '#ff5fa2', 2);
      for (let i = 0; i < 60; i++) st.parts.push({ x: bx, y: tubeTop + 30, vx: (R() - 0.5) * 4, vy: -R() * 3, g: 0.1, l: 50 + R() * 30, s: 2, c: pick(['#34e0ff', '#ff5fa2', '#ffd23f', '#5cf2a8', '#ffffff']) });
      setTimeout(() => { if (st.mode === 'born') { st.mode = 'idle'; } }, 6000);
    },
    busy: () => st.mode === 'scanning' || st.mode === 'growing',
    ping(ev) { const { hx } = lay; for (let k = 0; k < 3; k++) st.parts.push({ ring: 1, x: hx, y: 24, r: 8 + k * 6, vr: 0.6, l: 40 - k * 8, c: ev.side === 'buy' ? '#5cf2a8' : '#ffd23f', flat: 0.45 }); st.mflash = { t: 3, text: `${ev.echo.replace(/\.echo$/, '')} ${ev.side === 'buy' ? 'BUY' : 'SELL'} ${sym(ev.symbol)}`, color: ev.side === 'buy' ? '#5cf2a8' : '#ffd23f' }; },
  };
})();

/* ---------- terminal ---------- */
const term = (() => {
  const el = $('#term'); let lines = [], hideT = 0;
  function render() { el.innerHTML = lines.map((l, i) => `<div class="${l.c || ''}${i === lines.length - 1 && l.cur ? ' cur' : ''}">${l.h}</div>`).join(''); }
  return {
    clear() { lines = []; render(); },
    show() { clearTimeout(hideT); el.classList.add('on'); },
    hide(ms = 0) { clearTimeout(hideT); hideT = setTimeout(() => el.classList.remove('on'), ms); },
    async type(text, c = '', speed = 12) {
      const l = { h: '', c, cur: true }; lines.push(l); if (lines.length > 7) lines.shift();
      if (RM) { l.h = text; render(); l.cur = false; return; }
      for (let i = 1; i <= text.length; i += 2) { l.h = esc(text.slice(0, i)); render(); await new Promise((r) => setTimeout(r, speed)); }
      l.h = esc(text); l.cur = false; render();
    },
  };
})();
