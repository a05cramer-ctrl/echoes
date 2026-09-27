// Voxel models for echoes: robots (six builds) and originals (hoodie humans).
// Every model is built on an integer grid, meshed into exposed faces only, with baked per-vertex AO.
import * as THREE from 'three';

export const BODY = [['#8b6cff', '#6446d6'], ['#ff8a3d', '#d4611a'], ['#2ec4b6', '#1b8f85'], ['#ff5fa2', '#d33a7c'], ['#ffd23f', '#d6a912'], ['#34e0ff', '#12a9c9'], ['#ff4d5e', '#c9283a'], ['#5cf2a8', '#27b877'], ['#e8ecf5', '#aab2c8']];
export const HOODIES = [['#5b67b8', '#434d91'], ['#a8479a', '#80357a'], ['#2f9a7f', '#227560'], ['#b08a36', '#876828'], ['#3d74ad', '#2d5886'], ['#b03a55', '#882b42']];
const METAL = '#8a93c8', METAL2 = '#5b6296', SCREEN = '#141830', DARK = '#0f1222';

class Grid {
  constructor() { this.m = new Map(); }
  k(x, y, z) { return x + ',' + y + ',' + z; }
  set(x, y, z, c, glow = 0) { this.m.set(this.k(x, y, z), { x, y, z, c, glow }); }
  del(x, y, z) { this.m.delete(this.k(x, y, z)); }
  get(x, y, z) { return this.m.get(this.k(x, y, z)); }
  box(x0, y0, z0, x1, y1, z1, c, glow = 0) { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) this.set(x, y, z, c, glow); }
  // shave the four vertical edges of a box so it reads rounder
  bevel(x0, y0, z0, x1, y1, z1) { for (let y = y0; y < y1; y++) for (const x of [x0, x1 - 1]) for (const z of [z0, z1 - 1]) this.del(x, y, z); }
  bevelTop(x0, y, z0, x1, z1) { for (let x = x0; x < x1; x++) { this.del(x, y, z0); this.del(x, y, z1 - 1); } for (let z = z0; z < z1; z++) { this.del(x0, y, z); this.del(x1 - 1, y, z); } }
}

const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], u: [0, 1, 0], v: [0, 0, 1] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], u: [0, 1, 0], v: [0, 0, -1] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], u: [-1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], u: [1, 0, 0], v: [0, 1, 0] },
];
const AO = [0.5, 0.68, 0.84, 1];
const tmpC = new THREE.Color();

// mesh one layer (solid or glow) of a grid into a BufferGeometry
function mesh(grid, wantGlow, center, glowBoost = 1) {
  const pos = [], nor = [], col = [], idx = [];
  const solid = (x, y, z) => { const v = grid.get(x, y, z); return v && !v.glow ? 1 : 0; };
  const any = (x, y, z) => (grid.get(x, y, z) ? 1 : 0);
  for (const v of grid.m.values()) {
    if (!!v.glow !== wantGlow) continue;
    tmpC.set(v.c);
    for (const f of FACES) {
      const nx = v.x + f.n[0], ny = v.y + f.n[1], nz = v.z + f.n[2];
      const nb = grid.get(nx, ny, nz);
      if (nb && (!nb.glow || wantGlow)) continue; // hidden face (glow faces stay visible next to glow)
      const base = pos.length / 3;
      for (const c of f.c) {
        // AO: look at the three voxels touching this corner in the layer the face points into
        const du = c.map((q, i) => (f.u[i] ? (q ? 1 : -1) * Math.abs(f.u[i]) : 0));
        const dv = c.map((q, i) => (f.v[i] ? (q ? 1 : -1) * Math.abs(f.v[i]) : 0));
        let ao = 3;
        if (!wantGlow) {
          const s1 = solid(nx + du[0], ny + du[1], nz + du[2]), s2 = solid(nx + dv[0], ny + dv[1], nz + dv[2]);
          const cr = solid(nx + du[0] + dv[0], ny + du[1] + dv[1], nz + du[2] + dv[2]);
          ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
        }
        pos.push(v.x + c[0] - center[0], v.y + c[1] - center[1], v.z + c[2] - center[2]);
        nor.push(...f.n);
        const a = wantGlow ? glowBoost : AO[ao];
        col.push(tmpC.r * a, tmpC.g * a, tmpC.b * a);
      }
      // flip the quad so AO interpolates without the diagonal artifact
      const a0 = col[(base) * 3] + col[(base + 2) * 3], a1 = col[(base + 1) * 3] + col[(base + 3) * 3];
      if (a0 < a1) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/* ---------------- robots ---------------- */
// head: 0 box (Scalper) 1 dome (Whale) 2 visor (Sniper) 3 cyclops (Degen) 4 cat (Copycat) 5 tv (Swing)
function robotGrid(o) {
  const g = new Grid();
  const [b1, b2] = BODY[o.c || 0], K = o.k || '#ff5fa2', h = o.h || 0;
  // legs + feet
  g.box(-4, 0, -2, -1, 1, 3, METAL2); g.box(1, 0, -2, 4, 1, 3, METAL2);
  g.box(-3, 1, -1, -1, 3, 1, METAL); g.box(1, 1, -1, 3, 3, 1, METAL);
  // torso
  g.box(-4, 3, -3, 4, 9, 3, b1); g.box(-4, 3, -3, 4, 4, 3, b2); g.bevel(-4, 3, -3, 4, 9, 3);
  g.box(-4, 4, -3, 4, 9, -2, b2);
  if ((o.bd || 0) === 0) {
    g.box(-3, 5, 3, 3, 8, 4, SCREEN); g.box(-2, 6, 3, 2, 7, 4, K, 1);
  } else {
    g.box(-2, 7, 3, 2, 9, 4, '#ffffff'); g.box(-1, 4, 3, 1, 8, 4, K);
  }
  // arms
  g.box(-6, 4, -1, -4, 8, 1, METAL); g.box(4, 4, -1, 6, 8, 1, METAL);
  g.box(-6, 3, -1, -4, 4, 1, b2); g.box(4, 3, -1, 6, 4, 1, b2);
  g.box(-6, 8, -1, -4, 9, 1, b1); g.box(4, 8, -1, 6, 9, 1, b1);
  // neck
  g.box(-1, 9, -1, 1, 10, 1, METAL2);
  const H0 = 10;
  let eyeY = H0 + 3, eyeDx = 0, top = H0 + 8, face = 4;
  const screen = (x0, x1, y0, y1, z) => g.box(x0, y0, z - 1, x1, y1, z, SCREEN);
  if (h === 0 || h === 4) {
    g.box(-6, H0, -4, 6, H0 + 8, 4, b1); g.box(-6, H0, -4, 6, H0 + 1, 4, b2); g.bevel(-6, H0, -4, 6, H0 + 8, 4); g.bevelTop(-6, H0 + 7, -4, 6, 4);
    screen(-4, 4, H0 + 2, H0 + 6, 4);
    g.box(-7, H0 + 2, -1, -6, H0 + 5, 1, METAL); g.box(6, H0 + 2, -1, 7, H0 + 5, 1, METAL);
    if (h === 4) {
      for (const s of [-1, 1]) {
        const xs = s < 0 ? [-6, -3] : [3, 6];
        g.box(xs[0], H0 + 8, -1, xs[1], H0 + 9, 2, b1);
        g.box(xs[0] + (s < 0 ? 0 : 1), H0 + 9, -1, xs[1] - (s < 0 ? 1 : 0), H0 + 10, 2, b1);
        g.box(s < 0 ? -6 : 5, H0 + 10, -1, s < 0 ? -5 : 6, H0 + 11, 2, b1);
        g.box(xs[0] + (s < 0 ? 1 : 1), H0 + 8, 1, xs[1] - 1, H0 + 9, 2, K);
      }
      top = H0 + 11;
      g.box(-1, H0 + 1, 3, 1, H0 + 2, 4, '#ff9fc6', 1);
    }
  } else if (h === 1) {
    for (let y = H0; y < H0 + 10; y++) {
      const t = (y - H0 - 3) / 7, r = y < H0 + 3 ? 6 : 6.4 * Math.sqrt(Math.max(0, 1 - t * t));
      for (let x = -7; x < 7; x++) for (let z = -7; z < 7; z++) { const dx = x + 0.5, dz = z + 0.5; if (dx * dx + dz * dz <= r * r) g.set(x, y, z, y === H0 ? b2 : b1); }
    }
    for (let x = -4; x < 4; x++) for (let y = H0 + 2; y < H0 + 6; y++) { for (let z = 5; z < 8; z++) g.del(x, y, z); g.set(x, y, 4, SCREEN); }
    face = 5; top = H0 + 10;
  } else if (h === 2) {
    g.box(-6, H0, -4, 6, H0 + 8, 4, b1); g.box(-6, H0, -4, 6, H0 + 1, 4, b2); g.bevel(-6, H0, -4, 6, H0 + 8, 4); g.bevelTop(-6, H0 + 7, -4, 6, 4);
    g.box(-7, H0 + 3, -3, 7, H0 + 5, 5, '#3a1020');
    g.box(-5, H0 + 8, -1, -4, H0 + 10, 0, METAL); g.box(4, H0 + 8, -1, 5, H0 + 10, 0, METAL);
    g.box(-5, H0 + 10, -1, -4, H0 + 11, 0, K, 1); g.box(4, H0 + 10, -1, 5, H0 + 11, 0, K, 1);
    top = 0;
  } else if (h === 3) {
    g.box(-5, H0, -4, 5, H0 + 8, 4, b1); g.box(-5, H0, -4, 5, H0 + 1, 4, b2); g.bevel(-5, H0, -4, 5, H0 + 8, 4); g.bevelTop(-5, H0 + 7, -4, 5, 4);
    g.box(-3, H0 + 1, 3, 3, H0 + 7, 4, SCREEN);
    g.box(-6, H0 + 3, -1, -5, H0 + 5, 1, METAL); g.box(5, H0 + 3, -1, 6, H0 + 5, 1, METAL);
  } else if (h === 5) {
    g.box(-7, H0, -4, 7, H0 + 8, 4, b1); g.box(-7, H0, -4, 7, H0 + 1, 4, b2); g.bevel(-7, H0, -4, 7, H0 + 8, 4);
    screen(-6, 2, H0 + 1, H0 + 7, 4);
    g.box(3, H0 + 4, 3, 5, H0 + 6, 5, K); g.box(3, H0 + 1, 3, 5, H0 + 3, 5, K);
    for (let i = 0; i < 4; i++) { g.set(-2 - i, H0 + 8 + i, 0, METAL); g.set(1 + i, H0 + 8 + i, 0, METAL); }
    g.set(-6, H0 + 12, 0, K, 1); g.set(5, H0 + 12, 0, K, 1);
    eyeDx = -2; top = 0;
  }
  // antenna + light
  if (top) {
    g.box(0, top, 0, 1, top + 2, 1, METAL);
    g.box(-1, top + 2, -1, 1, top + 4, 1, K, 1);
  }
  // feet shadow color strip
  return { g, eyeY, eyeDx, face, h };
}

// eyes are their own little mesh so they can blink and glance
function eyesGrid(h, eyeY, eyeDx, face) {
  const g = new Grid(), W = '#ffffff';
  if (h === 2) return null; // the visor has its own scanner light
  if (h === 3) { g.box(-2, eyeY - 1, 0, 2, eyeY + 3, 1, W, 1); return g; }
  g.box(-3 + eyeDx, eyeY, 0, -1 + eyeDx, eyeY + 2, 1, W, 1);
  g.box(1 + eyeDx, eyeY, 0, 3 + eyeDx, eyeY + 2, 1, W, 1);
  return g;
}

const cache = new Map();
const CENTER = [0, 0, 0];
// flat voxel list (for the assembly animation in the tube)
export function robotVoxels(o) { const { g } = robotGrid(o); return [...g.m.values()]; }
export function robotGeo(o) {
  const key = `r|${o.h}|${o.c}|${o.k}|${o.bd}`;
  if (cache.has(key)) return cache.get(key);
  const { g, eyeY, eyeDx, face, h } = robotGrid(o);
  const eg = eyesGrid(h, eyeY, eyeDx, face);
  const out = {
    solid: mesh(g, false, CENTER), glow: mesh(g, true, CENTER, 1.6),
    eyes: eg ? mesh(eg, true, CENTER, 1.7) : null, eyeZ: face, eyeY, h,
    height: h === 2 ? 21 : h === 5 ? 23 : h === 4 ? 25 : h === 1 ? 24 : 22,
  };
  cache.set(key, out); return out;
}

/* ---------------- originals ---------------- */
export function humanGeo(o) {
  const key = `h|${o.hood}|${o.skin}`;
  if (cache.has(key)) return cache.get(key);
  const g = new Grid();
  const [H, h] = HOODIES[o.hood || 0], F = o.skin || '#e0ac7e', J = '#262a4a';
  g.box(-4, 0, -2, -1, 1, 3, DARK); g.box(1, 0, -2, 4, 1, 3, DARK);
  g.box(-4, 1, -2, -1, 6, 2, J); g.box(1, 1, -2, 4, 6, 2, J); g.box(-1, 4, -2, 1, 6, 2, J);
  g.box(-5, 6, -3, 5, 14, 3, H); g.bevel(-5, 6, -3, 5, 14, 3);
  g.box(-5, 6, -3, 5, 7, 3, h); g.bevel(-5, 6, -3, 5, 7, 3);
  g.box(-3, 7, 3, 3, 10, 4, h);
  g.box(-2, 11, 3, -1, 13, 4, '#34e0ff', 1); g.box(1, 11, 3, 2, 13, 4, '#34e0ff', 1);
  g.box(-7, 7, -2, -5, 14, 2, H); g.box(5, 7, -2, 7, 14, 2, H);
  g.box(-7, 6, -1, -5, 7, 1, F); g.box(5, 6, -1, 7, 7, 1, F);
  // hood + face
  g.box(-5, 14, -5, 5, 23, 4, H); g.bevel(-5, 14, -5, 5, 23, 4); g.bevelTop(-5, 22, -5, 5, 4);
  g.box(-5, 14, -5, 5, 15, 4, h);
  g.box(-3, 15, 3, 3, 21, 4, '#000000');
  for (let x = -3; x < 3; x++) for (let y = 15; y < 21; y++) g.del(x, y, 3);
  g.box(-3, 15, 2, 3, 21, 3, F);
  g.box(-2, 18, 2, -1, 19, 3, DARK); g.box(1, 18, 2, 2, 19, 3, DARK);
  g.box(-1, 17, 2, 1, 18, 3, '#c98f6a');
  g.box(-4, 21, 2, 4, 22, 4, H);
  const out = { solid: mesh(g, false, CENTER), glow: mesh(g, true, CENTER, 1.5), eyes: null, height: 23 };
  cache.set(key, out); return out;
}

/* ---------------- materials ---------------- */
const PUPIL = new THREE.BoxGeometry(2, 2, 0.3);
export const MAT = {
  solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  pupil: new THREE.MeshBasicMaterial({ color: '#0f1222' }),
  ghost: (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
};

// a whole character: group with body, glow bits, eyes (+ visor scanner for Snipers)
export function makeRobot(o) {
  const geo = robotGeo(o);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const solid = new THREE.Mesh(geo.solid, MAT.solid); solid.castShadow = true; solid.receiveShadow = true; body.add(solid);
  if (geo.glow) body.add(new THREE.Mesh(geo.glow, MAT.glow));
  let eyes = null, visor = null;
  if (geo.eyes) {
    eyes = new THREE.Group(); eyes.position.set(0, geo.eyeY + 1, geo.eyeZ - 0.8); body.add(eyes);
    const em = new THREE.Mesh(geo.eyes, MAT.glow); em.position.y = -(geo.eyeY + 1); eyes.add(em);
    if (geo.h === 3) { const pu = new THREE.Mesh(PUPIL, MAT.pupil); pu.position.set(0, 0.5, 1.05); eyes.add(pu); eyes.userData.pupil = pu; }
  }
  if (geo.h === 2) {
    const vg = new THREE.BoxGeometry(3, 1.2, 0.4);
    visor = new THREE.Mesh(vg, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b5c').multiplyScalar(2.2), toneMapped: false }));
    visor.position.set(0, 14, 5.1); body.add(visor);
  }
  root.userData = { body, eyes, visor, geo, height: geo.height };
  return root;
}
export function makeHuman(o) {
  const geo = humanGeo(o);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const solid = new THREE.Mesh(geo.solid, MAT.solid); solid.castShadow = true; solid.receiveShadow = true; body.add(solid);
  if (geo.glow) body.add(new THREE.Mesh(geo.glow, MAT.glow));
  root.userData = { body, geo, height: geo.height };
  return root;
}
