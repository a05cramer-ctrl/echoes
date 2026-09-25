/* ================= echo profile ================= */
const profile = (() => {
  const modal = $('#modal'), sheet = $('#sheet');
  let openId = null, timer = 0, tubeDraw = null, lastFocus = null;

  function tubeCanvas(c) {
    const cv = document.createElement('canvas'); cv.className = 'px'; cv.width = 44; cv.height = 60;
    const x = cv.getContext('2d'), lk = look(c), bubbles = [];
    tubeDraw = (t) => {
      if (!cv.isConnected) return;
      x.clearRect(0, 0, 44, 60);
      x.fillStyle = '#3c3673'; x.fillRect(2, 0, 40, 5); x.fillRect(2, 54, 40, 6);
      x.fillStyle = '#57538a'; x.fillRect(3, 1, 38, 1); x.fillRect(3, 55, 38, 1);
      x.fillStyle = '#0d1a2c'; x.fillRect(5, 5, 34, 49);
      x.fillStyle = '#135a73'; x.fillRect(5, 12, 34, 42);
      x.fillStyle = '#6cebff'; for (let i = 0; i < 34; i += 2) x.fillRect(5 + i, 12 + Math.round(Math.sin(t * 4 + i * 0.5) * 0.6), 2, 1);
      if (R() < 0.3) bubbles.push({ x: 7 + R() * 30, y: 52, l: 50 });
      x.fillStyle = '#9ff3ff'; for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.y -= 0.5; if (b.y < 13 || --b.l < 0) { bubbles.splice(i, 1); continue; } x.fillRect(Math.round(b.x), Math.round(b.y), 1, 1); }
      const bob = Math.round(Math.sin(t * 2) * 1.5);
      drawBot(x, 13, 26 + bob, { ...lk, t, blink: (t % 3) < 0.12, happy: c.pnlPct > 5, sad: c.pnlPct < -5, lx: Math.round(Math.sin(t * 0.7)) });
      x.globalAlpha = 0.2; x.fillStyle = '#8fe9ff'; x.fillRect(5, 5, 34, 49); x.globalAlpha = 0.5; x.fillStyle = '#e8fbff'; x.fillRect(8, 8, 2, 43); x.globalAlpha = 1;
      if (S.byId.size && [...S.echoes].sort((a, b) => b.pnlPct - a.pnlPct)[0]?.id === c.id && S.echoes.length > 1) drawCrown(x, 19, 20 + bob);
    };
    return cv;
  }

  function skeleton() {
    sheet.innerHTML = `<button class="x" aria-label="Close">×</button><div class="zero" style="min-height:360px"><i></i><b>opening the tube…</b></div>`;
    sheet.querySelector('i').replaceWith(avatar({ h: 0, c: 5, k: '#34e0ff' }));
    sheet.querySelector('.x').onclick = close;
  }

  function render(d) {
    const c = d.echo, r = d.report, col = bcol(c.build), bld = BUILDS[c.build] || BUILDS.Copycat;
    const inCoins = (c.positions || []).reduce((a, p) => a + p.valueSol, 0);
    const n = (c.wins || 0) + (c.losses || 0);
    const url = location.origin + location.pathname + '#/c/' + c.id;
    sheet.innerHTML = `
      <button class="x" aria-label="Close">×</button>
      <div class="ptop">
        <div class="ptube"><i class="tb"></i></div>
        <div class="pinfo">
          <div class="meta"><span class="bdg" style="--c:${col}">${esc(c.build)}</span><span>echo of <a href="${solscan.acct(c.source_wallet)}" target="_blank" rel="noopener">${esc(short(c.source_wallet))}</a></span><span>born ${fmt.ago(c.created_at)} ago</span>${c.lastTradeAt ? `<span>last trade ${fmt.ago(c.lastTradeAt)} ago</span>` : ''}</div>
          <h2>${esc(c.name)}</h2>
          <div class="pbig"><div><small>paper value</small><b>${fmt.sol(c.value, 3)} <span style="font-size:.45em;color:var(--ink3)">SOL</span></b></div><div><small>since birth</small><b class="${cls(c.pnlPct)}">${fmt.pct(c.pnlPct)}</b></div></div>
          <div class="mut" style="font:500 12.5px var(--mono)">${esc(bld.line)} It ${esc(bld.rule)}, ${esc(bld.size)}, ${esc(bld.range)}.</div>
        </div>
      </div>
      <div class="pgrid">
        <div><small>paper SOL</small><b>${fmt.sol(c.cash, 3)}</b></div>
        <div><small>in coins</small><b>${fmt.sol(inCoins, 3)}</b></div>
        <div><small>realized</small><b class="${cls(c.realized)}">${fmt.sgn(c.realized, 3)}</b></div>
        <div><small>trades · W/L</small><b>${c.trades} <span style="font-size:.6em" class="mut">${c.wins || 0}/${c.losses || 0}</span></b></div>
        <div><small>best exit</small><b class="${c.best && c.best.pnlSol > 0 ? 'up' : 'mut'}">${c.best && c.best.pnlSol > 0 ? esc(sym(c.best.symbol)) + ' ' + fmt.sgn(c.best.pnlSol) : '—'}</b></div>
      </div>
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
