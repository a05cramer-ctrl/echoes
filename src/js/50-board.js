/* ================= the board ================= */
const board = (() => {
  const body = $('#lbBody'), pod = $('#podium'), shameEl = $('#shame');
  let mode = 'pnl', rows = new Map(), all = false, maxAbs = 1, podKey = '';
  $('#lbMoreBtn').onclick = () => { all = !all; render(S.echoes, false); };
  $$('#lbTabs button').forEach((b) => (b.onclick = () => { mode = b.dataset.s; $$('#lbTabs button').forEach((x) => x.classList.toggle('on', x === b)); sfx.blip(); podKey = ''; render(S.echoes, true); }));
  const wr = (c) => { const n = (c.wins || 0) + (c.losses || 0); return n ? c.wins / n : -1; };
  const SORT = {
    pnl: (a, b) => b.pnlPct - a.pnlPct || b.trades - a.trades,
    trades: (a, b) => b.trades - a.trades || b.pnlPct - a.pnlPct,
    win: (a, b) => wr(b) - wr(a) || b.trades - a.trades,
    new: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  };
  const metric = (c) => mode === 'trades' ? `${c.trades} trades` : mode === 'win' ? (wr(c) >= 0 ? Math.round(wr(c) * 100) + '% wins' : 'no exits') : mode === 'new' ? `born ${fmt.ago(c.created_at)} ago` : fmt.pct(c.pnlPct);

  function podium(list) {
    const slots = [list[1], list[0], list[2]], cl = ['p2', 'p1', 'p3'], n = [2, 1, 3];
    const key = mode + slots.map((c) => (c ? c.id + metric(c) : '-')).join('|');
    if (key === podKey) return; podKey = key;
    pod.replaceChildren(...slots.map((c, i) => {
      const d = document.createElement('div');
      d.className = 'pod ' + cl[i] + (c ? '' : ' ghost');
      if (c) {
        d.innerHTML = `<i></i><div class="n">${esc(c.name)}</div><div class="p ${mode === 'pnl' ? cls(c.pnlPct) : ''}">${esc(metric(c))}</div><div class="b">${esc(c.build)} · ${fmt.sol(c.value)} SOL</div><div class="blk">${n[i]}</div>`;
        const av = botAvatar(c, 'pv', 'm'); d.querySelector('i').replaceWith(av);
        if (i === 1) { const cr = document.createElement('canvas'); cr.width = 5; cr.height = 3; cr.className = 'px crown'; drawCrown(cr.getContext('2d'), 0, 0); av.before(cr); }
        d.onclick = () => profile.open(c.id); d.onmouseenter = () => poke(av);
      } else { d.innerHTML = `<i></i><div class="n">open slot</div><div class="b">grow an echo</div><div class="blk">${n[i]}</div>`; d.querySelector('i').replaceWith(avatar({ h: 4, c: 8, k: '#57538a', ghost: '#3c3673' }, 'pv', 'm')); }
      return d;
    }));
  }

  function row(c) {
    let li = rows.get(c.id);
    if (!li) {
      li = document.createElement('li');
      li.innerHTML = `<span class="rk"></span><i></i><div class="nm"><b></b><small></small></div><div class="pn"></div>`;
      li.querySelector('i').replaceWith(botAvatar(c));
      li.onclick = () => profile.open(c.id);
      rows.set(c.id, li);
    }
    li.querySelector('.nm b').textContent = c.name;
    li.querySelector('.nm small').innerHTML = `<span class="bdg" style="--c:${bcol(c.build)}">${esc(c.build)}</span>of ${esc(short(c.source_wallet))}`;
    const pn = li.querySelector('.pn');
    const val = mode === 'pnl' ? `<span class="${cls(c.pnlPct)}">${fmt.pct(c.pnlPct)}</span>` : esc(metric(c));
    pn.innerHTML = `${val}<small>${fmt.sol(c.value)} SOL · ${c.trades} trades</small>${mode === 'pnl' ? `<span class="pbar ${c.pnlPct < 0 ? 'neg' : ''}"><i style="width:${Math.min(100, (Math.abs(c.pnlPct) / maxAbs) * 100).toFixed(1)}%"></i></span>` : ''}`;
    return li;
  }

  function render(echoes, animate) {
    const list = [...echoes].sort(SORT[mode]);
    podium(list);
    if (!list.length) { body.innerHTML = `<li style="display:block;text-align:center;padding:26px;color:var(--ink3);cursor:default">No echoes on the board yet. The first one grown takes #1.</li>`; shameEl.innerHTML = ''; rows.clear(); $('#lbMore').hidden = true; return; }
    const before = new Map(); if (animate !== false) for (const [id, li] of rows) if (li.isConnected) before.set(id, li.getBoundingClientRect().top);
    maxAbs = Math.max(1, ...list.map((c) => Math.abs(c.pnlPct)));
    const lim = innerWidth < 640 ? 7 : 9;
    const rest = list.slice(3), top = rest.slice(0, all ? 200 : lim), keep = new Set(top.map((c) => c.id));
    for (const id of [...rows.keys()]) if (!keep.has(id)) { rows.get(id).remove(); rows.delete(id); }
    body.replaceChildren(...top.map((c, i) => { const li = row(c); li.querySelector('.rk').textContent = i + 4; return li; }));
    if (!RM) for (const [id, y0] of before) { const li = rows.get(id); if (!li) continue; const dy = y0 - li.getBoundingClientRect().top; if (Math.abs(dy) > 2) li.animate([{ transform: `translateY(${dy}px)`, background: '#2ee6ff14' }, { transform: 'none', background: 'transparent' }], { duration: 600, easing: 'cubic-bezier(.2,1,.3,1)' }); }
    const more = $('#lbMore'); more.hidden = rest.length <= lim; $('#lbMoreBtn').textContent = all ? 'show less' : `show all ${list.length}`;
    const worst = [...echoes].sort((a, b) => a.pnlPct - b.pnlPct)[0];
    if (echoes.length >= 4 && worst && worst.pnlPct < -1) {
      shameEl.innerHTML = `<div class="shame"><i></i><span>hall of shame</span><b>${esc(worst.name)}</b><span class="dn">${fmt.pct(worst.pnlPct)}</span></div>`;
      shameEl.querySelector('i').replaceWith(botAvatar(worst)); shameEl.firstElementChild.onclick = () => profile.open(worst.id);
    } else shameEl.innerHTML = '';
  }
  return { render };
})();
