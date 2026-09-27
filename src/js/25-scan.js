/* ================= scan + grow flow (the console) ================= */
const B58RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scanFlow = (() => {
  const form = $('#scanForm'), input = $('#wallet'), btn = $('#scanBtn'), rep = $('#report'), con = $('#console');
  let current = null, growing = false;

  input.addEventListener('paste', () => setTimeout(() => { const v = input.value.trim(); if (B58RE.test(v)) form.requestSubmit(); }, 30));
  form.addEventListener('submit', (e) => { e.preventDefault(); scan(input.value.trim()); });

  function toTop() { if (innerWidth <= 980) $('#stage').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); else if (scrollY > 200) scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); }
  function back() { rep.classList.remove('on'); rep.innerHTML = ''; con.classList.remove('rep'); current = null; hero.idle(); input.value = ''; if (location.hash.startsWith('#/w/')) history.replaceState(null, '', location.pathname + location.search); }

  async function scan(wallet, { quiet } = {}) {
    if (hero.busy()) return;
    if (!B58RE.test(wallet)) { toast('That does not look like a Solana wallet', true); sfx.bad(); input.focus(); return; }
    if (S.setup) { toast('The lab is still booting. Scanning opens soon.', true); return; }
    input.value = wallet;
    history.replaceState(null, '', '#/w/' + wallet);
    btn.disabled = true; btn.textContent = 'Scanning';
    rep.classList.remove('on'); con.classList.remove('rep');
    hero.scanning(wallet);
    term.clear(); term.show();
    if (!quiet) toTop();
    const t0 = performance.now();
    const req = API.get('analyze?wallet=' + encodeURIComponent(wallet));
    await term.type(`> wallet ${short(wallet)} on the pad`);
    await term.type('> reading its transactions from solana…');
    let r;
    try { r = await req; }
    catch (err) {
      hero.fail(); sfx.bad();
      await term.type('> ' + err.message, 'bad');
      if (err.setup) bootBanner(err.setup);
      btn.disabled = false; btn.textContent = 'Scan'; term.hide(5000); setTimeout(() => hero.idle(), 1500); return;
    }
    const wait = 2000 - (performance.now() - t0); if (wait > 0) await sleep(wait);
    if (r.cached) await term.type(`> using the report from ${fmt.ago((r.at || 0) * 1000)} ago`, 'y');
    else await term.type(`> read ${fmt.int(r.scannedTxs || r.swaps)} transactions`);
    if (!r.swaps) {
      hero.scanned(r); sfx.bad();
      await term.type('> 0 swaps. nothing to learn from.', 'bad');
    } else {
      await term.type(`> ${r.swaps} swaps · ${r.coins} coins · ${r.days}d`);
      hero.scanned(r); sfx.ok();
      await term.type(`> build: ${r.build.toUpperCase()} ✓`, 'ok');
    }
    current = r;
    await sleep(350);
    term.hide(0);
    renderReport(r);
    btn.disabled = false; btn.textContent = 'Scan';
  }

  const existingFor = (wallet) => S.echoes.filter((c) => c.source_wallet === wallet);

  function renderReport(r) {
    const b = BUILDS[r.build] || BUILDS.Copycat;
    const has = r.swaps > 0;
    const exist = existingFor(r.wallet);
    const suggested = r.wallet.slice(0, 4) + r.wallet.slice(-4);
    const maxH = Math.max(1, ...(r.hours || [0]));
    const maxD = Math.max(0.01, ...(r.dna || []).map((d) => d.sol));
    const coin = (x, label, color) => `<a class="coin" href="${coinLink(x.mint)}" target="_blank" rel="noopener">${coinIcon(x.icon, x.symbol)}<div><b>${esc(sym(x.symbol))}</b><div class="mut" style="font:500 11px var(--mono)">${label}</div></div><span class="v ${color}">${x.pnlSol !== undefined ? fmt.sgn(x.pnlSol) + ' SOL' : x.count + ' swaps'}</span></a>`;
    const coins = has ? [...(r.best || []).slice(0, 1).map((x) => coin(x, 'best trade', 'up')), ...(r.worst || []).slice(0, 1).map((x) => coin(x, 'worst trade', 'dn')), ...(r.favorite ? [coin(r.favorite, 'traded most', '')] : [])].join('') : '';
    rep.innerHTML = `
      <div class="rcard" style="--c:${b.col}">
        <div class="rtop">
          <div class="av" id="repAv"></div>
          <div style="min-width:0">
            <h3>${esc(short(r.wallet))} is ${has ? `a <em>${esc(r.build)}</em>.` : '<em>not trading.</em>'}</h3>
            <div class="w"><a href="${solscan.acct(r.wallet)}" target="_blank" rel="noopener">${esc(r.wallet)} ↗</a></div>
          </div>
        </div>
        <p class="rline">${has ? `${esc(b.line)} Its echo ${esc(b.rule)} and bets ${esc(b.size)}, ${esc(b.range)}.` : 'No SOL swaps in its recent history. Echoes learn from swaps, so try a wallet that trades.'}</p>
        ${has ? `<div class="rgrid">
          <div><small>win rate</small><b class="${r.winRate >= 0.5 ? 'up' : 'dn'}">${Math.round(r.winRate * 100)}%</b><i>${r.closed} closed</i></div>
          <div><small>realized</small><b class="${cls(r.realizedSol)}">${fmt.sgn(r.realizedSol)}</b><i>SOL</i></div>
          <div><small>median hold</small><b>${fmt.hold(r.medianHoldMin)}</b><i>${r.open} still open</i></div>
          <div><small>swaps</small><b>${fmt.int(r.swaps)}</b><i>${r.buys} buys · ${r.sells} sells</i></div>
          <div><small>median buy</small><b>${fmt.sol(r.medianBuySol)}</b><i>SOL · max ${fmt.sol(r.biggestBuySol)}</i></div>
          <div><small>pace</small><b>${r.tradesPerDay}</b><i>swaps a day</i></div>
        </div>
        <div class="rsec"><h4>its last ${r.dna.length} swaps <small><span class="up">buy</span> · <span style="color:var(--pk)">sell</span></small></h4>
          <div class="dna">${r.dna.map((d, i) => `<i class="${d.s === 's' ? 's' : ''}" style="height:${Math.round(16 + 84 * Math.sqrt(d.sol / maxD))}%;animation-delay:${i * 14}ms" title="${d.s === 'b' ? 'buy' : 'sell'} ${fmt.sol(d.sol)} SOL"></i>`).join('')}</div></div>
        <div class="rsec"><h4>when it trades <small>UTC 0h → 24h</small></h4><div class="hours">${r.hours.map((h, i) => `<i style="height:${Math.round((h / maxH) * 100)}%" title="${i}:00 · ${h} swaps"></i>`).join('')}</div></div>
        ${coins ? `<div class="rsec"><div class="coins">${coins}</div></div>` : ''}
        ${exist.length ? `<div class="rsec"><h4>already echoed <small>${exist.length}</small></h4><div class="sib">${exist.slice(0, 6).map((c) => `<button data-open="${c.id}"><i data-av="${c.id}"></i>${esc(c.name)} <span class="${cls(c.pnlPct)}">${fmt.pct(c.pnlPct)}</span></button>`).join('')}</div></div>` : ''}
        <div class="grow" id="growRow"><label class="namebox"><input id="cname" maxlength="16" value="${esc(suggested)}" aria-label="Echo name" spellcheck="false"><span>.echo</span></label><button class="btn pk" id="growBtn">Grow echo</button></div>` : `<div class="grow"><button class="btn ghost" id="againBtn" style="flex:1">Scan another wallet</button></div>`}
        <div class="rfoot"><button class="btn ghost sm" id="shareScan">Share</button><button class="btn ghost sm" id="copyScan">Copy link</button></div>
      </div>
      <button class="rback" id="rBack">← back to the chamber</button>`;
    const av = avatar(has ? look({ id: r.wallet, build: r.build }) : humanLook(r.wallet), '', 'm');
    $('#repAv').append(av);
    $$('[data-av]', rep).forEach((i) => { const c = S.byId.get(i.dataset.av); if (c) i.replaceWith(botAvatar(c)); });
    $$('[data-open]', rep).forEach((b2) => (b2.onclick = () => profile.open(b2.dataset.open)));
    rep.classList.remove('on'); void rep.offsetWidth; rep.classList.add('on'); con.classList.add('rep'); con.scrollTop = 0;
    const link = location.origin + location.pathname + '#/w/' + r.wallet;
    $('#copyScan').onclick = () => copy(link, 'Scan link copied');
    $('#shareScan').onclick = () => share(has ? `${short(r.wallet)} is a ${r.build}: ${Math.round(r.winRate * 100)}% win rate, ${fmt.hold(r.medianHoldMin)} median hold, ${fmt.sgn(r.realizedSol)} SOL realized.\n\nscanned it on echoes` : `scanned ${short(r.wallet)} on echoes`, link);
    $('#rBack').onclick = back;
    if (has) {
      $('#growBtn').onclick = () => grow(r);
      $('#cname').addEventListener('keydown', (e) => e.key === 'Enter' && grow(r));
      $('#cname').addEventListener('input', (e) => (e.target.value = e.target.value.replace(/[^a-zA-Z0-9_\-]/g, '')));
    } else $('#againBtn').onclick = () => { back(); input.focus(); };
  }

  async function grow(r) {
    if (growing || hero.busy()) return;
    if (S.setup) return toast('The lab is still booting.', true);
    const name = ($('#cname')?.value || '').trim() || r.wallet.slice(0, 4) + r.wallet.slice(-4);
    growing = true;
    const gb = $('#growBtn'); gb.disabled = true; gb.textContent = 'Growing…';
    hero.growing(name, r.build, r.wallet);
    toTop();
    const t0 = performance.now();
    const req = API.post('echo', { wallet: r.wallet, name });
    let res;
    try { res = await req; }
    catch (err) {
      hero.fail(); sfx.bad(); growing = false;
      toast(err.message, true);
      gb.disabled = false; gb.textContent = 'Grow echo'; setTimeout(() => hero.scanned(r), 1500); return;
    }
    hero.grown();
    const wait = 3400 - (performance.now() - t0); if (wait > 0) await sleep(wait);
    const c = res.echo;
    hero.born(c); sfx.born(); fx.confetti(160);
    S.addEcho(c);
    growing = false;
    $('#growRow').outerHTML = `<div class="grow" style="flex-direction:column;align-items:stretch"><div class="alive-now">${esc(c.name)} is alive.</div><div class="mut" style="font:500 13px var(--mono);margin:4px 0 10px">It copies the next trade ${esc(short(c.source_wallet))} makes, with 1 paper SOL.</div><div style="display:flex;gap:8px"><button class="btn" id="viewNew" style="flex:1">Open it</button><button class="btn ghost" id="shareNew" style="flex:1">Share</button></div></div>`;
    $('#viewNew').onclick = () => profile.open(c.id);
    $('#shareNew').onclick = () => share(`just echoed ${short(c.source_wallet)}. ${c.name} is a ${c.build} with 1 paper SOL and it copies every trade that wallet makes.\n\nwatch it on echoes`, location.origin + location.pathname + '#/c/' + c.id);
  }

  return { scan, back, get current() { return current; } };
})();

function share(text, url) {
  const a = document.createElement('a');
  a.href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  a.target = '_blank'; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
}
