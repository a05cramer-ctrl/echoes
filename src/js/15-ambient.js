/* ================= ambient: cursor glow, headline echo, scrollspy, loader ================= */
(() => {
  // cursor glow on cards
  const glowSel = '.panel,.og,.tok';
  function wire(el) {
    if (el._glow) return; el._glow = 1; el.classList.add('glow');
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', e.clientX - r.left + 'px'); el.style.setProperty('--my', e.clientY - r.top + 'px'); });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--mx', '-999px'); el.style.setProperty('--my', '-999px'); });
  }
  const scanGlow = () => $$(glowSel).forEach(wire);
  scanGlow();
  let pend = 0; new MutationObserver(() => { if (!pend) pend = setTimeout(() => { pend = 0; scanGlow(); }, 500); }).observe(document.body, { childList: true, subtree: true });

  // the headline (and every echo word) pings when you click it, and on its own now and then
  function ping(el, loud) {
    el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping');
    if (loud) { sfx.echo(); const r = el.getBoundingClientRect(); fx.burst(r.left + r.width / 2, r.top + r.height / 2, 22, 5, ['#ff4fa3', '#2ee6ff', '#5cf2a8']); }
  }
  $$('h1 .e,.sh em,.bigword,.tokt h2').forEach((el) => { el.style.cursor = 'pointer'; el.addEventListener('click', () => ping(el, true)); });
  if (!RM) setInterval(() => { const h = $('h1 .e'); if (h && !document.hidden && scrollY < innerHeight) ping(h); }, 6500);
  const seen = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { setTimeout(() => ping(e.target), 250); seen.unobserve(e.target); } }), { threshold: 0.6 });
  $$('.sh em,.bigword,.tokt h2').forEach((el) => seen.observe(el));

  // scrollspy
  const links = $$('.nav a'), map = new Map(links.map((a) => [a.getAttribute('href') === '#top' ? 'chamber' : a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((a) => a.classList.remove('on'));
    map.get(e.target.id)?.classList.add('on');
  }), { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });

  // loader goes as soon as the chamber has drawn (or after a beat)
  const done = () => document.body.classList.add('ready');
  setTimeout(done, 1400);
  addEventListener('load', () => setTimeout(done, 350));
})();
