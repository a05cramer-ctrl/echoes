/* ================= the chamber (hero) ================= */
const hero = (() => {
  const cv = $('#cv'), labels = $('#labels'), stage = $('#stage');
  let ch = null, visible = true, wide = innerWidth > 980;
  try {
    if (!window.VX) throw new Error('no 3d');
    ch = VX.createChamber({
      canvas: cv, labelsEl: labels, look, humanLook,
      onPick: (id) => { sfx.blip(); profile.open(id); },
      onFloor: () => sfx.coin(),
      onOrig: (w) => { sfx.blip(); scanFlow.scan(w); },
    });
    BAKER = VX.createBaker(ch.renderer);
  } catch (e) { console.warn('3D off:', e.message); ch = null; document.body.classList.add('no3d'); }

  const MAXBOTS = () => (innerWidth < 640 ? 34 : innerWidth < 1100 ? 48 : 64);
  function layout() {
    if (!ch) return;
    const r = stage.getBoundingClientRect();
    wide = innerWidth > 980;
    const lay = wide
      ? { offset: 0.19, width: Math.max(360, r.width / 4.4), px: pxSize, lift: 4 }
      : { offset: 0, width: innerWidth < 640 ? 200 : 280, px: 1, lift: 16 };
    ch.resize(r.width, r.height, lay);
  }
  let pxSize = 2;
  new ResizeObserver(layout).observe(stage);
  layout();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; ch?.setVisible(visible); }).observe(stage);

  // if the machine struggles, draw fewer, bigger pixels
  let slowT = 0, frames = 0, acc = 0;
  function perf(dt) {
    if (!visible || document.hidden) return;
    frames++; acc += dt;
    if (acc > 2) { const avg = acc / frames; if (avg > 0.045 && wide && pxSize < 3) { pxSize = 3; layout(); } frames = 0; acc = 0; slowT++; }
  }

  // live data in
  let lastSync = [];
  return {
    ok: !!ch,
    tick(dt) { if (!ch) return; ch.tick(dt); perf(dt); },
    sync(list) { lastSync = list; ch?.sync(list, MAXBOTS()); ch?.showcase([...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))); },
    event(ev, loud) { ch?.event(ev, loud); if (loud && ev.side !== 'skip') (ev.side === 'buy' ? sfx.buy : sfx.sell)(); },
    enter(c) { ch?.enter(c); },
    spotlight(id) { ch?.spotlight(id); },
    // scan flow
    busy: () => !!ch && ch.busy(),
    idle() { ch?.idle(); },
    scanning(w) { ch?.scanning(w); },
    scanned(r) { ch?.scanned(r, look({ id: r.wallet, build: r.build })); },
    fail() { ch?.fail(); shake($('#console')); },
    growing(name, build, wallet) { ch?.growing(name, look({ id: 'pending' + wallet, build })); },
    grown() { ch?.grown(); },
    born(c) { ch?.born(c); const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); },
    get lastSync() { return lastSync; },
  };
})();

/* ---------- terminal (types into the console while the lab works) ---------- */
const term = (() => {
  const el = $('#term'); let lines = [], hideT = 0;
  function render() { el.innerHTML = lines.map((l, i) => `<div class="${l.c || ''}${i === lines.length - 1 && l.cur ? ' cur' : ''}">${l.h}</div>`).join(''); }
  return {
    clear() { lines = []; render(); },
    show() { clearTimeout(hideT); el.classList.add('on'); },
    hide(ms = 0) { clearTimeout(hideT); hideT = setTimeout(() => el.classList.remove('on'), ms); },
    async type(text, c = '', speed = 12) {
      const l = { h: '', c, cur: true }; lines.push(l); if (lines.length > 6) lines.shift();
      if (RM) { l.h = esc(text); render(); l.cur = false; return; }
      for (let i = 1; i <= text.length; i += 2) { l.h = esc(text.slice(0, i)); render(); await new Promise((r) => setTimeout(r, speed)); }
      l.h = esc(text); l.cur = false; render();
    },
  };
})();
