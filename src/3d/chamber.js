// The echo chamber: a live voxel diorama. Originals stand on pads, their echoes wander near them,
// every real trade sends a ripple from the original to its echoes. The newest echo floats in the tube.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { PixelPass } from './pixelpass.js';
import { makeRobot, makeHuman, robotVoxels, MAT } from './vox.js';

const TAU = Math.PI * 2, R = Math.random;
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
const easeBack = (k) => { k = clamp(k, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const FLOOR_R = 118, TUBE_R = 15, TUBE_H = 48, PAD_R = 80;
const SCAN_A = (158 * Math.PI) / 180, SCAN = new THREE.Vector3(Math.cos(SCAN_A) * 78, 0, Math.sin(SCAN_A) * 78);
const SPEED = { Scalper: 26, Degen: 30, Sniper: 22, Copycat: 16, Whale: 10, Swing: 8 };
const COL = { buy: '#5cf2a8', sell: '#ffd23f', loss: '#ff5f7a', skip: '#8f8bc2', pink: '#ff4fa3', cyan: '#2ee6ff' };

export function createChamber(o) {
  const { canvas, labelsEl, look, humanLook, onPick, onPing } = o;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- renderer + post ---------------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#07061a');
  scene.fog = new THREE.Fog('#07061a', 700, 1250);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
  const composer = new EffectComposer(renderer);
  const pix = new PixelPass(2, scene, cam, { depthMin: 3 });
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.42, 0.78);
  composer.addPass(pix); composer.addPass(bloom); composer.addPass(new OutputPass());

  /* ---------------- light ---------------- */
  scene.add(new THREE.HemisphereLight('#b3bcff', '#2a1640', 1.25));
  const key = new THREE.DirectionalLight('#fff4ea', 2.1);
  key.position.set(120, 260, 180); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 10, far: 700 });
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0008; key.shadow.normalBias = 0.6;
  scene.add(key);
  const rimP = new THREE.DirectionalLight('#ff4fa3', 1.3); rimP.position.set(-260, 90, -220); scene.add(rimP);
  const rimC = new THREE.DirectionalLight('#2ee6ff', 1.3); rimC.position.set(260, 90, -200); scene.add(rimC);
  const tubeLight = new THREE.PointLight('#2ee6ff', 2.2, 150, 1.2); tubeLight.position.set(0, 26, 0); scene.add(tubeLight);

  /* ---------------- floor ---------------- */
  const floorTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#17142f'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 16) for (let j = 0; j < 256; j += 16) { x.fillStyle = ((i + j) / 16) % 2 ? '#1b1838' : '#161330'; x.fillRect(i, j, 16, 16); }
    x.fillStyle = '#231f4a'; for (let i = 0; i < 256; i += 16) { x.fillRect(i, 0, 1, 256); x.fillRect(0, i, 256, 1); }
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.9, 1.9); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(FLOOR_R, FLOOR_R + 2, 6, 96), [new THREE.MeshLambertMaterial({ color: '#1d1a3c' }), new THREE.MeshLambertMaterial({ map: floorTex }), new THREE.MeshLambertMaterial({ color: '#100e24' })]);
  floor.position.y = -3; floor.receiveShadow = true; scene.add(floor);
  // concentric inlay rings on the floor
  const inlay = (r, w, col, op = 1) => { const m = new THREE.Mesh(new THREE.RingGeometry(r, r + w, 128), new THREE.MeshBasicMaterial({ color: col, transparent: op < 1, opacity: op, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.05; m.layers.set(1); scene.add(m); return m; };
  inlay(26, 1.2, '#2a2560'); inlay(PAD_R - 14, 0.8, '#231f50'); inlay(PAD_R + 14, 0.8, '#231f50');
  // rim: hazard blocks + glowing strip
  {
    const n = 132, g = new THREE.BoxGeometry(5.9, 5, 7);
    const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial(), n); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + Math.PI / 2);
      m4.compose(new THREE.Vector3(Math.cos(a) * (FLOOR_R + 4), 0.5, Math.sin(a) * (FLOOR_R + 4)), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m4); im.setColorAt(i, c.set(i % 4 < 2 ? '#ffd23f' : '#1b1838'));
    }
    im.receiveShadow = true; scene.add(im);
    const strip = new THREE.Mesh(new THREE.TorusGeometry(FLOOR_R + 8, 0.6, 4, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2ee6ff').multiplyScalar(1.6), toneMapped: false }));
    strip.rotation.x = -Math.PI / 2; strip.position.y = 1.5; scene.add(strip);
  }
  // void below: a far grid
  {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#07061a'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#0d0b25'; x.fillRect(0, 0, 64, 1); x.fillRect(0, 0, 1, 64);
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); t.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshBasicMaterial({ map: t })); g.rotation.x = -Math.PI / 2; g.position.y = -40; g.layers.set(1); scene.add(g);
  }
  // monoliths around the room
  const monoStrips = [], monos = [];
  {
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.1, r = 250 + (i % 3) * 40, h = 260 + ((i * 53) % 5) * 60, w = 30 + (i % 2) * 16;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 18), new THREE.MeshLambertMaterial({ color: '#15123a' }));
      m.position.set(Math.cos(a) * r, h / 2 - 200, Math.sin(a) * r); m.lookAt(0, m.position.y, 0); scene.add(m); monos.push(m);
      const col = i % 2 ? '#ff4fa3' : '#2ee6ff';
      const s = new THREE.Mesh(new THREE.BoxGeometry(2, h * 0.7, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.2), toneMapped: false, transparent: true, opacity: 0.9 }));
      s.position.set(-w / 2 + 5, h * 0.1, 9.5); m.add(s); monoStrips.push(s);
      for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), new THREE.MeshBasicMaterial({ color: k % 2 ? '#5cf2a8' : '#ffd23f', toneMapped: false })); d.position.set(w / 2 - 5, h * 0.42 - k * 6, 9.5); m.add(d); monoStrips.push(d); }
    }
  }
  // dust
  const dust = (() => {
    const n = 260, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = R() * TAU, r = 40 + R() * 320; p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = R() * 220; p[i * 3 + 2] = Math.sin(a) * r; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#8f8bc2', size: 1, sizeAttenuation: false, transparent: true, opacity: 0.7 }));
    pts.layers.set(1); scene.add(pts); return pts;
  })();

  /* ---------------- the tube ---------------- */
  const tube = new THREE.Group(); scene.add(tube);
  const metal = new THREE.MeshLambertMaterial({ color: '#3c3673' }), metal2 = new THREE.MeshLambertMaterial({ color: '#2a2552' });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R + 7, TUBE_R + 9, 7, 24), metal); base.position.y = 3.5; base.castShadow = base.receiveShadow = true; tube.add(base);
  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R + 3, TUBE_R + 4, 3, 24), metal2); base2.position.y = 8.5; tube.add(base2);
  const baseLights = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, l = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), new THREE.MeshBasicMaterial({ color: '#2ee6ff', toneMapped: false })); l.position.set(Math.cos(a) * (TUBE_R + 8.2), 4, Math.sin(a) * (TUBE_R + 8.2)); l.lookAt(0, 4, 0); tube.add(l); baseLights.push(l); }
  const topG = new THREE.Group(); tube.add(topG);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R + 4, TUBE_R + 6, 8, 24), metal); cap.position.y = 10 + TUBE_H + 4; cap.castShadow = true; topG.add(cap);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5, p = new THREE.Mesh(new THREE.BoxGeometry(5, 400, 5), metal2); p.position.set(Math.cos(a) * 9, 10 + TUBE_H + 8 + 200, Math.sin(a) * 9); topG.add(p); }
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R, TUBE_R, TUBE_H, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#8fe9ff', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
  glass.position.y = 10 + TUBE_H / 2; glass.layers.set(1); topG.add(glass);
  const glassHi = new THREE.Mesh(new THREE.BoxGeometry(1.6, TUBE_H - 6, 0.5), new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }));
  glassHi.position.set(-TUBE_R * 0.62, 10 + TUBE_H / 2, TUBE_R * 0.78); glassHi.rotation.y = -0.6; glassHi.layers.set(1); topG.add(glassHi);
  const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#2ee6ff').multiplyScalar(1.5), toneMapped: false });
  for (const y of [10.5, 10 + TUBE_H - 0.5]) { const r = new THREE.Mesh(new THREE.TorusGeometry(TUBE_R + 0.3, 0.7, 4, 48), rimMat); r.rotation.x = Math.PI / 2; r.position.y = y; (y > 20 ? topG : tube).add(r); }
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R - 0.6, TUBE_R - 0.6, 1, 32), new THREE.MeshBasicMaterial({ color: '#12a9c9', transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false }));
  liquid.layers.set(1); tube.add(liquid);
  const surf = new THREE.Mesh(new THREE.TorusGeometry(TUBE_R - 0.8, 0.5, 4, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#9ff3ff').multiplyScalar(1.4), toneMapped: false }));
  surf.rotation.x = Math.PI / 2; tube.add(surf);
  const bubbles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshBasicMaterial({ color: '#c8f8ff', toneMapped: false }), 40);
  bubbles.layers.set(1); tube.add(bubbles);
  const bub = Array.from({ length: 40 }, () => ({ x: (R() - 0.5) * 20, y: 10 + R() * TUBE_H, z: (R() - 0.5) * 20, v: 4 + R() * 8 }));
  // electrodes
  const zapMat = new THREE.LineBasicMaterial({ color: '#fff27a', toneMapped: false });
  const zaps = [];
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(4, 12, 4), metal); e.position.set(s * (TUBE_R + 6), 10 + TUBE_H * 0.7, 0); e.castShadow = true; tube.add(e); }

  /* ---------------- scanner ---------------- */
  const scanner = new THREE.Group(); scanner.position.copy(SCAN); scanner.rotation.y = Math.atan2(Math.cos(SCAN_A), Math.sin(SCAN_A)); scene.add(scanner);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(14, 15, 3, 24), metal); pad.position.y = 1.5; pad.receiveShadow = true; scanner.add(pad);
  const padRing = new THREE.Mesh(new THREE.TorusGeometry(13.5, 0.6, 4, 40), new THREE.MeshBasicMaterial({ color: '#ff4fa3', toneMapped: false })); padRing.rotation.x = Math.PI / 2; padRing.position.y = 3.1; scanner.add(padRing);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(4, 44, 6), metal); p.position.set(s * 17, 22, 0); p.castShadow = true; scanner.add(p); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(40, 5, 7), metal); beam.position.y = 46; beam.castShadow = true; scanner.add(beam);
  const beamLights = [];
  for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 1), new THREE.MeshBasicMaterial({ color: '#2ee6ff', toneMapped: false })); l.position.set(-12 + i * 6, 46, 3.6); scanner.add(l); beamLights.push(l); }
  const laser = new THREE.Mesh(new THREE.BoxGeometry(30, 0.8, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4fa3').multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false }));
  laser.layers.set(1); laser.visible = false; scanner.add(laser);
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const clipMats = { solid: MAT.solid.clone(), glow: MAT.glow.clone() }; clipMats.solid.clippingPlanes = [clip]; clipMats.glow.clippingPlanes = [clip];
  let scanHuman = null, scanGhost = null;

  // pipe from scanner to the tube, with DNA packets riding it
  const pipePts = [SCAN.clone().setY(1.2), new THREE.Vector3(SCAN.x * 0.55, 1.2, SCAN.z * 0.2 + 18), new THREE.Vector3(-TUBE_R - 8, 1.2, 6)];
  const pipeCurve = new THREE.CatmullRomCurve3(pipePts);
  const pipe = new THREE.Mesh(new THREE.TubeGeometry(pipeCurve, 40, 1.4, 5), metal2); pipe.receiveShadow = true; scene.add(pipe);
  const packets = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshBasicMaterial({ toneMapped: false }), 48);
  packets.layers.set(1); packets.count = 0; scene.add(packets);
  let packetList = [];

  /* ---------------- rings (sonar / events) ---------------- */
  const ringGeo = new THREE.RingGeometry(0.92, 1, 64);
  const rings = [];
  function ring(x, z, color, { r0 = 4, r1 = 60, life = 1.6, y = 0.4, delay = 0, width } = {}) {
    const g = width ? new THREE.RingGeometry(1 - width, 1, 64) : ringGeo;
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.5), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.layers.set(1); m.visible = false; scene.add(m);
    rings.push({ m, r0, r1, life, t: -delay });
  }
  function tickRings(dt) {
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += dt;
      if (r.t < 0) continue;
      const k = r.t / r.life; r.m.visible = true;
      if (k >= 1) { scene.remove(r.m); r.m.material.dispose(); if (r.m.geometry !== ringGeo) r.m.geometry.dispose(); rings.splice(i, 1); continue; }
      const s = lerp(r.r0, r.r1, ease(k)); r.m.scale.set(s, s, s); r.m.material.opacity = (1 - k) * 0.75;
    }
  }
  // beams: curved arcs of little cubes from an original to its echo
  const beams = [];
  const beamGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
  function beamTo(from, bot, color) {
    const n = 7, mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.8), toneMapped: false, transparent: true });
    const ms = []; for (let i = 0; i < n; i++) { const m = new THREE.Mesh(beamGeo, mat); m.layers.set(1); m.visible = false; scene.add(m); ms.push(m); }
    beams.push({ from: from.clone(), bot, ms, mat, t: 0, life: 0.75 });
  }
  function tickBeams(dt) {
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i]; b.t += dt; const k = b.t / b.life;
      const to = b.bot.g.position;
      if (k > 1.25) { b.ms.forEach((m) => scene.remove(m)); b.mat.dispose(); beams.splice(i, 1); continue; }
      const d = b.from.distanceTo(to), h = 10 + d * 0.35;
      b.ms.forEach((m, j) => {
        const q = k - j * 0.035; if (q < 0 || q > 1) { m.visible = false; return; }
        m.visible = true;
        m.position.set(lerp(b.from.x, to.x, q), lerp(28, b.bot.y + b.bot.height + 2, q) + Math.sin(q * Math.PI) * h, lerp(b.from.z, to.z, q));
        m.scale.setScalar(1 - j * 0.1);
      });
    }
  }

  /* ---------------- labels (DOM) ---------------- */
  const tmpV = new THREE.Vector3();
  const pool = [];
  function labelEl() { const el = pool.pop() || document.createElement('div'); el.className = 'lbl'; labelsEl.append(el); return el; }
  function freeLabel(el) { if (!el) return; el.remove(); pool.push(el); }
  let VW = 1, VH = 1;
  function screenOf(v, out = {}) {
    tmpV.copy(v).project(cam);
    out.x = (tmpV.x * 0.5 + 0.5) * VW; out.y = (-tmpV.y * 0.5 + 0.5) * VH; out.z = tmpV.z; return out;
  }

  /* ---------------- originals ---------------- */
  const origs = new Map(); // wallet -> { g, pos, slot, label, bob }
  function slotAngle(i, n) {
    // spread around the ring, skipping the scanner's sector
    const gap0 = SCAN_A - 0.5, gap1 = SCAN_A + 0.42, span = TAU - (gap1 - gap0);
    return gap1 + ((i + 0.5) / n) * span;
  }
  const slots = new Array(10).fill(null);
  const whash = (w) => { let h = 2166136261; for (const ch of w) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  function setOriginals(wallets) {
    const want = wallets.slice(0, 10);
    for (const [w, og] of origs) if (!want.includes(w)) { scene.remove(og.g); scene.remove(og.pad); freeLabel(og.label); origs.delete(w); slots[og.slot] = null; }
    want.forEach((w) => {
      let og = origs.get(w);
      // each wallet keeps its own pad for as long as it's on the floor
      let slot = og ? og.slot : -1;
      if (slot < 0) { const h0 = whash(w) % 10; for (let k = 0; k < 10; k++) { const j = (h0 + k * 3) % 10; if (!slots[j]) { slot = j; break; } } slots[slot] = w; }
      const a = slotAngle(slot, 10), pos = new THREE.Vector3(Math.cos(a) * PAD_R, 0, Math.sin(a) * PAD_R);
      if (!og) {
        const g = makeHuman(humanLook(w)); g.userData.body.children.forEach((m) => (m.castShadow = true));
        const padM = new THREE.Group();
        const p = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 2.4, 20), metal2); p.position.y = 1.2; p.receiveShadow = true; padM.add(p);
        const pr = new THREE.Mesh(new THREE.TorusGeometry(10, 0.45, 4, 32), new THREE.MeshBasicMaterial({ color: '#8b6cff', toneMapped: false })); pr.rotation.x = Math.PI / 2; pr.position.y = 2.5; padM.add(pr);
        const bm = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 46, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#8b6cff', transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
        bm.position.y = 25; bm.layers.set(1); padM.add(bm); padM.userData.beam = bm;
        g.scale.setScalar(1.15);
        scene.add(padM); scene.add(g);
        og = { g, pad: padM, padRing: pr, wallet: w, label: labelEl(), bob: 0, vy: 0, flash: 0, slot };
        og.label.classList.add('og'); og.label.textContent = w.slice(0, 4) + '…' + w.slice(-4);
        origs.set(w, og);
      }
      og.pos = pos; og.pad.position.copy(pos); og.g.position.set(pos.x, 2.4, pos.z);
      og.face = Math.atan2(pos.x, pos.z); og.ph = (slot * 1.7) % 6;
    });
  }

  /* ---------------- echoes on the floor ---------------- */
  const bots = new Map();
  const ghostMats = [MAT.ghost('#ff4fa3'), MAT.ghost('#2ee6ff')];
  const holoMat = MAT.ghost('#2ee6ff'); holoMat.opacity = 0.6;
  function spawnBot(c, at) {
    const lk = look(c), g = makeRobot(lk);
    g.userData.body.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    const geo = g.userData.geo;
    const ghosts = ghostMats.map((mat) => { const m = new THREE.Mesh(geo.solid, mat); m.layers.set(1); m.visible = false; scene.add(m); return m; });
    const b = { id: c.id, c, lk, g, ghosts, hist: [], histT: 0, height: g.userData.height, x: 0, z: 0, tx: 0, tz: 0, wait: R() * 2, vy: 0, y: 0, face: R() * TAU, ph: R() * 10, blink: 0, step: 0, moving: false, bubble: null, tag: null, speed: SPEED[c.build] || 14, spin: 0, look: 0 };
    const p = at || randomSpot(b); b.x = p.x; b.z = p.z; pickTarget(b);
    g.position.set(b.x, 0, b.z); scene.add(g);
    bots.set(c.id, b); return b;
  }
  function removeBot(b) { scene.remove(b.g); b.ghosts.forEach((m) => scene.remove(m)); freeLabel(b.tagEl); freeLabel(b.bubEl); bots.delete(b.id); }
  function home(b) { const og = origs.get(b.c.source_wallet); return og ? og.pos : null; }
  function valid(x, z) { const r = Math.hypot(x, z); if (r > FLOOR_R - 10 || r < TUBE_R + 16) return false; if (Math.hypot(x - SCAN.x, z - SCAN.z) < 24) return false; return true; }
  function randomSpot(b) {
    const h = home(b);
    for (let k = 0; k < 30; k++) {
      let x, z;
      if (h && R() < 0.8) { const a = R() * TAU, r = 12 + R() * 26; x = h.x + Math.cos(a) * r; z = h.z + Math.sin(a) * r; }
      else { const a = R() * TAU, r = 30 + R() * (FLOOR_R - 42); x = Math.cos(a) * r; z = Math.sin(a) * r; }
      if (valid(x, z)) return { x, z };
    }
    return { x: 0, z: 60 };
  }
  function pickTarget(b, p) { const q = p || randomSpot(b); b.tx = q.x; b.tz = q.z; }

  function sync(echoes, max) {
    const byAct = [...echoes].sort((a, b) => new Date(b.lastTradeAt || b.created_at) - new Date(a.lastTradeAt || a.created_at));
    const byPnl = [...echoes].sort((a, b) => b.pnlPct - a.pnlPct);
    const keep = new Set([...byPnl.slice(0, 10), ...byAct].slice(0, max).map((c) => c.id));
    for (const b of [...bots.values()]) if (!keep.has(b.id) && b.id !== bornId) removeBot(b);
    // originals: the wallets with the most echoes on the floor
    const cnt = new Map(); for (const c of echoes) if (keep.has(c.id)) cnt.set(c.source_wallet, (cnt.get(c.source_wallet) || 0) + 1);
    setOriginals([...cnt.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]));
    for (const c of echoes) { if (!keep.has(c.id)) continue; const b = bots.get(c.id); if (b) b.c = c; else spawnBot(c); }
    top3 = byPnl.slice(0, 3).map((c) => c.id);
    alive = echoes.length;
  }
  let top3 = [], alive = 0, hover = null, spot = null, spotT = 0;

  function say(b, text, color, t = 4.5) { b.bubble = { text, color, t }; }
  function event(ev, loud) {
    const b = bots.get(ev.echoId);
    const og = origs.get(ev.original);
    const col = ev.side === 'buy' ? COL.buy : ev.side === 'sell' ? ((ev.pnl ?? 0) >= 0 ? COL.sell : COL.loss) : COL.skip;
    if (og && !og._firedFor?.has(ev.signature)) {
      (og._firedFor ||= new Set()).add(ev.signature); if (og._firedFor.size > 30) og._firedFor = new Set([ev.signature]);
      og.vy = 26; og.flash = 1.2;
      ring(og.pos.x, og.pos.z, ev.origSide === 'sell' ? COL.sell : COL.buy, { r0: 8, r1: 40, life: 1.2 });
      ring(og.pos.x, og.pos.z, COL.pink, { r0: 6, r1: 30, life: 1.2, delay: 0.14 });
      og.say = { text: `${ev.origSide === 'sell' ? 'sold' : 'bought'} ${fmtSym(ev.symbol)}`, color: ev.origSide === 'sell' ? COL.sell : COL.buy, t: 3 };
    }
    if (!b) return;
    const txt = ev.side === 'buy' ? `BUY ${fmtSym(ev.symbol)}` : ev.side === 'sell' ? `SOLD ${fmtSym(ev.symbol)}${ev.pnl != null ? ' ' + (ev.pnl >= 0 ? '+' : '−') + Math.abs(ev.pnl).toFixed(3) : ''}` : `pass ${fmtSym(ev.symbol)}`;
    const delay = og ? 0.6 : 0;
    setTimeout(() => {
      if (!bots.has(b.id)) return;
      if (ev.side !== 'skip') { say(b, txt, col, 4.5); b.vy = 34; b.spin = 1; ring(b.x, b.z, col, { r0: 3, r1: 16, life: 0.8 }); b.wait = 1; }
      else b.shake = 0.6;
    }, delay * 1000);
    if (og) beamTo(og.pos, b, ev.side === 'skip' ? COL.skip : ev.origSide === 'sell' ? COL.sell : COL.buy);
    if (loud) onPing?.(ev);
  }
  const fmtSym = (s) => '$' + String(s || '?').replace(/^\$/, '');

  function spotlight(id) { spot = id; spotT = 6; const b = bots.get(id); if (b) { b.vy = 30; say(b, 'hi!', COL.cyan, 3); } }

  /* ---------------- tube occupant + flow ---------------- */
  const st = { mode: 'idle', liquid: 1, reveal: 1, open: 0, show: [], showI: 0, showT: 0, holdUntil: 0, scan: 0, flash: 0 };
  let occupant = null, occLabel = labelEl(); occLabel.classList.add('occ');
  let bornId = null, assembly = null;
  function setOccupant(c, opts = {}) {
    if (occupant) { tube.remove(occupant.g); occupant = null; }
    if (!c && !opts.look) { occLabel.hidden = true; return; }
    const lk = opts.look || look(c), g = makeRobot(lk);
    if (opts.ghost) g.traverse((m) => { if (m.isMesh) { m.material = holoMat; m.layers.set(1); } });
    g.scale.setScalar(1.25); g.position.y = 14; tube.add(g);
    occupant = { g, c, id: c?.id, lk, ghost: !!opts.ghost, swap: 1 };
    occLabel.hidden = false;
    occLabel.innerHTML = opts.html || '';
  }
  function occHtml(c, tag = 'newest echo') {
    const p = Number(c.pnlPct) || 0;
    return `<small>${tag}</small><b>${esc(c.name)}</b><i class="${p > 0 ? 'up' : p < 0 ? 'dn' : ''}">${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p).toFixed(1)}% · ${c.trades || 0} trades</i>`;
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function startAssembly(lk) {
    const vox = robotVoxels(lk);
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), vox.length);
    const c = new THREE.Color(), items = vox.map((v, i) => {
      im.setColorAt(i, c.set(v.c).multiplyScalar(v.glow ? 1.6 : 1));
      const a = R() * TAU, r = 28 + R() * 40;
      return { v, from: new THREE.Vector3(Math.cos(a) * r, 10 + R() * 70, Math.sin(a) * r), delay: (v.y / 26) * 2.2 + R() * 0.5, spin: (R() - 0.5) * 10 };
    });
    im.castShadow = true; im.count = vox.length; im.scale.setScalar(1.25); im.position.y = 14;
    tube.add(im);
    assembly = { im, items, t: 0, cap: 0.7, done: false };
  }
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), ee = new THREE.Euler(), vv = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0);
  function tickAssembly(dt) {
    const A = assembly; if (!A) return;
    A.t += dt;
    const maxT = A.cap * 3.2;
    let placed = 0;
    A.items.forEach((it, i) => {
      const k = clamp((Math.min(A.t, maxT + (A.cap >= 1 ? 99 : 0)) - it.delay) / 0.55, 0, 1);
      if (k >= 1) placed++;
      if (k <= 0) { m4.compose(zero, qq.identity(), zero); A.im.setMatrixAt(i, m4); return; }
      const e = easeBack(k), target = vv.set(it.v.x + 0.5, it.v.y + 0.5, it.v.z + 0.5);
      const fx = lerp(it.from.x / 1.25, target.x, e), fy = lerp((it.from.y - 14) / 1.25, target.y, e), fz = lerp(it.from.z / 1.25, target.z, e);
      ee.set(it.spin * (1 - k), it.spin * 0.7 * (1 - k), 0); qq.setFromEuler(ee);
      m4.compose(vv.set(fx, fy, fz), qq, one.set(1, 1, 1).multiplyScalar(0.4 + 0.6 * k)); A.im.setMatrixAt(i, m4);
    });
    A.im.instanceMatrix.needsUpdate = true;
    A.progress = placed / A.items.length;
  }
  function endAssembly() { if (!assembly) return; tube.remove(assembly.im); assembly.im.geometry.dispose(); assembly = null; }

  const api = {
    renderer, scene, camera: cam,
    showcase(list) {
      st.show = list.slice(0, 6);
      if (st.mode === 'idle' && performance.now() > st.holdUntil) {
        const cur = occupant && st.show.find((c) => c.id === occupant.id);
        if (!cur) { st.showI = 0; if (st.show[0]) setOccupant(st.show[0], { html: occHtml(st.show[0]) }); st.showT = 6; }
        else occLabel.innerHTML = occHtml(cur);
      }
    },
    idle() { st.mode = 'idle'; endAssembly(); removeScanHuman(); st.liquid = 1; laser.visible = false; packetList = []; setOccupant(st.show[st.showI], st.show[st.showI] ? { html: occHtml(st.show[st.showI]) } : {}); focus(null); },
    scanning(wallet) {
      st.mode = 'scanning'; st.scan = 0; st.liquid = Math.min(st.liquid, 1); packetList = [];
      removeScanHuman();
      const hl = humanLook(wallet);
      scanHuman = makeHuman(hl); scanHuman.traverse((m) => { if (m.isMesh) m.material = m.material === MAT.glow ? clipMats.glow : clipMats.solid; });
      scanHuman.position.set(0, 3, 0); scanner.add(scanHuman);
      scanGhost = makeHuman(hl); scanGhost.traverse((m) => { if (m.isMesh) { m.material = ghostMats[0]; m.layers.set(1); } }); scanGhost.position.set(0, 3, 0); scanner.add(scanGhost);
      laser.visible = true; setOccupant(null); focus('scan');
    },
    scanned(report, lk) {
      st.mode = 'scanned'; st.scan = 1; laser.visible = false; st.flash = 0.6;
      if (scanGhost) { scanner.remove(scanGhost); scanGhost = null; }
      ring(SCAN.x, SCAN.z, COL.pink, { r0: 6, r1: 40, life: 1.2 }); ring(SCAN.x, SCAN.z, COL.cyan, { r0: 4, r1: 32, life: 1.2, delay: 0.15 });
      if (report.swaps) {
        const dna = (report.dna || []).slice(-24);
        packetList = dna.map((d, i) => ({ t: -i * 0.12, col: d.s === 's' ? '#ff4fa3' : '#5cf2a8' }));
        setOccupant(null, { look: lk, ghost: true, html: `<small>matched build</small><b>${esc(report.build)}</b><i>ready to grow</i>` });
      } else setOccupant(null);
      focus('both');
    },
    fail() {
      const prev = st.mode; st.mode = 'error'; laser.visible = false; st.flash = -0.8;
      ring(SCAN.x, SCAN.z, COL.loss, { r0: 6, r1: 36, life: 1 });
      setTimeout(() => { if (st.mode === 'error') { st.mode = prev === 'growing' ? 'scanned' : prev === 'scanning' ? 'idle' : prev; if (st.mode === 'idle') api.idle(); } }, 1400);
    },
    growing(name, lk) {
      st.mode = 'growing'; st.liquid = 0.12; setOccupant(null); endAssembly(); startAssembly(lk);
      occLabel.hidden = false; occLabel.innerHTML = `<small>growing</small><b>${esc(name)}.echo</b><i class="up">0%</i>`;
      focus('tube');
    },
    grown() { if (assembly) assembly.cap = 1; },
    born(echo) {
      st.mode = 'born'; st.flash = 1; st.open = 1; st.holdUntil = performance.now() + 25000;
      endAssembly(); setOccupant(echo, { html: occHtml({ ...echo, pnlPct: 0, trades: 0 }, 'alive · 1 paper SOL') });
      bornId = echo.id; occupant.born = { t: 0 };
      for (let k = 0; k < 4; k++) ring(0, 0, k % 2 ? COL.pink : COL.cyan, { r0: TUBE_R, r1: 150 + k * 20, life: 1.6, delay: k * 0.14, y: 0.6 });
      packetList = [];
      setTimeout(() => { if (st.mode === 'born') { st.mode = 'idle'; focus(null); } }, 7000);
    },
    busy: () => st.mode === 'scanning' || st.mode === 'growing',
    get mode() { return st.mode; },
    // the floor
    sync(list, max) { sync(list, max); },
    event, spotlight,
    enter(c) {
      if (bornId === c.id && occupant?.id === c.id) {
        // the robot hops out of the tube and joins the floor
        const b = spawnBot(c, { x: 0, z: TUBE_R + 20 });
        b.g.visible = false; b.fromTube = { t: 0 }; say(b, 'hello world', COL.cyan, 4); spot = c.id; spotT = 8;
        return;
      }
      const b = bots.get(c.id) || spawnBot(c); b.vy = 30; say(b, 'hello world', COL.cyan, 4); spot = c.id; spotT = 6;
    },
    ping(x, z) { ring(x, z, COL.cyan, { r0: 2, r1: 30, life: 1 }); ring(x, z, COL.pink, { r0: 2, r1: 24, life: 1, delay: 0.1 }); },
    pickAt, resize, tick, setVisible(v) { visible = v; },
    stats: () => ({ alive, bots: bots.size }),
  };

  function removeScanHuman() { if (scanHuman) { scanner.remove(scanHuman); scanHuman = null; } if (scanGhost) { scanner.remove(scanGhost); scanGhost = null; } }

  /* ---------------- camera ---------------- */
  let W = 1, H = 1, frame = 300, offX = 0, visible = true, az = -0.35, azVel = 0, drag = null;
  const camDir = new THREE.Vector3();
  const camT = { target: new THREE.Vector3(0, 8, 0), zoom: 1 }, camC = { target: new THREE.Vector3(0, 8, 0), zoom: 1 };
  let focusMode = null;
  function focus(m) { focusMode = m; }
  let layout = { offset: 0, width: 300 };
  function resize(w, h, lay = {}) {
    W = Math.max(1, w | 0); H = Math.max(1, h | 0); VW = W; VH = H; layout = { offset: lay.offset || 0, width: lay.width || 300, px: lay.px || 2, lift: lay.lift || 0 };
    renderer.setSize(W, H, false); composer.setSize(W, H);
    pix.setPixelSize(layout.px);
  }
  function placeCamera(dt) {
    // where to look
    if (focusMode === 'scan') { camT.target.set(SCAN.x * 0.8, 18, SCAN.z * 0.8); camT.zoom = 1.9; }
    else if (focusMode === 'tube') { camT.target.set(0, 32, 0); camT.zoom = 1.9; }
    else if (focusMode === 'both') { camT.target.set(SCAN.x * 0.45, 22, SCAN.z * 0.45); camT.zoom = 1.45; }
    else { camT.target.set(0, 8 + layout.lift, 0); camT.zoom = 1; }
    const k = 1 - Math.pow(0.02, dt);
    camC.target.lerp(camT.target, k); camC.zoom = lerp(camC.zoom, camT.zoom, k);
    if (focusMode === 'scan' || focusMode === 'both') { const want = Math.atan2(SCAN.x, SCAN.z) + 0.25; let d = want - az; d = Math.atan2(Math.sin(d), Math.cos(d)); az += d * k; }
    else if (!drag) { az += (RM ? 0 : 0.035) * dt + azVel * dt; azVel *= Math.pow(0.1, dt); }
    const el = 0.62, dist = 700;
    const mx = pointer.inside ? pointer.nx * 0.05 : 0, my = pointer.inside ? pointer.ny * 0.03 : 0;
    const a = az + mx, e = el + my;
    camDir.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
    cam.position.copy(camC.target).addScaledVector(camDir, dist);
    cam.lookAt(camC.target);
    const fw = layout.width / camC.zoom, fh = fw * H / W;
    cam.left = -fw / 2; cam.right = fw / 2; cam.top = fh / 2; cam.bottom = -fh / 2;
    cam.near = 1; cam.far = 2000;
    if (layout.offset) cam.setViewOffset(W, H, -layout.offset * W * (focusMode ? 0.6 : 1), 0, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }

  /* ---------------- pointer ---------------- */
  const pointer = { x: -1, y: -1, nx: 0, ny: 0, inside: false };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const so = {};
  function pickAt(px, py) {
    let best = null, bd = 1e9;
    for (const b of bots.values()) {
      screenOf(vv.set(b.x, b.y + b.height * 0.5, b.z), so);
      const s = W / (cam.right - cam.left) || 1;
      const dx = px - so.x, dy = py - so.y, rw = 8 * s, rh = b.height * 0.6 * s;
      if (Math.abs(dx) < rw && Math.abs(dy) < rh) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = b; } }
    }
    if (!best) for (const og of origs.values()) {
      screenOf(vv.set(og.pos.x, 16, og.pos.z), so);
      const s = W / (cam.right - cam.left) || 1;
      if (Math.abs(px - so.x) < 9 * s && Math.abs(py - so.y) < 16 * s) return { orig: og.wallet };
    }
    return best;
  }
  function floorAt(px, py) {
    ndc.set((px / W) * 2 - 1, -(py / H) * 2 + 1); ray.setFromCamera(ndc, cam);
    return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  }
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.inside = true;
    pointer.nx = (pointer.x / r.width) * 2 - 1; pointer.ny = (pointer.y / r.height) * 2 - 1;
    if (drag) { const dx = e.clientX - drag.x; drag.x = e.clientX; az -= dx * 0.006; azVel = -dx * 0.25; if (Math.abs(e.clientX - drag.x0) > 4) drag.moved = true; return; }
    const b = pickAt(pointer.x, pointer.y); hover = b && !b.orig ? b : null; hoverOrig = b && b.orig ? b.orig : null; canvas.style.cursor = b ? 'pointer' : 'grab';
  });
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; hover = null; hoverOrig = null; });
  let hoverOrig = null;
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; drag = { x: e.clientX, x0: e.clientX, moved: false, id: e.pointerId, type: e.pointerType }; if (e.pointerType === 'mouse') canvas.setPointerCapture(e.pointerId); });
  addEventListener('pointerup', (e) => {
    if (!drag) return; const d = drag; drag = null;
    if (d.moved) return;
    const r = canvas.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) return;
    const b = pickAt(x, y);
    if (b && b.orig) { const og = origs.get(b.orig); if (og) og.vy = 24; o.onOrig?.(b.orig); return; }
    if (b) { b.vy = 22; onPick?.(b.id); return; }
    const p = floorAt(x, y);
    if (p && Math.hypot(p.x, p.z) < FLOOR_R) {
      api.ping(p.x, p.z); o.onFloor?.();
      for (const b2 of bots.values()) if (Math.hypot(b2.x - p.x, b2.z - p.z) < 60) { pickTarget(b2, clampSpot(p.x + (R() - 0.5) * 20, p.z + (R() - 0.5) * 20)); b2.wait = R() * 0.3; b2.rush = 1; }
    }
  });
  canvas.addEventListener('pointercancel', () => (drag = null));
  function clampSpot(x, z) { for (let k = 0; k < 10; k++) { if (valid(x, z)) return { x, z }; x *= 0.92; z *= 0.92; if (Math.hypot(x, z) < TUBE_R + 16) { const a = Math.atan2(z, x); x = Math.cos(a) * (TUBE_R + 18); z = Math.sin(a) * (TUBE_R + 18); } } return { x, z }; }

  /* ---------------- tick ---------------- */
  let T = 0, ambient = 0;
  function tickBots(dt) {
    const party = document.body.classList.contains('party');
    for (const b of bots.values()) {
      if (b.fromTube) {
        const k = (b.fromTube.t += dt) / 1.1;
        if (k < 0.35) { b.g.visible = false; continue; }
        if (occupant && occupant.id === b.id && !occupant.leaving) { occupant.leaving = true; }
        b.g.visible = true;
        const q = clamp((k - 0.35) / 0.65, 0, 1);
        b.x = lerp(0, 0, q); b.z = lerp(0, TUBE_R + 22, q); b.y = 30 * (1 - q) + Math.sin(q * Math.PI) * 26;
        if (q >= 1) { b.fromTube = null; b.y = 0; b.vy = 18; pickTarget(b); if (occupant?.id === b.id) { setOccupant(null); bornId = null; api.showcaseNext = true; } }
        b.g.position.set(b.x, b.y, b.z); b.g.rotation.y = 0.2;
        continue;
      }
      if (b.blink > 0) b.blink -= dt; else if (R() < dt * 0.35) b.blink = 0.12;
      if (b.bubble) { b.bubble.t -= dt; if (b.bubble.t <= 0) b.bubble = null; }
      // gravity
      b.vy -= 120 * dt; b.y += b.vy * dt; if (b.y <= 0) { b.y = 0; b.vy = 0; }
      if (party && b.y === 0 && R() < dt * 2) b.vy = 26;
      if (b.spin > 0) b.spin = Math.max(0, b.spin - dt * 1.4);
      if (b.shake > 0) b.shake -= dt;
      b.moving = false;
      if (b.wait > 0) b.wait -= dt;
      else {
        const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
        const sp = b.speed * (b.rush ? 2.4 : 1) * (party ? 1.6 : 1);
        if (d < 1.5) { b.wait = b.rush ? 0.6 : 1 + R() * 5; b.rush = 0; pickTarget(b); b.look = R() < 0.5 ? Math.atan2(camDir.x, camDir.z) : b.face + (R() - 0.5) * 2; }
        else {
          b.x += (dx / d) * sp * dt; b.z += (dz / d) * sp * dt; b.moving = true; b.step += dt * sp * 0.22;
          b.look = Math.atan2(dx, dz);
        }
      }
      // turn toward where it's looking
      let df = b.look - b.face; df = Math.atan2(Math.sin(df), Math.cos(df)); b.face += df * Math.min(1, dt * 8);
      const bodyY = b.moving ? (Math.floor(b.step * 2) % 2) * 1 : 0;
      b.g.position.set(b.x, b.y, b.z);
      b.g.rotation.y = b.face + b.spin * TAU * 1 + (b.shake > 0 ? Math.sin(b.shake * 40) * 0.35 : 0);
      const ud = b.g.userData;
      ud.body.position.y = bodyY; ud.body.rotation.z = b.moving ? (Math.floor(b.step * 2) % 2 ? 0.04 : -0.04) : 0;
      if (ud.eyes) { ud.eyes.scale.y = b.blink > 0 ? 0.15 : 1; if (ud.eyes.userData.pupil) ud.eyes.userData.pupil.position.x = Math.sin(T * 0.8 + b.ph) * 0.8; }
      if (ud.visor) ud.visor.position.x = Math.sin(T * 3 + b.ph) * 5;
      // afterimages: the echo of the echo
      b.histT -= dt;
      if (b.histT <= 0) { b.histT = 0.05; b.hist.unshift({ x: b.x, y: b.y + bodyY, z: b.z, r: b.g.rotation.y }); if (b.hist.length > 8) b.hist.pop(); }
      const moveAmt = b.moving || b.y > 0.5 ? 1 : 0;
      b.ghostA = lerp(b.ghostA || 0, moveAmt, Math.min(1, dt * 6));
      b.ghosts.forEach((gm, i) => {
        const h = b.hist[Math.min(b.hist.length - 1, 2 + i * 3)];
        if (!h || b.ghostA < 0.05) { gm.visible = false; return; }
        gm.visible = true; gm.position.set(h.x, h.y, h.z); gm.rotation.y = h.r;
      });
    }
    ghostMats[0].opacity = 0.34; ghostMats[1].opacity = 0.26;
  }
  function tickOrigs(dt) {
    for (const og of origs.values()) {
      og.vy -= 120 * dt; og.bob = Math.max(0, og.bob + og.vy * dt); if (og.bob === 0) og.vy = 0;
      og.g.position.y = 2.4 + og.bob; og.g.rotation.y = Math.atan2(camDir.x, camDir.z) + Math.sin(T * 0.4 + og.ph) * 0.5;
      const bm = og.pad.userData.beam; bm.material.opacity = 0.045 + Math.min(1, og.flash) * 0.1; bm.material.color.set(og.flash > 0 ? '#5cf2a8' : '#8b6cff');
      og.flash = Math.max(0, og.flash - dt);
      og.padRing.material.color.set(og.flash > 0 ? '#5cf2a8' : '#8b6cff');
      if (og.say) { og.say.t -= dt; if (og.say.t <= 0) og.say = null; }
    }
  }
  function tickTube(dt) {
    // liquid
    const lvl = st.mode === 'scanning' ? Math.max(0.15, st.liquid - dt * 0.8) : st.mode === 'scanned' ? Math.min(0.4, st.liquid + dt) : st.mode === 'growing' ? Math.min(1, st.liquid + dt * 0.8) : Math.min(1, st.liquid + dt * 0.5);
    st.liquid = lvl;
    const lh = Math.max(0.5, (TUBE_H - 2) * lvl);
    liquid.scale.y = lh; liquid.position.y = 10 + lh / 2; surf.position.y = 10 + lh + Math.sin(T * 3) * 0.3;
    bub.forEach((b, i) => {
      b.y += b.v * dt; if (b.y > 10 + lh) { b.y = 10; b.x = (R() - 0.5) * 22; b.z = (R() - 0.5) * 22; }
      m4.compose(vv.set(b.x, b.y, b.z), qq.identity(), one.set(1, 1, 1)); bubbles.setMatrixAt(i, m4);
    });
    bubbles.instanceMatrix.needsUpdate = true;
    // glass lift when born
    st.open = Math.max(0, st.open - dt * 0.35);
    topG.position.y = Math.sin(Math.min(1, st.open) * Math.PI / 2) * 36;
    // occupant
    if (occupant) {
      const g = occupant.g;
      g.rotation.y += dt * (occupant.ghost ? 1.2 : 0.6);
      g.position.y = 14 + Math.sin(T * 2) * 1.2;
      if (occupant.ghost) g.visible = ((T * 8) | 0) % 7 !== 0;
      if (occupant.swap > 0) { occupant.swap -= dt * 2; g.visible = occupant.swap <= 0 || ((T * 30) | 0) % 2 === 0; }
      if (occupant.leaving) g.visible = false;
    }
    // idle showcase rotation
    if (st.mode === 'idle' && st.show.length && performance.now() > st.holdUntil && !bornId) {
      st.showT -= dt;
      if (st.showT <= 0 || api.showcaseNext) { api.showcaseNext = false; st.showI = (st.showI + 1) % st.show.length; setOccupant(st.show[st.showI], { html: occHtml(st.show[st.showI]) }); st.showT = 6; }
    }
    // zaps while growing
    zaps.forEach((z) => { tube.remove(z); z.geometry.dispose(); }); zaps.length = 0;
    if (st.mode === 'growing' && R() < 0.6) {
      for (const s of [-1, 1]) {
        const pts = []; const x0 = s * (TUBE_R + 4), y0 = 10 + TUBE_H * 0.7;
        for (let i = 0; i <= 6; i++) pts.push(new THREE.Vector3(lerp(x0, s * 3, i / 6) + (i && i < 6 ? (R() - 0.5) * 4 : 0), lerp(y0, 16 + R() * 26, i / 6) + (i && i < 6 ? (R() - 0.5) * 5 : 0), (R() - 0.5) * 6));
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), zapMat); l.layers.set(1); tube.add(l); zaps.push(l);
      }
    }
    if (assembly) {
      tickAssembly(dt);
      const p = Math.round((assembly.progress || 0) * 100);
      const i = occLabel.querySelector('i'); if (i) i.textContent = p + '%';
    }
    tubeLight.intensity = 2 + Math.sin(T * 2) * 0.3 + (st.mode === 'growing' ? 1.5 : 0);
    baseLights.forEach((l, i) => l.material.color.set(((T * 4 + i) | 0) % 12 === i % 12 ? '#ff4fa3' : st.mode === 'growing' ? '#5cf2a8' : '#2ee6ff'));
  }
  function tickScanner(dt) {
    const busy = st.mode === 'scanning';
    beamLights.forEach((l, i) => l.material.color.set(busy ? ((((T * 10) | 0) + i) % 2 ? '#ff4fa3' : '#2ee6ff') : i === ((T * 2) | 0) % 5 ? '#2ee6ff' : '#1f3f5c'));
    padRing.material.color.set(busy ? '#ff4fa3' : st.mode === 'idle' ? '#57538a' : '#2ee6ff');
    if (busy) {
      st.scan = Math.min(0.9, st.scan + dt * 0.42);
      const y = 3 + 24 * (1 - st.scan);
      laser.position.y = y; clip.constant = -(scanner.position.y + y);
      laser.material.opacity = 0.6 + Math.sin(T * 30) * 0.3;
    } else clip.constant = 1e4;
    if (scanHuman) { scanHuman.rotation.y = Math.sin(T * 0.8) * 0.4; scanHuman.position.y = 3 + (st.mode === 'scanned' ? Math.abs(Math.sin(T * 3)) * 0.8 : 0); }
    // packets along the pipe
    let n = 0;
    const c = new THREE.Color();
    for (const p of packetList) {
      p.t += dt * 0.55; if (p.t < 0) continue; if (p.t > 1) { p.t -= 1 + packetList.length * 0.06; continue; }
      const pt = pipeCurve.getPointAt(p.t);
      m4.compose(vv.set(pt.x, pt.y + 2.2, pt.z), qq.identity(), one.set(1, 1, 1)); packets.setMatrixAt(n, m4); packets.setColorAt(n, c.set(p.col).multiplyScalar(1.6)); n++;
      if (n >= 48) break;
    }
    packets.count = n; packets.instanceMatrix.needsUpdate = true; if (packets.instanceColor) packets.instanceColor.needsUpdate = true;
  }

  function tickLabels() {
    // echo tags + bubbles
    const placed = [];
    const place = (el, x, y, w, h) => {
      let cy = y - h / 2;
      for (let k = 0; k < 6; k++) { const hit = placed.find((r) => Math.abs(r.x - x) < (r.w + w) / 2 && Math.abs(r.y - cy) < (r.h + h) / 2); if (!hit) break; cy = hit.y - (hit.h + h) / 2 - 3; }
      placed.push({ x, y: cy, w, h }); el.style.transform = `translate(${Math.round(x)}px,${Math.round(cy + h / 2)}px) translate(-50%,-100%)`;
    };
    if (!occLabel.hidden) {
      screenOf(vv.set(0, topG.position.y + 10 + TUBE_H + 16, 0), so);
      occLabel.style.transform = `translate(${Math.round(so.x)}px,${Math.round(so.y)}px) translate(-50%,-100%)`;
      const w = occLabel.offsetWidth || 140, h = occLabel.offsetHeight || 60;
      placed.push({ x: so.x, y: so.y - h / 2, w: w + 8, h: h + 8 });
    }
    const sorted = [...bots.values()].sort((a, b) => (b.bubble ? 1 : 0) - (a.bubble ? 1 : 0));
    for (const b of sorted) {
      const rank = top3.indexOf(b.id);
      const wantTag = b.bubble || b === hover || b.id === spot || (rank >= 0 && alive > 1);
      if (!wantTag || !b.g.visible) { if (b.tagEl) { freeLabel(b.tagEl); b.tagEl = null; } continue; }
      if (!b.tagEl) b.tagEl = labelEl();
      const el = b.tagEl;
      screenOf(vv.set(b.x, b.y + b.height * 1.0 + 3, b.z), so);
      if (b.bubble) {
        el.className = 'lbl bub'; el.style.setProperty('--c', b.bubble.color);
        if (el._t !== b.bubble.text) { el.textContent = b.bubble.text; el._t = b.bubble.text; el._w = el.offsetWidth; }
      } else {
        el.className = 'lbl tag' + (b === hover ? ' hov' : '') + (rank === 0 ? ' r1' : '');
        const t = (rank >= 0 ? '#' + (rank + 1) + ' ' : '') + b.c.name.replace(/\.echo$/, '') + (b === hover ? ` ${b.c.pnlPct > 0 ? '+' : b.c.pnlPct < 0 ? '−' : ''}${Math.abs(b.c.pnlPct || 0).toFixed(1)}%` : '');
        if (el._t !== t) { el.textContent = t; el._t = t; el._w = el.offsetWidth; }
      }
      place(el, so.x, so.y, el._w || 80, 22);
    }
    // originals
    for (const og of origs.values()) {
      screenOf(vv.set(og.pos.x, 2.4 + og.bob + 28, og.pos.z), so);
      const el = og.label;
      el.className = 'lbl og' + (og.say ? ' say' : '');
      if (og.say) { el.style.setProperty('--c', og.say.color); const t = og.say.text; if (el._t !== t) { el.textContent = t; el._t = t; } }
      else { const t = og.wallet.slice(0, 4) + '…' + og.wallet.slice(-4) + (hoverOrig === og.wallet ? ' · read it' : ''); if (el._t !== t) { el.textContent = t; el._t = t; } el.classList.toggle('hov', hoverOrig === og.wallet); }
      el.style.transform = `translate(${Math.round(so.x)}px,${Math.round(so.y)}px) translate(-50%,-100%)`;
    }
  }

  function tick(dt) {
    T += dt;
    placeCamera(dt);
    tickBots(dt); tickOrigs(dt); tickTube(dt); tickScanner(dt); tickRings(dt); tickBeams(dt);
    if (spotT > 0) spotT -= dt; else spot = null;
    // ambient sonar: the chamber itself echoes every few seconds
    ambient -= dt;
    if (ambient <= 0 && !RM) { ambient = 3.2; ring(0, 0, COL.cyan, { r0: TUBE_R + 8, r1: FLOOR_R + 6, life: 3, y: 0.25, width: 0.012 }); ring(0, 0, COL.pink, { r0: TUBE_R + 8, r1: FLOOR_R, life: 3, y: 0.2, delay: 0.3, width: 0.01 }); }
    monoStrips.forEach((s, i) => { if (s.material.opacity !== undefined && i % 5 === 0) s.material.opacity = 0.6 + Math.sin(T * 1.3 + i) * 0.35; });
    dust.rotation.y += dt * 0.01;
    for (const m of monos) m.visible = m.position.x * camDir.x + m.position.z * camDir.z < -60;
    if (st.flash > 0) st.flash -= dt * 1.5; else if (st.flash < 0) st.flash = Math.min(0, st.flash + dt * 1.5);
    bloom.strength = 0.62 + Math.max(0, st.flash) * 0.5;
    if (!visible) return;
    composer.render(dt);
    tickLabels();
  }
  return api;
}
