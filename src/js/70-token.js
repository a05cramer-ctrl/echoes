/* ================= $ECHO + ticker ================= */
const token = (() => {
  let data = null;
  async function load() {
    if (!C.CA) { $$('#tokr [data-t]').forEach((b) => (b.textContent = 'at launch')); $('#barPrice').textContent = 'soon'; return; }
    try {
      const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${C.CA}`);
      const pairs = await r.json();
      const p = (Array.isArray(pairs) ? pairs : []).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      if (!p) return;
      data = {
        price: Number(p.priceUsd || 0), mcap: p.marketCap || p.fdv || 0, liq: p.liquidity?.usd || 0, vol: p.volume?.h24 || 0,
        buys: p.txns?.h24?.buys || 0, sells: p.txns?.h24?.sells || 0, chg: p.priceChange || {}, icon: p.info?.imageUrl,
      };
      paint();
    } catch {}
  }
  function paint() {
    if (!data) return;
    const set = (k, v) => { const el = $(`#tokr [data-t="${k}"]`); if (el) el.textContent = v; };
    set('price', fmt.usd(data.price)); set('mcap', fmt.usd(data.mcap)); set('liq', fmt.usd(data.liq)); set('vol', fmt.usd(data.vol));
    set('buys', fmt.int(data.buys)); set('sells', fmt.int(data.sells));
    $('#chg').innerHTML = ['m5', 'h1', 'h6', 'h24'].filter((k) => data.chg[k] != null).map((k) => `<span class="${cls(data.chg[k])}">${k} ${fmt.pct(data.chg[k])}</span>`).join('');
    $('#barPrice').textContent = fmt.usd(data.mcap) + ' mc';
    ticker.paint();
  }
  load(); setInterval(() => !document.hidden && load(), 20000);
  return { get data() { return data; } };
})();

const ticker = (() => {
  const lane = $('#lane'); let recent = [], last = 0, pend = 0;
  function items() {
    const out = [];
    const t = token.data;
    if (t) out.push(`<span class="it"><i class="dot"></i><b>$ECHO</b>${fmt.usd(t.price)} <i class="${cls(t.chg.h24)}">${fmt.pct(t.chg.h24 || 0)}</i> · mc ${fmt.usd(t.mcap)}</span>`);
    if (S.stats) {
      if (S.stats.solUsd) out.push(`<span class="it"><b>SOL</b>$${Number(S.stats.solUsd).toFixed(2)}</span>`);
      out.push(`<span class="it"><b>${fmt.int(S.stats.echoes)}</b>echoes alive</span>`);
      out.push(`<span class="it"><b>${fmt.int(S.stats.echoTrades)}</b>trades copied</span>`);
      out.push(`<span class="it"><b>${fmt.int(S.stats.originals)}</b>wallets watched</span>`);
    }
    for (const e of recent.slice(0, 10)) out.push(`<span class="it"><b>${esc(e.echo)}</b><i class="${e.side === 'buy' ? 'up' : 'side-s'}">${e.side === 'buy' ? 'bought' : 'sold'}</i> ${esc(sym(e.symbol))} ${fmt.sol(e.sol)} SOL${e.side === 'sell' && e.pnl != null ? ` <i class="${cls(e.pnl)}">${fmt.sgn(e.pnl)}</i>` : ''}</span>`);
    const best = [...S.echoes].sort((a, b) => b.pnlPct - a.pnlPct)[0];
    if (best && S.echoes.length > 1) out.push(`<span class="it"><b>#1</b>${esc(best.name)} <i class="${cls(best.pnlPct)}">${fmt.pct(best.pnlPct)}</i></span>`);
    if (!out.length) out.push(`<span class="it"><b>echoes</b>echo any wallet · real trades · paper SOL</span>`);
    return out.join('');
  }
  function paint(force) {
    const now = Date.now();
    if (!force && now - last < 15000 && lane.children.length > 8) { clearTimeout(pend); pend = setTimeout(() => paint(true), 15000 - (now - last)); return; }
    last = now;
    const html = items();
    lane.innerHTML = html + html + html + html;
    lane.style.animationDuration = Math.max(30, lane.scrollWidth / 4 / 50) + 's';
  }
  return {
    paint,
    seed(rows) { recent = rows.filter((r) => r.side !== 'skip').slice(0, 10); paint(); },
    push(ev) { recent.unshift(ev); recent = recent.slice(0, 10); paint(); },
  };
})();
