/* ================= footer parade: the echoes march past, trailed by their echoes ================= */
const parade = (() => {
  const cv = $('#parade'); if (!cv) return { tick() {} };
  const x = cv.getContext('2d');
  let W = 320, H = 42, visible = false, walkers = [], t = 0, n = -1;
  function size() { const r = cv.getBoundingClientRect(); H = 42; W = Math.max(120, Math.round(H * r.width / Math.max(1, r.height))); cv.width = W; cv.height = H; }
  new ResizeObserver(size).observe(cv); size();
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(cv);

  function frames(lk) {
    try { if (BAKER) { const [a, b] = BAKER.side(voxLook(lk), 's'); return [a, b]; } } catch {}
    const a = document.createElement('canvas'); a.width = 18; a.height = 22; drawBot(a.getContext('2d'), 0, 2, lk);
    return [a, a];
  }
  function tint(img, col) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d');
    g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return c;
  }
  function roster() {
    const src = S.echoes.length ? S.echoes.slice(0, 20) : Object.keys(BUILDS).map((b, i) => ({ id: 'demo' + i, build: b, _fake: true }));
    const gap = Math.max(40, (W + 60) / Math.max(4, src.length));
    walkers = src.map((c, i) => {
      const lk = look(c), f = frames(lk);
      return { c, f, gp: tint(f[0], '#ff4fa3'), gc: tint(f[0], '#2ee6ff'), x: W - 40 - i * gap, sp: 12 + (hash(c.id) % 8), ph: (hash(c.id) % 100) / 10 };
    });
  }
  function tick(dt) {
    t += dt;
    if (!visible) return;
    if (n !== S.echoes.length) { n = S.echoes.length; roster(); }
    x.clearRect(0, 0, W, H);
    for (let i = 0; i < W; i += 6) { x.fillStyle = i % 12 ? '#16133a' : '#241f55'; x.fillRect(i, H - 5, 6, 1); }
    const span = W + 60;
    for (const w of walkers) {
      if (!RM) w.x += w.sp * dt;
      if (w.x > W + 30) w.x -= span + 30;
      const step = ((t * w.sp * 0.28 + w.ph) | 0) % 2 === 1;
      const img = w.f[step ? 1 : 0], y = H - 5 - img.height + 5;
      x.globalAlpha = 0.28; x.drawImage(w.gc, Math.round(w.x - 12), y); x.globalAlpha = 0.4; x.drawImage(w.gp, Math.round(w.x - 6), y); x.globalAlpha = 1;
      x.drawImage(img, Math.round(w.x), y - (step ? 1 : 0));
    }
  }
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
    const hit = walkers.find((w) => !w.c._fake && px >= w.x && px <= w.x + 30);
    if (hit) profile.open(hit.c.id);
  });
  return { tick };
})();
