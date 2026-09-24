/* ================= core ================= */
const C = window.ECHO_CFG || {};
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const R = Math.random, pick = (a) => a[(R() * a.length) | 0], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = (w) => (w ? w.slice(0, 4) + '…' + w.slice(-4) : '');
const sym = (s) => '$' + String(s || '?').replace(/^\$/, '');
function hash(s) { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
function rnd(s) { let t = hash(s); return () => ((t = Math.imul(t ^ (t >>> 15), t | 1) + 0x6d2b79f5 | 0) >>> 0) / 4294967296; }

const fmt = {
  sol(n, d) { n = Number(n) || 0; const a = Math.abs(n); d ??= a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3; return n.toFixed(d); },
  pct(n, d = 1) { n = Number(n) || 0; return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(Math.abs(n) >= 100 ? 0 : d) + '%'; },
  sgn(n, d) { n = Number(n) || 0; return (n > 0 ? '+' : n < 0 ? '−' : '') + fmt.sol(Math.abs(n), d); },
  int(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); },
  usd(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e4) return '$' + (n / 1e3).toFixed(1) + 'K';
    if (n >= 1) return '$' + n.toFixed(2);
    if (n > 0) { const z = Math.max(0, -Math.floor(Math.log10(n)) - 1); return z >= 4 ? '$0.0' + String(z).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[d]).join('') + Math.round(n * 10 ** (z + 3)) : '$' + n.toPrecision(3); }
    return '$0';
  },
  ago(t) {
    const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
    if (s < 5) return 'now'; if (s < 60) return Math.floor(s) + 's'; if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd';
  },
  hold(min) { min = Number(min) || 0; if (!min) return '—'; if (min < 60) return min + 'm'; if (min < 1440) return (min / 60).toFixed(min < 600 ? 1 : 0) + 'h'; return (min / 1440).toFixed(1) + 'd'; },
};
const cls = (n) => (n > 0 ? 'up' : n < 0 ? 'dn' : 'mut');
const solscan = { tx: (s) => `https://solscan.io/tx/${s}`, acct: (w) => `https://solscan.io/account/${w}` };
const coinLink = (m) => `https://dexscreener.com/solana/${m}`;
function coinIcon(icon, symbol, cls = '') {
  const letter = (String(symbol || '?').replace(/^\$/, '').slice(0, 1).toUpperCase().match(/[A-Z0-9]/) || ['?'])[0];
  return icon ? `<img class="${cls}" src="${esc(icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ci ${cls}',textContent:'${letter}'}))">`
    : `<span class="ci ${cls}">${letter}</span>`;
}

/* ---------- API (the preview build swaps this for a sample-data simulator) ---------- */
const API = window.ECHO_API || {
  async req(path, opt = {}) {
    let r;
    try { r = await fetch('/api/' + path, { headers: { accept: 'application/json', ...(opt.body ? { 'content-type': 'application/json' } : {}) }, ...opt }); }
    catch { throw Object.assign(new Error('Network hiccup. Try again.'), { status: 0 }); }
    const j = await r.json().catch(() => ({ error: 'The lab sent back something weird. Try again.' }));
    if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong'), { status: r.status, setup: j.setup });
    return j;
  },
  get(path) { return this.req(path); },
  post(path, body) { return this.req(path, { method: 'POST', body: JSON.stringify(body) }); },
};

/* ---------- toast ---------- */
function toast(m, bad) { const t = $('#toast'); t.textContent = m; t.classList.toggle('bad', !!bad); t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2400); }

/* ---------- links + CA ---------- */
const BUY = C.BUY || (C.CA ? (C.PAD === 'stonkfun' ? `https://stonkfun.xyz/token/${C.CA}` : `https://pump.fun/coin/${C.CA}`) : '#');
const CHART = C.CHART || (C.CA ? `https://gmgn.ai/sol/token/${C.CA}` : '#');
$$('.js-buy').forEach((a) => (a.href = BUY)); $$('.js-chart').forEach((a) => (a.href = CHART)); $$('.js-x').forEach((a) => (a.href = C.X || '#'));
$$('.js-buy,.js-chart,.js-x').forEach((a) => a.addEventListener('click', (e) => { if (a.getAttribute('href') === '#') { e.preventDefault(); toast(a.classList.contains('js-x') ? 'X drops at launch' : 'CA drops at launch'); } }));
const PADS = { pumpfun: 'pump.fun', stonkfun: 'StonkFun' };
if ($('#padLine')) $('#padLine').textContent = `on Solana · ${PADS[C.PAD] || 'pump.fun'}${C.PAD === 'stonkfun' && C.PAIR ? ' · paired ' + C.PAIR : ''}`;
$$('.js-ca-t').forEach((s) => (s.textContent = C.CA || 'CA drops at launch'));
function copy(text, label) {
  const ok = () => { toast(label || 'Copied'); sfx.blip(); };
  try { navigator.clipboard.writeText(text).then(ok, () => toast(text)); } catch { toast(text); }
}
$$('.js-ca').forEach((el) => (el.onclick = () => (C.CA ? copy(C.CA, 'CA copied') : toast('CA drops at launch'))));

/* ---------- sound (tiny chiptune synth, off by default) ---------- */
const sfx = (() => {
  let ac = null, on = false;
  try { on = localStorage.getItem('echoes.snd') === '1'; } catch {}
  const btn = $('#snd');
  const paint = () => { btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on); $('#sndw').setAttribute('opacity', on ? '1' : '.25'); };
  paint();
  function tone(f, d = 0.08, type = 'square', vol = 0.05, when = 0, slide = 0) {
    if (!on) return;
    try {
      ac ||= new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
    } catch {}
  }
  const seq = (notes, step = 0.07, type, vol) => notes.forEach((f, i) => f && tone(f, step * 0.95, type, vol, i * step));
  btn.onclick = () => { on = !on; try { localStorage.setItem('echoes.snd', on ? '1' : '0'); } catch {} paint(); if (on) seq([523, 659, 784, 1047], 0.06); };
  return {
    get on() { return on; },
    blip: () => tone(880, 0.05, 'square', 0.035),
    scan: () => tone(220 + R() * 60, 0.05, 'sawtooth', 0.02, 0, 300),
    ok: () => seq([659, 784, 988, 1319], 0.07),
    bad: () => seq([330, 247, 196], 0.1, 'sawtooth', 0.04),
    buy: () => seq([523, 784], 0.06, 'square', 0.03),
    sell: () => seq([784, 523], 0.06, 'triangle', 0.05),
    skip: () => tone(196, 0.06, 'triangle', 0.03),
    zap: () => tone(80 + R() * 200, 0.07, 'sawtooth', 0.03, 0, 900),
    born: () => seq([392, 523, 659, 784, 0, 659, 784, 1047, 1319], 0.08, 'square', 0.045),
    coin: () => seq([988, 1319], 0.07, 'square', 0.035),
    party: () => seq([523, 659, 784, 659, 523, 659, 784, 1047, 784, 1047, 1319], 0.09, 'square', 0.04),
  };
})();

/* ---------- screen fx: pixel confetti + click bursts ---------- */
const fx = (() => {
  const cv = $('#fx'), ctx = cv.getContext('2d');
  let parts = [], dpr = 1;
  const COLORS = ['#34e0ff', '#ff5fa2', '#ffd23f', '#5cf2a8', '#8b6cff', '#ff8a3d', '#ffffff'];
  function size() { dpr = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  size(); addEventListener('resize', size);
  function burst(x, y, n = 14, spread = 5, colors = COLORS, sz = 5) {
    if (RM) return;
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, v = (0.4 + R()) * spread;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spread * 0.4, g: 0.18, l: 40 + R() * 40, s: sz * (0.6 + R() * 0.8), c: pick(colors), r: 0 });
    }
  }
  function confetti(n = 160) {
    if (RM) return;
    for (let i = 0; i < n; i++) parts.push({ x: R() * innerWidth, y: -20 - R() * innerHeight * 0.5, vx: (R() - 0.5) * 2, vy: 2 + R() * 3, g: 0.04, l: 260, s: 6 + R() * 6, c: pick(COLORS), r: R() * 6, spin: (R() - 0.5) * 0.3 });
  }
  function tick() {
    if (parts.length) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.99; p.l--; if (p.spin) p.r += p.spin;
        if (p.l <= 0 || p.y > innerHeight + 30) { parts.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, p.l / 30);
        ctx.fillStyle = p.c;
        const s = p.s * dpr;
        if (p.spin) { ctx.save(); ctx.translate(p.x * dpr, p.y * dpr); ctx.rotate(p.r); ctx.fillRect(-s / 2, -s / 4, s, s / 2); ctx.restore(); }
        else ctx.fillRect(Math.round(p.x * dpr), Math.round(p.y * dpr), s, s);
      }
      ctx.globalAlpha = 1;
      if (!parts.length) ctx.clearRect(0, 0, cv.width, cv.height);
    }
    requestAnimationFrame(tick);
  }
  tick();
  addEventListener('pointerdown', (e) => { if (e.target.closest('button,a,input,canvas#labcv,canvas#floor')) burst(e.clientX, e.clientY, 8, 3.2, undefined, 4); });
  return { burst, confetti };
})();
function shake(el = document.body) { if (RM) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
