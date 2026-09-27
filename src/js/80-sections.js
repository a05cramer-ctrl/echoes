/* ================= sections ================= */
function bootBanner(setup) {
  S.setup = setup && setup.length ? setup : null;
  $('#boot').classList.toggle('on', !!S.setup);
  $('#scanBtn').disabled = !!S.setup;
  if (S.setup) $('#bootMsg').textContent = 'Scanning opens as soon as setup finishes. Everything goes live the same moment.';
}

const counters = (() => {
  const cur = {};
  function set(stats) {
    $$('#counters b[data-k]').forEach((b) => {
      const k = b.dataset.k, to = Number(stats[k] || 0), from = cur[k] ?? 0, isSol = b.dataset.f === 'sol';
      if (from === to && cur[k] !== undefined) return;
      cur[k] = to;
      const card = b.closest('.ctr');
      if (from !== to && from !== 0) { card.classList.remove('bump'); void card.offsetWidth; card.classList.add('bump'); }
      const t0 = performance.now(), dur = RM ? 1 : 1100;
      const fmtv = (v) => (isSol ? fmt.sol(v, v >= 100 ? 0 : 2) : fmt.int(v));
      (function f(now) { const k2 = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k2, 3); b.textContent = fmtv(from + (to - from) * e); if (k2 < 1) requestAnimationFrame(f); })(t0);
    });
  }
  return { set };
})();

function renderHints(stats) {
  const h = $('#hints');
  const recent = (stats?.recentScans || []).slice(0, 3);
  const paste = navigator.clipboard?.readText ? `<button type="button" id="pasteBtn">paste</button>` : '';
  h.innerHTML = (recent.length ? `<span>recent:</span>` + recent.map((r) => `<button type="button" class="rc" data-w="${esc(r.wallet)}">${esc(short(r.wallet))} <em style="color:${bcol(r.build)}">${esc(r.build)}</em></button>`).join('') : `<span>any wallet that swaps: a friend, a KOL, a bot, yours.</span>`) + paste;
  $$('[data-w]', h).forEach((b) => (b.onclick = () => scanFlow.scan(b.dataset.w)));
  const pb = $('#pasteBtn'); if (pb) pb.onclick = async () => { try { const v = (await navigator.clipboard.readText()).trim(); $('#wallet').value = v; if (B58RE.test(v)) scanFlow.scan(v); else toast('Clipboard has no wallet in it', true); } catch { $('#wallet').focus(); } };
}

/* six builds, each on a slow pixel turntable */
const turntables = [];
function renderBuilds(echoes) {
  const g = $('#buildGrid');
  const counts = {}; for (const c of echoes) counts[c.build] = (counts[c.build] || 0) + 1;
  if (!g.children.length) {
    for (const [name, b] of Object.entries(BUILDS)) {
      const d = document.createElement('div'); d.className = 'bc reveal'; d.style.setProperty('--c', b.col);
      d.innerHTML = `<div class="top"><div class="tt"><i></i></div><div><div class="nm" data-t="${name}">${name}</div><p class="ln">${esc(b.line)}</p></div></div>
        <dl><dt>picked when</dt><dd>${esc(b.pick)}</dd><dt>sizing</dt><dd>${esc(b.size)}</dd><dt>per trade</dt><dd>${esc(b.range)}</dd><dt>rule</dt><dd>${esc(b.rule)}</dd></dl>
        <div class="alive" data-b="${name}"></div>`;
      const lk = { h: b.h, c: b.c, k: b.col, bd: b.h === 1 ? 1 : 0 };
      let frames = null; try { frames = BAKER && BAKER.turntable(voxLook(lk), 24, 'm'); } catch {}
      if (frames) {
        const cv = document.createElement('canvas'); cv.className = 'px'; cv.width = frames[0].width; cv.height = frames[0].height + 3;
        d.querySelector('.tt i').replaceWith(cv);
        const tt = { cv, x: cv.getContext('2d'), frames, a: (turntables.length * 4) % 24, speed: 5, hop: 0, el: d };
        turntables.push(tt);
        d.onmouseenter = () => { tt.speed = 22; tt.hop = 0.35; sfx.blip(); };
        d.onmouseleave = () => (tt.speed = 5);
      } else { const av = avatar(lk); d.querySelector('.tt i').replaceWith(av); d.onmouseenter = () => poke(av); }
      g.append(d); reveal.observe(d);
    }
  }
  $$('.alive', g).forEach((el) => { const n = counts[el.dataset.b] || 0; el.textContent = n ? `${n} alive right now` : 'none alive yet'; });
}
let ttVis = true;
new IntersectionObserver(([e]) => (ttVis = e.isIntersecting)).observe($('#buildGrid'));
function tickTurntables(dt) {
  if (!ttVis) return;
  for (const t of turntables) {
    t.a += dt * t.speed; if (t.hop > 0) t.hop -= dt;
    const n = t.frames.length, f = t.frames[((Math.floor(t.a) % n) + n) % n];
    t.x.clearRect(0, 0, t.cv.width, t.cv.height); t.x.drawImage(f, 0, t.hop > 0 ? 0 : 2);
  }
}

function renderOriginals(stats) {
  const g = $('#orgs'), top = stats?.topOriginals || [];
  if (!top.length) { g.innerHTML = `<div class="og" style="grid-column:1/-1;cursor:default"><i></i><div><b>No wallets echoed yet</b><small class="mut">The first wallet someone echoes shows up here.</small></div></div>`; g.querySelector('i').replaceWith(avatar({ ...humanLook('nobody'), ghost: '#3c3673' })); return; }
  g.replaceChildren(...top.map((o) => {
    const d = document.createElement('div'); d.className = 'og';
    d.innerHTML = `<i></i><div style="min-width:0"><b>${esc(short(o.wallet))}</b><small><span class="bdg" style="--c:${bcol(o.build)}">${esc(o.build)}</span></small></div><div class="n">${o.echoes}<small>echo${o.echoes === 1 ? '' : 'es'}</small></div>`;
    d.querySelector('i').replaceWith(avatar(humanLook(o.wallet)));
    d.onclick = () => scanFlow.scan(o.wallet);
    return d;
  }));
}

/* how a trade echoes: the four stops light up in turn as the pulse runs the wire */
(() => {
  const nodes = $$('#path .node');
  const icons = {
    human: () => avatar(humanLook('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'), '', 'm'),
    bot: () => avatar({ h: 3, c: 3, k: '#5cf2a8' }, '', 'm'),
    dish(x) { const P = (c, a, b, w, h) => { x.fillStyle = c; x.fillRect(a, b, w, h); }; P('#8a93c8', 6, 22, 18, 4); P('#5b6296', 13, 14, 4, 9); P('#c3caff', 5, 6, 20, 3); P('#c3caff', 7, 9, 16, 3); P('#8a93c8', 10, 12, 10, 2); P('#2ee6ff', 14, 2, 2, 5); P('#ff4fa3', 20, 1, 2, 2); P('#ff4fa3', 23, 3, 2, 2); P('#0f1222', 4, 26, 22, 2); },
    coin(x) { const P = (c, a, b, w, h) => { x.fillStyle = c; x.fillRect(a, b, w, h); }; P('#0f1222', 7, 5, 16, 22); P('#0f1222', 5, 7, 20, 18); P('#d6a912', 8, 6, 14, 20); P('#d6a912', 6, 8, 18, 16); P('#ffd23f', 8, 7, 13, 17); P('#ffd23f', 7, 9, 15, 13); P('#fff27a', 10, 9, 3, 3); P('#d6a912', 13, 11, 4, 10); P('#d6a912', 11, 13, 8, 2); P('#5cf2a8', 24, 2, 2, 6); P('#5cf2a8', 22, 4, 6, 2); },
  };
  $$('#path canvas.nic').forEach((cv) => {
    const k = cv.dataset.ic;
    if (k === 'human' || k === 'bot') { const a = icons[k](); a.className = cv.className; cv.replaceWith(a); }
    else icons[k](cv.getContext('2d'));
  });
  let i = 0;
  setInterval(() => { if (document.hidden) return; nodes.forEach((n, j) => n.classList.toggle('hot', j === i)); i = (i + 1) % nodes.length; }, 800);
})();

const reveal = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); } }), { rootMargin: '0px 0px -40px 0px' });
$$('.reveal').forEach((el) => reveal.observe(el));
