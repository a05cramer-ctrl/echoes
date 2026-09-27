/* ================= echo profile ================= */
const profile = (() => {
  const modal = $('#modal'), sheet = $('#sheet');
  let openId = null, timer = 0, tubeDraw = null, lastFocus = null;

  function tubeCanvas(c) {
    const lk = look(c);
    const frames = BAKER ? (() => { try { return BAKER.turntable(voxLook(lk), 20, 'l'); } catch { return null; } })() : null;
    if (frames) {
      const cv = document.createElement('canvas'); cv.className = 'px'; cv.width = frames[0].width; cv.height = frames[0].height + 4;
      const x = cv.getContext('2d');
      const crown = S.echoes.length > 1 && [...S.echoes].sort((a, b) => b.pnlPct - a.pnlPct)[0]?.id === c.id;
      tubeDraw = (t) => {
        if (!cv.isConnected) return;
        const f = frames[Math.floor(t * 7) % frames.length], bob = Math.round(Math.sin(t * 2) * 1.5) + 2;
        x.clearRect(0, 0, cv.width, cv.height); x.drawImage(f, 0, bob);
        if (crown) drawCrown(x, (cv.width >> 1) - 2, bob + 1);
      };
      return cv;
    }
    const cv = document.createElement('canvas'); cv.className = 'px'; cv.width = 44; cv.height = 60;
    const x = cv.getContext('2d');
    tubeDraw = (t) => {
      if (!cv.isConnected) return;
      x.clearRect(0, 0, 44, 60);
      drawBot(x, 13, 26 + Math.round(Math.sin(t * 2) * 1.5), { ...lk, t, blink: (t % 3) < 0.12, happy: c.pnlPct > 5, sad: c.pnlPct < -5 });
    };
    return cv;
  }

  function skeleton() {
    sheet.innerHTML = `<button class="x" aria-label="Close">×</button><div class="zero" style="min-height:360px"><i></i><b>opening the tube…</b></div>`;
    sheet.querySelector('i').replaceWith(avatar({ h: 0, c: 5, k: '#34e0ff' }, '', 'm'));
    sheet.querySelector('.x').onclick = close;
  }

  function pnlChart(trades) {
    const exits = trades.filter((t) => t.side === 'sell' && t.pnl != null).slice().reverse();
    if (exits.length < 2) return '';
    let cum = 0; const pts = [0, ...exits.map((t) => (cum += t.pnl))];
    const W = 600, H = 100, pad = 6, min = Math.min(0, ...pts), max = Math.max(0, ...pts), rng = max - min || 1;
    const X = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2), Y = (v) => pad + (1 - (v - min) / rng) * (H - pad * 2);
    let d = `M${X(0)},${Y(0)}`; pts.forEach((v, i) => { if (i) d += ` H${X(i)} V${Y(v)}`; });
    const col = cum >= 0 ? '#5cf2a8' : '#ff5f7a';
    const area = `${d} V${Y(0)} H${X(0)} Z`;
    return `<div class="pchart"><h4>realized P&amp;L <small>${exits.length} exits · <span class="${cls(cum)}">${fmt.sgn(cum, 3)} SOL</span></small></h4>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Realized profit over ${exits.length} exits">
        <line x1="${pad}" x2="${W - pad}" y1="${Y(0)}" y2="${Y(0)}" stroke="#3c3673" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>
        <path d="${area}" fill="${col}" fill-opacity=".12"/>
        <path d="${d}" fill="none" stroke="${col}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
        <circle cx="${X(pts.length - 1)}" cy="${Y(cum)}" r="4" fill="${col}"/>
      </svg></div>`;
  }

  function render(d) {
    const c = d.echo, r = d.report, col = bcol(c.build), bld = BUILDS[c.build] || BUILDS.Copycat;
    const inCoins = (c.positions || []).reduce((a, p) => a + p.valueSol, 0);
    const n = (c.wins || 0) + (c.losses || 0);
    const url = location.origin + location.pathname + '#/c/' + c.id;
    sheet.innerHTML = `
      <button class="x" aria-label="Close">×</button>
      <div class="ptop">
        <div class="ptube" style="--c:${col}"><i class="tb"></i></div>
        <div class="pinfo">
          <div class="meta"><span class="bdg" style="--c:${col}">${esc(c.build)}</span><span>echo of <a href="${solscan.acct(c.source_wallet)}" target="_blank" rel="noopener">${esc(short(c.source_wallet))}</a></span><span>born ${fmt.ago(c.created_at)} ago</span>${c.lastTradeAt ? `<span>last trade ${fmt.ago(c.lastTradeAt)} ago</span>` : ''}</div>
          <h2>${esc(c.name)}</h2>
          <div class="pbig"><div><small>paper value</small><b>${fmt.sol(c.value, 3)} <span style="font-size:.45em;color:var(--ink3)">SOL</span></b></div><div><small>since birth</small><b class="${cls(c.pnlPct)}">${fmt.pct(c.pnlPct)}</b></div></div>
          <div class="mut" style="font-size:15px;max-width:560px">${esc(bld.line)} It ${esc(bld.rule)} and bets ${esc(bld.size)}, ${esc(bld.range)}.</div>
        </div>
      </div>
      <div class="pgrid">
        <div><small>paper SOL</small><b>${fmt.sol(c.cash, 3)}</b></div>
        <div><small>in coins</small><b>${fmt.sol(inCoins, 3)}</b></div>
        <div><small>realized</small><b class="${cls(c.realized)}">${fmt.sgn(c.realized, 3)}</b></div>
        <div><small>trades · W/L</small><b>${c.trades} <span style="font-size:.6em" class="mut">${c.wins || 0}/${c.losses || 0}</span></b></div>
        <div><small>best exit</small><b class="${c.best && c.best.pnlSol > 0 ? 'up' : 'mut'}">${c.best && c.best.pnlSol > 0 ? esc(sym(c.best.symbol)) + ' ' + fmt.sgn(c.best.pnlSol) : '—'}</b></div>
      </div>
      ${pnlChart(d.trades)}
      <div class="pcols">
        <div>
          <h4>bag</h4>
          <div class="bag">${(c.positions || []).length ? c.positions.map((p) => `<a class="coin" href="${coinLink(p.mint)}" target="_blank" rel="noopener">${coinIcon(p.icon, p.symbol)}<div><b>${esc(sym(p.symbol))}</b><div class="mut" style="font-size:11px">cost ${fmt.sol(p.costSol, 3)} SOL${p.priced ? '' : ' · no live price'}</div></div><span class="v">${fmt.sol(p.valueSol, 3)} SOL<br><span class="${cls(p.pnlPct)}" style="font-size:11px">${fmt.pct(p.pnlPct)}</span></span></a>`).join('') : `<div class="empty">All paper SOL, no open coins.</div>`}</div>
          ${r ? `<h4 style="margin-top:18px">the original</h4>
          <div class="bag"><div class="coin" style="cursor:default"><i class="hu"></i><div><b>${esc(short(r.wallet))}</b><div class="mut" style="font-size:11px">scanned ${fmt.ago((r.at || 0) * 1000)} ago · ${r.swaps} swaps</div></div><span class="v">${Math.round(r.winRate * 100)}% wins<br><span class="mut" style="font-size:11px">hold ${fmt.hold(r.medianHoldMin)}</span></span></div>
          <div class="dna" style="height:40px;margin-top:6px">${(r.dna || []).map((x) => `<i class="${x.s === 's' ? 's' : ''}" style="height:${Math.round(20 + 80 * Math.min(1, Math.sqrt(x.sol / Math.max(0.01, r.biggestBuySol || 1))))}%"></i>`).join('')}</div></div>` : ''}
          ${d.siblings.length ? `<h4 style="margin-top:18px">same original, other echoes</h4><div class="sib">${d.siblings.map((s) => `<button data-sib="${s.id}"><i data-l="${esc(s.build)}|${s.id}"></i>${esc(s.name)}</button>`).join('')}</div>` : ''}
        </div>
        <div>
          <h4>decision log</h4>
          <div class="log">${d.trades.length ? d.trades.map((t) => `<div><em class="${t.side === 'buy' ? 'up' : t.side === 'sell' ? 'side-s' : 'mut'}">${t.side === 'skip' ? 'PASS' : t.side.toUpperCase()}</em><span>${esc(t.reason)}${t.side === 'sell' && t.pnl != null ? ` <b class="${cls(t.pnl)}">${fmt.sgn(t.pnl, 3)} SOL</b>` : ''}</span><time>${fmt.ago(t.at)} <a href="${solscan.tx(t.signature)}" target="_blank" rel="noopener" title="the original's transaction">↗</a></time></div>`).join('') : `<div style="display:block"><span>Waiting for ${esc(short(c.source_wallet))} to make a move. The first swap it makes shows up here within seconds, with the reason for what this echo did.</span></div>`}</div>
        </div>
      </div>
      <div class="pfoot">
        <button class="btn sm" id="pShare">Share on X</button><button class="btn ghost sm" id="pCopy">Copy link</button><button class="btn ghost sm" id="pScan">Echo this wallet too</button>
      </div>`;
    sheet.querySelector('.tb').replaceWith(tubeCanvas(c));
    const hu = sheet.querySelector('.hu'); if (hu) hu.replaceWith(avatar(humanLook(c.source_wallet)));
    $$('[data-l]', sheet).forEach((i) => { const [b, id] = i.dataset.l.split('|'); i.replaceWith(avatar(look({ id, build: b }))); });
    $$('[data-sib]', sheet).forEach((b) => (b.onclick = () => open(b.dataset.sib)));
    sheet.querySelector('.x').onclick = close;
    $('#pCopy').onclick = () => copy(url, 'Echo link copied');
    $('#pShare').onclick = () => share(`${c.name} is ${fmt.pct(c.pnlPct)} on paper after ${c.trades} trades, copying ${short(c.source_wallet)} as a ${c.build}.\n\nwatch it live on echoes`, url);
    $('#pScan').onclick = () => { close(); scanFlow.scan(c.source_wallet); };
    $$('.coin canvas,.sib canvas', sheet).forEach((cv) => (cv.style.width = '26px'));
  }

  async function load(id, first) {
    try {
      const d = await API.get('agent?id=' + encodeURIComponent(id));
      if (openId !== id) return;
      const st = sheet.querySelector('.log')?.scrollTop || 0;
      render(d);
      if (!first) { const lg = sheet.querySelector('.log'); if (lg) lg.scrollTop = st; }
    } catch (e) {
      if (openId !== id) return;
      if (first) { sheet.innerHTML = `<button class="x" aria-label="Close">×</button><div class="zero" style="min-height:300px"><b>${esc(e.message)}</b><span>That echo could not be loaded.</span></div>`; sheet.querySelector('.x').onclick = close; }
    }
  }

  function open(id) {
    if (!id) return;
    lastFocus = document.activeElement;
    openId = id;
    if (location.hash !== '#/c/' + id) history.pushState(null, '', '#/c/' + id);
    modal.classList.add('on'); document.body.style.overflow = 'hidden';
    skeleton(); sfx.blip();
    load(id, true);
    clearInterval(timer); timer = setInterval(() => !document.hidden && load(id), 10000);
    setTimeout(() => sheet.querySelector('.x')?.focus(), 50);
  }
  function close() {
    if (!openId) return;
    openId = null; clearInterval(timer); tubeDraw = null;
    modal.classList.remove('on'); document.body.style.overflow = '';
    if (location.hash.startsWith('#/c/')) history.pushState(null, '', location.pathname + location.search);
    lastFocus?.focus?.();
  }
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  return { open, close, tick: (t) => tubeDraw && tubeDraw(t), get openId() { return openId; } };
})();
