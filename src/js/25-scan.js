/* ================= scan + grow flow ================= */
const B58RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scanFlow = (() => {
  const form = $('#scanForm'), input = $('#wallet'), btn = $('#scanBtn'), rep = $('#report');
  let current = null, growing = false;

  input.addEventListener('paste', () => setTimeout(() => { const v = input.value.trim(); if (B58RE.test(v)) form.requestSubmit(); }, 30));
  form.addEventListener('submit', (e) => { e.preventDefault(); scan(input.value.trim()); });

  async function scan(wallet, { quiet } = {}) {
    if (lab.busy()) return;
    if (!B58RE.test(wallet)) { toast('That does not look like a Solana wallet', true); sfx.bad(); input.focus(); return; }
    if (S.setup) { toast('The lab is still booting. Scanning opens soon.', true); return; }
    input.value = wallet;
    history.replaceState(null, '', '#/w/' + wallet);
    btn.disabled = true; btn.textContent = 'SCANNING';
    lab.scanning(wallet);
    term.clear(); term.show();
    if (!quiet) $('#lab').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
    const t0 = performance.now();
    const req = API.get('analyze?wallet=' + encodeURIComponent(wallet));
    await term.type(`> wallet ${short(wallet)}`);
    await term.type('> pulling transactions from solana…');
    let r;
    try { r = await req; }
    catch (err) {
      lab.fail(); sfx.bad();
      await term.type('> ' + err.message, 'bad');
      if (err.setup) bootBanner(err.setup);
      btn.disabled = false; btn.textContent = 'SCAN'; term.hide(5000); return;
    }
    const wait = 1800 - (performance.now() - t0); if (wait > 0) await sleep(wait);
    if (r.cached) await term.type(`> using report from ${fmt.ago((r.at || 0) * 1000)} ago`, 'y');
    else await term.type(`> read ${fmt.int(r.scannedTxs || r.swaps)} transactions`);
    if (!r.swaps) {
      lab.scanned(r); sfx.bad();
      await term.type('> found 0 swaps. nothing to learn from.', 'bad');
    } else {
      await term.type(`> ${r.swaps} swaps across ${r.coins} coins in ${r.days}d`);
      await term.type(`> median hold ${fmt.hold(r.medianHoldMin)} · median buy ${fmt.sol(r.medianBuySol)} SOL`);
      lab.scanned(r); sfx.ok();
      await term.type(`> build match: ${r.build.toUpperCase()} ✓`, 'ok');
    }
    current = r;
    renderReport(r);
    btn.disabled = false; btn.textContent = 'SCAN';
    term.hide(6000);
  }

  function existingFor(wallet) { return S.echoes.filter((c) => c.source_wallet === wallet); }

  function renderReport(r) {
    const b = BUILDS[r.build] || BUILDS.Copycat;
    const has = r.swaps > 0;
    const exist = existingFor(r.wallet);
    const suggested = (r.wallet.slice(0, 4) + r.wallet.slice(-4));
    const maxH = Math.max(1, ...r.hours);
    const maxD = Math.max(0.01, ...r.dna.map((d) => d.sol));
    const coin = (x, label, color) => `<a class="coin" href="${coinLink(x.mint)}" target="_blank" rel="noopener">${coinIcon(x.icon, x.symbol)}<div><b>${esc(sym(x.symbol))}</b><div class="mut" style="font-size:11px">${label}</div></div><span class="v ${color}">${x.pnlSol !== undefined ? fmt.sgn(x.pnlSol) + ' SOL' : x.count + ' swaps'}</span></a>`;
    rep.innerHTML = `
      <div class="rcard" style="--c:${b.col}">
        <div class="rtop">
          <div class="av" id="repAv"></div>
          <div style="min-width:0">
            <h3>${esc(short(r.wallet))} is ${has ? `a <em>${esc(r.build)}</em>.` : '<em>not trading.</em>'}</h3>
            <div class="w"><a href="${solscan.acct(r.wallet)}" target="_blank" rel="noopener">${esc(r.wallet)}</a></div>
            <p>${has ? esc(b.line) + ` Its echo ${esc(b.rule)} and bets ${esc(b.size)}, ${esc(b.range)}.` : 'No SOL swaps in its recent history. Echoes learn from swaps, so try a wallet that trades.'}</p>
            ${exist.length ? `<div class="sib">${exist.slice(0, 6).map((c) => `<button data-open="${c.id}"><i data-av="${c.id}"></i>${esc(c.name)} <span class="${cls(c.pnlPct)}">${fmt.pct(c.pnlPct)}</span></button>`).join('')}</div>` : ''}
          </div>
          <div class="act">
            ${has ? `<label class="namebox"><input id="cname" maxlength="16" value="${esc(suggested)}" aria-label="Echo name" spellcheck="false"><span>.echo</span></label>
            <button class="btn pk" id="growBtn">GROW ECHO</button>` : `<button class="btn ghost" id="againBtn">SCAN ANOTHER</button>`}
            <div style="display:flex;gap:8px"><button class="btn ghost sm" style="flex:1" id="shareScan">Share</button><button class="btn ghost sm" style="flex:1" id="copyScan">Copy link</button></div>
          </div>
        </div>
        ${has ? `<div class="rgrid">
          <div><small>swaps</small><b>${fmt.int(r.swaps)}</b><i>${r.buys} buys · ${r.sells} sells</i></div>
          <div><small>win rate</small><b class="${r.winRate >= 0.5 ? 'up' : 'dn'}">${Math.round(r.winRate * 100)}%</b><i>${r.closed} closed trades</i></div>
          <div><small>realized</small><b class="${cls(r.realizedSol)}">${fmt.sgn(r.realizedSol)}</b><i>SOL on closed trades</i></div>
          <div><small>median hold</small><b>${fmt.hold(r.medianHoldMin)}</b><i>${r.open} still open</i></div>
          <div><small>median buy</small><b>${fmt.sol(r.medianBuySol)}</b><i>SOL · max ${fmt.sol(r.biggestBuySol)}</i></div>
          <div><small>pace</small><b>${r.tradesPerDay}</b><i>swaps a day · ${r.days}d window</i></div>
        </div>
        <div class="rbot">
          <div><h4>DNA strand <small>last ${r.dna.length} swaps, oldest → newest</small></h4>
            <div class="dna">${r.dna.map((d, i) => `<i class="${d.s === 's' ? 's' : ''}" style="height:${Math.round(18 + 82 * Math.sqrt(d.sol / maxD))}%;animation-delay:${i * 18}ms" title="${d.s === 'b' ? 'buy' : 'sell'} ${fmt.sol(d.sol)} SOL"></i>`).join('')}</div>
            <div class="legend"><span>buy</span><span class="s">sell</span><span style="margin-left:auto">bar height = SOL size</span></div></div>
          <div><h4>when it trades <small>UTC</small></h4><div class="hours">${r.hours.map((h, i) => `<i style="height:${Math.round((h / maxH) * 100)}%" title="${i}:00 · ${h} swaps"></i>`).join('')}</div><div><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div></div>
          <div><h4>coins</h4><div class="coins">${[...r.best.slice(0, 2).map((x) => coin(x, 'best trade', 'up')), ...r.worst.map((x) => coin(x, 'worst trade', 'dn')), ...(r.favorite ? [coin(r.favorite, 'traded most', '')] : [])].join('') || '<div class="empty">no closed trades yet</div>'}</div></div>
        </div>` : ''}
      </div>`;
    const av = avatar(has ? { ...look({ id: r.wallet, build: r.build }) } : humanLook(r.wallet));
    $('#repAv').append(av);
    $$('[data-av]', rep).forEach((i) => { const c = S.byId.get(i.dataset.av); if (c) i.replaceWith(botAvatar(c)); });
    $$('[data-open]', rep).forEach((b) => (b.onclick = () => profile.open(b.dataset.open)));
    rep.classList.remove('on'); void rep.offsetWidth; rep.classList.add('on');
    const link = location.origin + location.pathname + '#/w/' + r.wallet;
    $('#copyScan').onclick = () => copy(link, 'Scan link copied');
    $('#shareScan').onclick = () => share(has ? `${short(r.wallet)} is a ${r.build}: ${Math.round(r.winRate * 100)}% win rate, ${fmt.hold(r.medianHoldMin)} median hold, ${fmt.sgn(r.realizedSol)} SOL realized.\n\nscanned it on echoes` : `scanned ${short(r.wallet)} on echoes`, link);
    if (has) {
      $('#growBtn').onclick = () => grow(r);
      $('#cname').addEventListener('keydown', (e) => e.key === 'Enter' && grow(r));
      $('#cname').addEventListener('input', (e) => (e.target.value = e.target.value.replace(/[^a-zA-Z0-9_\-]/g, '')));
    } else $('#againBtn').onclick = () => { input.value = ''; input.focus(); lab.idle(); rep.classList.remove('on'); };
  }

  async function grow(r) {
    if (growing || lab.busy()) return;
    if (S.setup) return toast('The lab is still booting.', true);
    const name = ($('#cname')?.value || '').trim() || r.wallet.slice(0, 4) + r.wallet.slice(-4);
    growing = true;
    const gb = $('#growBtn'); gb.disabled = true; gb.textContent = 'GROWING…';
    lab.growing(name, r.build, r.wallet);
    $('#lab').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
    term.clear(); term.show();
    const t0 = performance.now();
    const req = API.post('echo', { wallet: r.wallet, name });
    await term.type(`> growing ${name}.echo`);
    await term.type(`> body: ${r.build.toUpperCase()} · bag: 1 paper SOL`);
    await term.type(`> hooking ${short(r.wallet)} to the chain…`);
    let res;
    try { res = await req; }
    catch (err) {
      lab.fail(); sfx.bad(); growing = false;
      await term.type('> ' + err.message, 'bad');
      toast(err.message, true);
      gb.disabled = false; gb.textContent = 'GROW ECHO'; term.hide(5000); return;
    }
    lab.grown();
    const wait = 3200 - (performance.now() - t0); if (wait > 0) await sleep(wait);
    const c = res.echo;
    lab.born(c); sfx.born(); fx.confetti(180); shake($('.stage'));
    await term.type(`> ${c.name} is ALIVE ✓`, 'ok');
    await term.type('> it copies the next trade this wallet makes', 'ok');
    term.hide(7000);
    S.addEcho(c);
    growing = false;
    const act = $('.rtop .act');
    act.innerHTML = `<div style="font:700 18px var(--pix);color:var(--mt)">${esc(c.name)} is alive.</div>
      <button class="btn mt" id="viewNew">VIEW ECHO</button>
      <div style="display:flex;gap:8px"><button class="btn ghost sm" style="flex:1" id="shareNew">Share</button><button class="btn ghost sm" style="flex:1" id="floorNew">Find on floor</button></div>`;
    $('#viewNew').onclick = () => profile.open(c.id);
    $('#shareNew').onclick = () => share(`just echoed ${short(c.source_wallet)}. ${c.name} is a ${c.build} with 1 paper SOL and it copies every trade that wallet makes.\n\nwatch it on echoes`, location.origin + location.pathname + '#/c/' + c.id);
    $('#floorNew').onclick = () => { $('#floor-s').scrollIntoView({ behavior: 'smooth' }); floor.spotlight(c.id); };
  }

  return { scan, get current() { return current; } };
})();

function share(text, url) {
  const a = document.createElement('a');
  a.href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  a.target = '_blank'; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
}
