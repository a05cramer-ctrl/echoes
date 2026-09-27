/* ================= the wire: live feed ================= */
const feed = (() => {
  const box = $('#feed'), tog = $('#showSkips');
  let items = [], lastId = null, first = true;
  try { tog.checked = localStorage.getItem('echoes.skips') !== '0'; } catch {}
  tog.onchange = () => { try { localStorage.setItem('echoes.skips', tog.checked ? '1' : '0'); } catch {} paint(); };

  function card(ev, isNew) {
    const c = S.byId.get(ev.echoId) || { id: ev.echoId, name: ev.echo, build: ev.build, pnlPct: 0 };
    const el = document.createElement('div');
    const loss = ev.side === 'sell' && (ev.pnl ?? 0) < 0;
    el.className = 'ev ' + (ev.side === 'skip' ? 'skip' : ev.side === 'buy' ? 'b' : 's' + (loss ? ' loss' : '')) + (isNew ? ' new' : '');
    el.dataset.id = ev.id;
    const oSide = ev.origSide || (/He sold/.test(ev.reason || '') ? 'sell' : 'buy');
    const coin = `<span class="coinx">${coinIcon(ev.icon, ev.symbol)}<b>${esc(sym(ev.symbol))}</b></span>`;
    const orig = ev.origSol != null ? `<span class="${oSide === 'buy' ? 'side-b' : 'side-s'}">${oSide === 'buy' ? 'bought' : 'sold'}</span> ${fmt.sol(ev.origSol)} SOL of ${coin}` : coin;
    const mine = ev.side === 'buy' ? `<span class="act side-b">bought ${fmt.sol(ev.sol)} SOL</span>`
      : ev.side === 'sell' ? `<span class="act side-s">sold for ${fmt.sol(ev.sol)} SOL</span>${ev.pnl != null ? `<b class="pnl ${cls(ev.pnl)}">${fmt.sgn(ev.pnl)}</b>` : ''}`
      : `<span class="act side-k">passed</span>`;
    el.innerHTML = `
      <div class="row o"><i class="ho"></i><span class="who">${esc(short(ev.original))}</span><span>${orig}</span><a class="tx" href="${solscan.tx(ev.signature)}" target="_blank" rel="noopener" title="the original transaction on Solscan">↗</a><time data-t="${esc(ev.at)}">${fmt.ago(ev.at)}</time></div>
      <div class="lk"></div>
      <div class="row e"><i class="bo"></i><span class="nm">${esc(ev.echo)}</span><span class="bdg" style="--c:${bcol(ev.build)}">${esc(ev.build)}</span>${mine}</div>
      <div class="why">${esc(ev.reason)}</div>`;
    el.querySelector('.ho').replaceWith(avatar(humanLook(ev.original)));
    const av = botAvatar(c); el.querySelector('.bo').replaceWith(av);
    el.querySelector('.tx').addEventListener('click', (e) => e.stopPropagation());
    el.onclick = () => profile.open(ev.echoId);
    if (isNew && ev.side !== 'skip') poke(av);
    return el;
  }

  function paint(newIds = new Set()) {
    const show = items.filter((e) => tog.checked || e.side !== 'skip').slice(0, 40);
    if (!show.length) {
      const z = document.createElement('div'); z.className = 'zero';
      z.innerHTML = `<i></i><b>${S.echoes.length ? 'waiting for a trade' : 'quiet in here'}</b><span>${S.echoes.length ? 'The moment a watched wallet swaps, its echoes answer here.' : 'Grow the first echo and its trades land here the second its wallet swaps.'}</span>`;
      z.querySelector('i').replaceWith(avatar({ h: 4, c: 5, k: '#34e0ff' }, '', 'm'));
      box.replaceChildren(z); return;
    }
    const frag = document.createDocumentFragment();
    for (const e of show) frag.append(card(e, newIds.has(e.id)));
    box.replaceChildren(frag);
  }

  const agoText = (t) => { const a = fmt.ago(t); return a === 'now' ? 'just now' : a + ' ago'; };
  function signal(pulse) {
    const el = $('#signal'); if (!el) return;
    const ev = items.find((e) => e.side !== 'skip');
    if (!ev) { el.hidden = true; return; }
    el.hidden = false;
    el.querySelector('span').innerHTML = `<b>${esc(ev.echo)}</b> ${ev.side === 'buy' ? 'bought' : 'sold'} ${esc(sym(ev.symbol))} · ${fmt.sol(ev.sol)} SOL · <time data-t="${esc(ev.at)}">${agoText(ev.at)}</time>`;
    el.onclick = () => profile.open(ev.echoId);
    if (pulse) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }
  function ingest(rows) {
    if (!Array.isArray(rows)) return;
    const fresh = lastId == null ? [] : rows.filter((r) => r.id > lastId);
    const known = new Set(items.map((i) => i.id));
    const merged = [...rows.filter((r) => !known.has(r.id)), ...items].sort((a, b) => b.id - a.id).slice(0, 80);
    const changed = merged.length !== items.length || merged[0]?.id !== items[0]?.id;
    items = merged;
    if (rows.length) lastId = Math.max(lastId ?? 0, ...rows.map((r) => r.id));
    else lastId ??= 0;
    if (changed || first) { paint(new Set(fresh.map((f) => f.id))); signal(!first && fresh.some((f) => f.side !== 'skip')); }
    first = false;
    // oldest first so ripples play in order on the floor
    fresh.sort((a, b) => a.id - b.id).forEach((ev, i) => setTimeout(() => {
      hero.event(ev, i < 3);
      if (ev.side !== 'skip') ticker.push(ev);
    }, i * 500));
  }

  setInterval(() => { $$('#feed time').forEach((t) => (t.textContent = fmt.ago(t.dataset.t))); $$('#signal time').forEach((t) => (t.textContent = agoText(t.dataset.t))); }, 5000);
  return { ingest, paint, get items() { return items; } };
})();
