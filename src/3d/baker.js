// Bakes voxel characters into tiny pixel-art canvases (avatars, turntables, podium, parade)
// using the chamber's renderer, so every face on the page is the same 3D robot you see on the floor.
import * as THREE from 'three';
import { makeRobot, makeHuman } from './vox.js';

export function createBaker(renderer) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#c3caff', '#3a2050', 1.5));
  const key = new THREE.DirectionalLight('#fff4ea', 2.3); key.position.set(40, 60, 80); scene.add(key);
  const rimP = new THREE.DirectionalLight('#ff4fa3', 1.6); rimP.position.set(-80, 30, -40); scene.add(rimP);
  const rimC = new THREE.DirectionalLight('#2ee6ff', 1.6); rimC.position.set(80, 30, -40); scene.add(rimC);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  const holder = new THREE.Group(); scene.add(holder);
  const rts = new Map();
  const rt = (w, h) => {
    const k = w + 'x' + h; if (rts.has(k)) return rts.get(k);
    const t = new THREE.WebGLRenderTarget(w, h); t.texture.colorSpace = THREE.SRGBColorSpace; t.texture.minFilter = t.texture.magFilter = THREE.NearestFilter;
    rts.set(k, t); return t;
  };
  const cache = new Map(), models = new Map();
  const OUT = [7, 6, 26];

  function model(lk) {
    const k = JSON.stringify(lk); if (models.has(k)) return models.get(k);
    const m = lk.human ? makeHuman(lk) : makeRobot(lk); models.set(k, m); if (models.size > 200) models.clear(); return m;
  }

  // render one frame to a canvas (w×h pixels, ppu pixels per voxel)
  function frame(lk, { w, h, ppu, rot = -0.5, tilt = 0.18, blink = false, happy = false, outline = true, lift = 0 }) {
    const m = model(lk); holder.clear(); holder.add(m);
    m.rotation.set(0, rot, 0); m.position.set(0, lift, 0);
    const ud = m.userData;
    if (ud.eyes) ud.eyes.scale.y = blink ? 0.15 : 1;
    if (ud.visor) ud.visor.position.x = 0;
    if (ud.body) ud.body.position.y = happy ? 1 : 0;
    const fw = w / ppu, fh = h / ppu, cy = (ud.height || 22) / 2 + 0.2;
    cam.left = -fw / 2; cam.right = fw / 2; cam.top = fh / 2; cam.bottom = -fh / 2;
    cam.position.set(0, cy + Math.sin(tilt) * 200, Math.cos(tilt) * 200); cam.lookAt(0, cy, 0);
    cam.updateProjectionMatrix();
    const t = rt(w, h);
    const prevT = renderer.getRenderTarget(), prevC = new THREE.Color(), prevA = renderer.getClearAlpha();
    renderer.getClearColor(prevC);
    renderer.setRenderTarget(t); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
    const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(t, 0, 0, w, h, px);
    renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA);
    // flip + outline on the CPU (tiny images)
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'), img = x.createImageData(w, h), d = img.data;
    for (let r = 0; r < h; r++) d.set(px.subarray((h - 1 - r) * w * 4, (h - r) * w * 4), r * w * 4);
    if (outline) {
      const a = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : d[(j * w + i) * 4 + 3]);
      const mark = [];
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (a(i, j) < 40 && (a(i - 1, j) > 120 || a(i + 1, j) > 120 || a(i, j - 1) > 120 || a(i, j + 1) > 120)) mark.push(j * w + i);
      for (const p of mark) { d[p * 4] = OUT[0]; d[p * 4 + 1] = OUT[1]; d[p * 4 + 2] = OUT[2]; d[p * 4 + 3] = 255; }
    }
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 100 ? 255 : 0; // hard pixel edges
    x.putImageData(img, 0, 0);
    return c;
  }

  const SIZES = { s: { w: 30, h: 32, ppu: 1 }, m: { w: 44, h: 46, ppu: 1.5 }, l: { w: 64, h: 66, ppu: 2.2 } };
  // tight crop boxes so avatars are all robot and no air
  function bbox(c) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }
  const union = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
  function crop(c, b) { const o = document.createElement('canvas'); o.width = b.x1 - b.x0 + 1; o.height = b.y1 - b.y0 + 1; o.getContext('2d').drawImage(c, -b.x0, -b.y0); return o; }
  const pad = (b, p = 1) => ({ x0: Math.max(0, b.x0 - p), y0: Math.max(0, b.y0 - p - 1), x1: b.x1 + p, y1: b.y1 + p });
  const REFS = [0, 1, 2, 3, 4, 5].map((h) => ({ h, c: 0, k: '#ffffff', bd: 0 })).concat([{ human: true, hood: 0, skin: '#e0ac7e' }]);
  for (const [k, sz] of Object.entries(SIZES)) {
    let u = null; for (const r of REFS) { try { u = union(u, bbox(frame(r, sz))); } catch {} }
    sz.box = u ? pad(u) : null;
  }
  const fit = (c, sz) => (sz.box ? crop(c, sz.box) : c);
  return {
    // cached still (and blink / happy frames) for avatars
    portrait(lk, size = 's', opts = {}) {
      const k = 'p|' + size + '|' + JSON.stringify(lk) + '|' + (opts.blink ? 1 : 0) + (opts.happy ? 1 : 0) + (opts.rot ?? '');
      if (cache.has(k)) return cache.get(k);
      const c = fit(frame(lk, { ...SIZES[size], ...opts }), SIZES[size]); cache.set(k, c); return c;
    },
    turntable(lk, n = 16, size = 'm') {
      const k = 't|' + size + '|' + n + '|' + JSON.stringify(lk);
      if (cache.has(k)) return cache.get(k);
      const raw = []; for (let i = 0; i < n; i++) raw.push(frame(lk, { ...SIZES[size], rot: -0.5 + (i / n) * Math.PI * 2 }));
      let u = null; for (const f of raw) u = union(u, bbox(f));
      const out = u ? raw.map((f) => crop(f, pad(u))) : raw;
      cache.set(k, out); return out;
    },
    side(lk, size = 's') {
      const k = 'sd|' + size + '|' + JSON.stringify(lk);
      if (cache.has(k)) return cache.get(k);
      const raw = [false, true].map((h) => frame(lk, { ...SIZES[size], rot: Math.PI / 2, happy: h }));
      const u = union(bbox(raw[0]), bbox(raw[1]));
      const out = u ? raw.map((f) => crop(f, pad(u))) : raw; cache.set(k, out); return out;
    },
  };
}
