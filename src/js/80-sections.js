/* ================= sections ================= */
function bootBanner(setup) {
  S.setup = setup && setup.length ? setup : null;
  $('#boot').classList.toggle('on', !!S.setup);
  $('#scanBtn').disabled = !!S.setup;
  if (S.setup) $('#bootMsg').textContent = 'Scanning and cloning open as soon as setup finishes. Everything below goes live the same moment.';
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
      const t0 = performance.now(), dur = RM ? 1 : 900;
      const fmtv = (v) => (isSol ? fmt.sol(v, v >= 100 ? 0 : 2) : fmt.int(v));
      (function f(now) { const k2 = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k2, 3); b.textContent = fmtv(from + (to - from) * e); if (k2 < 1) requestAnimationFrame(f); })(t0);
    });
    $('#t24').textContent = `${fmt.int(stats.trades24h || 0)} in the last 24h`;
    $('#labAlive').textContent = fmt.int(stats.echoes);
  }
  return { set };
})();

function renderHints(stats) {
  const h = $('#hints');
  const recent = (stats?.recentScans || []).slice(0, 3);
  const paste = navigator.clipboard?.readText ? `<button type="button" id="pasteBtn">paste</button>` : '';
  h.innerHTML = (recent.length ? `<span>recently scanned:</span>` + recent.map((r) => `<button type="button" data-w="${esc(r.wallet)}">${esc(short(r.wallet))} <em>${esc(r.build)}</em></button>`).join('') : `<span>any wallet with swaps works. a friend, a KOL, a bot, yourself.</span>`) + paste;
  $$('[data-w]', h).forEach((b) => (b.onclick = () => scanFlow.scan(b.dataset.w)));
  const pb = $('#pasteBtn'); if (pb) pb.onclick = async () => { try { const v = (await navigator.clipboard.readText()).trim(); $('#wallet').value = v; if (B58RE.test(v)) scanFlow.scan(v); else toast('Clipboard has no wallet in it', true); } catch { $('#wallet').focus(); } };
}

function renderBuilds(echoes) {
  const g = $('#buildGrid');
  const counts = {}; for (const c of echoes) counts[c.build] = (counts[c.build] || 0) + 1;
  if (!g.children.length) {
    for (const [name, b] of Object.entries(BUILDS)) {
      const d = document.createElement('div'); d.className = 'bc reveal'; d.style.setProperty('--c', b.col);
      d.innerHTML = `<i></i><b>${name}</b><p>${esc(b.line)}</p><div class="rl"><div><span>picked when</span><span>${esc(b.pick)}</span></div><div><span>sizing</span><span>${esc(b.size)}</span></div><div><span>per trade</span><span>${esc(b.range)}</span></div><div><span>rule</span><span>${esc(b.rule)}</span></div></div><div class="alive" data-b="${name}"></div>`;
      const av = avatar({ h: b.h, c: b.c, k: b.col, bd: b.h === 1 ? 1 : 0 }); d.querySelector('i').replaceWith(av);
      d.onmouseenter = () => { poke(av); sfx.blip(); };
      g.append(d); reveal.observe(d);
    }
  }
  $$('.alive', g).forEach((el) => { const n = counts[el.dataset.b] || 0; el.textContent = n ? `${n} alive` : 'none alive yet'; });
}

function renderOriginals(stats) {
  const g = $('#orgs'), top = stats?.topOriginals || [];
  if (!top.length) { g.innerHTML = `<div class="og" style="grid-column:1/-1;cursor:default"><i></i><div><b>No wallets echoed yet</b><small>The first wallet someone echoes shows up here.</small></div></div>`; g.querySelector('i').replaceWith(avatar({ ...humanLook('nobody'), ghost: '#3c3673' })); return; }
  g.replaceChildren(...top.map((o) => {
    const d = document.createElement('div'); d.className = 'og';
    d.innerHTML = `<i></i><div style="min-width:0"><b>${esc(short(o.wallet))}</b><small><span class="bdg" style="--c:${bcol(o.build)}">${esc(o.build)}</span></small></div><div class="n">${o.echoes}<small>echo${o.echoes === 1 ? '' : 's'}</small></div>`;
    d.querySelector('i').replaceWith(avatar(humanLook(o.wallet)));
    d.onclick = () => scanFlow.scan(o.wallet);
    return d;
  }));
}

const reveal = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); } }), { rootMargin: '0px 0px -40px 0px' });
$$('.reveal').forEach((el) => reveal.observe(el));
(() => {
  const ill = { 1: [humanLook('a1'), null, { h: 2, c: 5, k: '#34e0ff', ghost: '#34e0ff' }], 2: [{ h: 0, c: 3, k: '#ff5fa2' }], 3: [humanLook('a3'), '→', { h: 4, c: 7, k: '#5cf2a8' }] };
  $$('[data-ill]').forEach((el) => ill[el.dataset.ill].forEach((o) => { if (o === null) return; if (typeof o === 'string') { const b = document.createElement('b'); b.textContent = o; el.append(b); } else el.append(avatar(o)); }));
})();
(() => { const tb = $('#truthBot'); const a = avatar({ h: 4, c: 7, k: '#5cf2a8' }); tb.replaceWith(a); })();
