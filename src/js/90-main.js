/* ================= state, polling, loop ================= */
const S = {
  stats: null, echoes: [], byId: new Map(), setup: null,
  setEchoes(list) {
    this.echoes = list; this.byId = new Map(list.map((c) => [c.id, c]));
    floor.sync(list); board.render(list); renderBuilds(list);
    lab.showcase([...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  },
  addEcho(c) {
    const full = { value: 1, pnlPct: 0, trades: 0, wins: 0, losses: 0, realized: 0, cash: 1, positions: [], ...c };
    if (this.byId.has(full.id)) return;
    this.echoes = [full, ...this.echoes]; this.byId.set(full.id, full);
    floor.enter(full); floor.sync(this.echoes); board.render(this.echoes); renderBuilds(this.echoes);
    if (this.stats) { this.stats.echoes++; counters.set(this.stats); }
  },
};

function onErr(e) { if (e && e.status === 503 && e.setup) bootBanner(e.setup); }

async function pollStats() {
  try {
    const s = await API.get('stats');
    const firstTime = !S.stats; S.stats = s;
    counters.set(s); renderOriginals(s);
    if (firstTime || document.activeElement?.closest?.('#hints') == null) renderHints(s);
    bootBanner(s.ready && !s.ready.helius ? ['HELIUS_API_KEY'] : null);
    ticker.paint();
  } catch (e) { onErr(e); if (!S.stats) { renderHints(null); renderOriginals(null); } }
}
async function pollEchoes() {
  try { S.setEchoes(await API.get('echoes')); } catch (e) { onErr(e); if (!S.echoes.length) { floor.sync([]); board.render([]); renderBuilds([]); } }
}
async function pollFeed() {
  try { const rows = await API.get('feed'); const first = !feed.items.length; feed.ingest(rows); if (first) ticker.seed(rows); } catch (e) { onErr(e); if (!feed.items.length) feed.paint(); }
}

function route() {
  const h = location.hash;
  let m = h.match(/^#\/c\/([0-9a-f-]{36})$/i);
  if (m) return profile.open(m[1]);
  if (profile.openId) profile.close();
  m = h.match(/^#\/w\/([1-9A-HJ-NP-Za-km-z]{32,44})$/);
  if (m && scanFlow.current?.wallet !== m[1]) scanFlow.scan(m[1], { quiet: true });
}
addEventListener('popstate', route);
addEventListener('hashchange', route);

(async function boot() {
  renderBuilds([]);
  await Promise.allSettled([pollStats(), pollEchoes(), pollFeed()]);
  route();
  const every = (fn, ms) => setInterval(() => !document.hidden && fn(), ms);
  every(pollFeed, 5000); every(pollEchoes, 12000); every(pollStats, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { pollFeed(); pollEchoes(); } });
})();

/* ---------- main loop ---------- */
let T = 0, last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  lab.update(dt); lab.render(T);
  floor.tick(dt);
  tickAvatars(T, dt);
  profile.tick(T);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- party mode (konami code, or tap the logo 5 times) ---------- */
(() => {
  const K = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let i = 0, taps = 0, tapT = 0, off = 0;
  function party() {
    document.body.classList.add('party'); fx.confetti(240); sfx.party(); toast('PARTY MODE');
    clearTimeout(off); off = setTimeout(() => document.body.classList.remove('party'), 15000);
  }
  addEventListener('keydown', (e) => { if (e.target.closest?.('input')) return; i = e.key === K[i] || e.key.toLowerCase() === K[i] ? i + 1 : e.key === K[0] ? 1 : 0; if (i === K.length) { i = 0; party(); } });
  $$('.logo').forEach((l) => l.addEventListener('click', () => { clearTimeout(tapT); tapT = setTimeout(() => (taps = 0), 1200); if (++taps >= 5) { taps = 0; party(); } poke(l.querySelector('canvas')); }));
})();
