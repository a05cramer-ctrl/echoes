/* ================= live feed ================= */
const feed = (() => {
  const box = $('#feed'), tog = $('#showSkips');
  let items = [], lastId = null, first = true;
  try { tog.checked = localStorage.getItem('echoes.skips') !== '0'; } catch {}
  tog.onchange = () => { try { localStorage.setItem('echoes.skips', tog.checked ? '1' : '0'); } catch {} paint(); };

  function card(ev, isNew) {
    const c = S.byId.get(ev.echoId) || { id: ev.echoId, name: ev.echo, build: ev.build, pnlPct: 0 };
    const col = bcol(ev.build);
    const el = document.createElement('div');
    el.className = 'ev' + (ev.side === 'skip' ? ' skip' : '') + (isNew ? ' new' : '');
    el.dataset.id = ev.id;
    const coin = `${coinIcon(ev.icon, ev.symbol)}<b>${esc(sym(ev.symbol))}</b>`;
    const oSide = ev.origSide || (/He sold/.test(ev.reason || '') ? 'sell' : 'buy');
    const orig = ev.origSol != null
      ? `<span><b class="side-${oSide === 'buy' ? 'b' : 's'}">${oSide === 'buy' ? 'bought' : 'sold'}</b> ${fmt.sol(ev.origSol)} SOL ${oSide === 'buy' ? 'of' : 'of'} ${coin}</span>`
      : `<span>${coin}</span>`;
    const mine = ev.side === 'buy' ? `<span class="side-b">bought ${fmt.sol(ev.sol)} SOL</span>`
      : ev.side === 'sell' ? `<span class="side-s">sold for ${fmt.sol(ev.sol)} SOL</span>${ev.pnl != null ? `<b class="pnl ${cls(ev.pnl)}">${fmt.sgn(ev.pnl)}</b>` : ''}`
      : `<span class="side-k">passed</span>`;
    el.innerHTML = `
      <div class="hd"><i class="avs"></i><span class="nm">${esc(ev.echo)}</span><span class="bd" style="--c:${col}">${esc(ev.build)}</span><time data-t="${esc(ev.at)}">${fmt.ago(ev.at)}</time></div>
      <div class="rows">
        <small>ORIG</small><div style="display:flex;gap:8px;align-items:center;min-width:0">${orig}<a class="tx" href="${solscan.tx(ev.signature)}" target="_blank" rel="noopener" title="original transaction on Solscan" onclick="event.stopPropagation()">${esc(short(ev.original))} ↗</a></div>
        <small>ECHO</small><div style="display:flex;gap:8px;align-items:center;min-width:0">${mine}</div>
      </div>
      <div class="why">${esc(ev.reason)}</div>`;
    const av = botAvatar(c);
    el.querySelector('.avs').replaceWith(av);
    el.onclick = () => profile.open(ev.echoId);
    if (isNew && ev.side !== 'skip') poke(av);
    return el;
  }

  function paint(newIds = new Set()) {
    const show = items.filter((e) => tog.checked || e.side !== 'skip').slice(0, 50);
    if (!show.length) {
      box.innerHTML = '';
      const z = document.createElement('div'); z.className = 'zero';
      z.innerHTML = `<i></i><b>${S.echoes.length ? 'waiting for a trade' : 'quiet in here'}</b><span>${S.echoes.length ? 'The moment an echoed wallet swaps, its echoes react here.' : 'Grow the first echo and its trades show up here the second its original swaps.'}</span>`;
      z.querySelector('i').replaceWith(avatar({ h: 4, c: 5, k: '#34e0ff' }));
      box.append(z); return;
    }
    const frag = document.createDocumentFragment();
    for (const e of show) frag.append(card(e, newIds.has(e.id)));
    box.replaceChildren(frag);
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
    if (changed || first) paint(new Set(fresh.map((f) => f.id)));
    first = false;
    // oldest first so bubbles/sounds play in order
    fresh.sort((a, b) => a.id - b.id).forEach((ev, i) => setTimeout(() => {
      floor.event(ev, i < 3);
      if (ev.side !== 'skip') { ticker.push(ev); lab.ping(ev); }
      if (ev.side === 'sell' && Math.abs(ev.pnl || 0) > 0.15) shake($('.floorp'));
    }, i * 450));
  }

  setInterval(() => $$('#feed time').forEach((t) => (t.textContent = fmt.ago(t.dataset.t))), 5000);
  return { ingest, paint, get items() { return items; } };
})();
