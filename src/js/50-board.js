/* ================= leaderboard ================= */
const board = (() => {
  const body = $('#lbBody'), pod = $('#podium'), shameEl = $('#shame');
  let mode = 'pnl', rows = new Map(), all = false;
  $('#lbMoreBtn').onclick = () => { all = !all; render(S.echoes, false); };
  $$('#lbTabs button').forEach((b) => (b.onclick = () => { mode = b.dataset.s; $$('#lbTabs button').forEach((x) => x.classList.toggle('on', x === b)); sfx.blip(); render(S.echoes, true); }));
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
    pod.replaceChildren(...slots.map((c, i) => {
      const d = document.createElement('div');
      d.className = 'pod ' + cl[i] + (c ? '' : ' ghost');
      if (c) {
        d.innerHTML = `<i></i><div class="n">${esc(c.name)}</div><div class="p ${mode === 'pnl' ? cls(c.pnlPct) : ''}">${esc(metric(c))}</div><div class="b">${esc(c.build)} · ${fmt.sol(c.value)} SOL</div><div class="blk">${n[i]}</div>`;
        const av = botAvatar(c); d.querySelector('i').replaceWith(av);
        d.onclick = () => profile.open(c.id); d.onmouseenter = () => poke(av);
      } else d.innerHTML = `<i></i><div class="n">open slot</div><div class="b">grow an echo</div><div class="blk">${n[i]}</div>`, d.querySelector('i').replaceWith(avatar({ h: 4, c: 8, k: '#57538a', ghost: '#3c3673' }));
      return d;
    }));
  }

  function row(c) {
    let tr = rows.get(c.id);
    if (!tr) {
      tr = document.createElement('tr');
      tr.innerHTML = `<td class="rk"></td><td><div class="who"><i></i><div><b></b><small></small></div></div></td><td class="num pn"></td><td class="num v"></td><td class="num hide-s t"></td><td class="num hide-s w"></td><td class="hide-s bt"></td><td class="hide-s hd"></td>`;
      tr.querySelector('i').replaceWith(botAvatar(c));
      tr.onclick = () => profile.open(c.id);
      rows.set(c.id, tr);
    }
    tr.querySelector('.who b').textContent = c.name;
    tr.querySelector('.who small').innerHTML = `<span class="bdg" style="--c:${bcol(c.build)}">${esc(c.build)}</span> of ${esc(short(c.source_wallet))}`;
    const pn = tr.querySelector('.pn'); pn.textContent = fmt.pct(c.pnlPct); pn.className = 'num pn ' + cls(c.pnlPct);
    tr.querySelector('.v').textContent = fmt.sol(c.value) + ' SOL';
    tr.querySelector('.t').textContent = c.trades;
    tr.querySelector('.w').textContent = wr(c) >= 0 ? Math.round(wr(c) * 100) + '%' : '—';
    tr.querySelector('.bt').innerHTML = c.best && c.best.pnlSol > 0 ? `<span class="up">${esc(sym(c.best.symbol))} ${fmt.sgn(c.best.pnlSol)}</span>` : '<span class="mut">—</span>';
    tr.querySelector('.hd').innerHTML = c.positions?.length ? c.positions.slice(0, 3).map((p) => `<span title="${esc(sym(p.symbol))} ${fmt.pct(p.pnlPct)}" style="display:inline-flex;margin-right:-5px">${coinIcon(p.icon, p.symbol, 'mini')}</span>`).join('') + (c.positions.length > 3 ? `<span class="mut" style="margin-left:10px">+${c.positions.length - 3}</span>` : '') : '<span class="mut">cash</span>';
    return tr;
  }

  function render(echoes, animate) {
    const list = [...echoes].sort(SORT[mode]);
    podium(list);
    if (!list.length) { body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:36px;color:var(--ink3)">No echoes on the board yet. The first one grown takes #1.</td></tr>`; shameEl.innerHTML = ''; rows.clear(); return; }
    const before = new Map(); if (animate !== false) for (const [id, tr] of rows) if (tr.isConnected) before.set(id, tr.getBoundingClientRect().top);
    const top = list.slice(0, all ? 200 : 15), keep = new Set(top.map((c) => c.id));
    for (const id of [...rows.keys()]) if (!keep.has(id)) { rows.get(id).remove(); rows.delete(id); }
    const trs = top.map((c, i) => { const tr = row(c); tr.querySelector('.rk').textContent = i + 1; return tr; });
    body.replaceChildren(...trs);
    if (!RM) for (const [id, y0] of before) { const tr = rows.get(id); if (!tr) continue; const dy = y0 - tr.getBoundingClientRect().top; if (Math.abs(dy) > 2) tr.animate([{ transform: `translateY(${dy}px)`, background: '#34e0ff14' }, { transform: 'none', background: 'transparent' }], { duration: 600, easing: 'cubic-bezier(.2,1,.3,1)' }); }
    const more = $('#lbMore'); more.hidden = list.length <= 15; $('#lbMoreBtn').textContent = all ? 'show top 15' : `show all ${list.length}`;
    // hall of shame
    const worst = [...echoes].sort((a, b) => a.pnlPct - b.pnlPct)[0];
    if (echoes.length >= 4 && worst && worst.pnlPct < -1) {
      shameEl.innerHTML = `<div class="shame"><i></i><span>hall of shame</span><b>${esc(worst.name)}</b><span class="dn">${fmt.pct(worst.pnlPct)}</span><span class="mut" style="margin-left:auto">copying ${esc(short(worst.source_wallet))}</span></div>`;
      shameEl.querySelector('i').replaceWith(botAvatar(worst)); shameEl.firstElementChild.onclick = () => profile.open(worst.id);
    } else shameEl.innerHTML = '';
  }
  return { render };
})();
