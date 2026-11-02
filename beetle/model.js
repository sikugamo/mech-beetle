// Dynastes RB-1, the geometry. Everything is built from code against the concept sheet (reference/concept-sheet.jpg):
// an ivory shell in bolted panels over a black mechanical core, gold bushings at every joint, orange actuator rings,
// a black cephalic horn and thoracic spike, six four-segment legs and two hind wings folded in two under the elytra.
// update(state) poses every part from the kinematics (kin.js) and the operator's switches; nothing is keyframed.
import * as THREE from 'three';
import {BODY, ELYTRA_MAX, HORN, SEG, WING} from './kin.js';
import {between, boltM, G, gearGeo, Part, partCount, shellPatch, sweep, T, V3} from './parts.js';

const PI = Math.PI;
export const SYSTEMS = ['shell', 'wing', 'thorax', 'leg', 'actuator', 'frame'];

// ------------------------------------------------------------ materials
function materials() {
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    ivory: phys({color: '#ebe4d6', roughness: 0.46, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.35, envMapIntensity: 0.55}),
    ivory2: phys({color: '#ddd5c6', roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.5}),
    black: phys({color: '#141518', roughness: 0.34, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.2}),
    blackM: std({color: '#1d1f23', roughness: 0.6, metalness: 0.2}),
    gun: std({color: '#3a3e45', roughness: 0.42, metalness: 0.65}),
    steel: std({color: '#c3c7cd', roughness: 0.26, metalness: 1}),
    gold: std({color: '#b88d4a', roughness: 0.3, metalness: 0.95}),
    orange: phys({color: '#e6582b', roughness: 0.4, metalness: 0, clearcoat: 0.4, emissive: '#e6582b', emissiveIntensity: 0.08}),
    glow: std({color: '#ff7a3a', emissive: '#ff6a2a', emissiveIntensity: 3.2, roughness: 0.3}),
    lens: phys({color: '#08090b', roughness: 0.06, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03}),
    debrisOrange: std({color: '#e6582b', roughness: 0.45}),
    ring: new THREE.MeshBasicMaterial({color: '#2b2622', transparent: true, opacity: 0, depthWrite: false}),
    ringAccent: new THREE.MeshBasicMaterial({color: '#e6582b', transparent: true, opacity: 0, depthWrite: false}),
  };
}

// the elytra's markings, painted in the patch's (u, v) space; the right side is drawn mirrored so the text reads
function decalTexture(side) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#ebe4d6';
  g.fillRect(0, 0, 1024, 512);
  // faint mottling so big panels are not flat plastic
  let s = 7 + side;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(120,105,80,${0.012 + r() * 0.02})`;
    g.fillRect(r() * 1024, r() * 512, 2 + r() * 5, 2 + r() * 5);
  }
  // engraved lines
  g.strokeStyle = 'rgba(60,52,40,.35)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(80, 300);
  g.lineTo(520, 300);
  g.lineTo(560, 340);
  g.moveTo(640, 150);
  g.lineTo(900, 150);
  g.stroke();
  // the number and the bars, as on the sheet
  g.fillStyle = 'rgba(40,36,30,.86)';
  g.font = '600 92px Inter, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(side > 0 ? '01' : '02', 470, 228);
  g.fillRect(600, 182, 9, 92);
  g.fillRect(616, 182, 9, 92);
  // the orange warning triangle
  g.fillStyle = '#e6582b';
  g.beginPath();
  g.moveTo(330, 196);
  g.lineTo(374, 196);
  g.lineTo(352, 236);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(40,36,30,.6)';
  g.font = '600 15px "JetBrains Mono", monospace';
  g.fillText('RB-1 · DYNASTES · 4.2 KG MAX', 470, 300);
  g.fillText('DO NOT STEP', 700, 380);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// hind wing membrane: amber film, a network of veins radiating from the root, cross veins between them
function wingTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, 'rgba(236,196,128,.78)');
  gr.addColorStop(0.35, 'rgba(240,206,146,.6)');
  gr.addColorStop(1, 'rgba(244,222,176,.42)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 1024, 512);
  // u runs root to tip (x), v leading edge (top) to trailing edge (bottom)
  g.strokeStyle = 'rgba(84,52,18,.9)';
  g.lineCap = 'round';
  const veins = [];
  for (let k = 0; k < 7; k++) {
    const yEnd = 40 + k * 72;
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      const x = 20 + u * (920 - k * 40);
      const y = 60 + (yEnd - 60) * Math.pow(u, 0.8) + 10 * Math.sin(u * 7 + k);
      pts.push([x, y]);
    }
    veins.push(pts);
    g.lineWidth = k === 0 ? 7 : 3.2 - k * 0.25;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  }
  g.lineWidth = 1.6;
  g.strokeStyle = 'rgba(96,62,24,.7)';
  for (let k = 0; k < veins.length - 1; k++)
    for (let i = 3; i < 20; i += 2 + (k % 2)) {
      const a = veins[k][i];
      const b = veins[k + 1][Math.min(20, i + 1)];
      g.beginPath();
      g.moveTo(...a);
      g.lineTo(...b);
      g.stroke();
    }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ------------------------------------------------------------ shapes of the shell
const EL = {xc: -0.115, a: 0.258, b: 0.132, c: 0.156, yb: 0.004, thMax: 1.5};
const ELX0 = BODY.elytraFront;
const ELX1 = EL.xc - EL.a * 0.985;
const elyK = (x) => Math.sqrt(Math.max(0, 1 - ((x - EL.xc) / EL.a) ** 2));
const elyFn = (side) => (u, th) => {
  const x = ELX0 + (ELX1 - ELX0) * u;
  const k = elyK(x);
  // a little fuller at the shoulders than an ellipse
  const kk = Math.pow(k, 0.92);
  return [x, EL.yb + EL.c * kk * Math.cos(th), side * EL.b * kk * Math.sin(th)];
};
const PR = {xc: 0.07, a: 0.118, b: 0.118, c: 0.124, yb: -0.004, x0: 0.03, x1: 0.183};
const proFn = (u, th) => {
  const x = PR.x0 + (PR.x1 - PR.x0) * u;
  const k = Math.pow(Math.sqrt(Math.max(0, 1 - ((x - PR.xc) / PR.a) ** 2)), 0.7);
  // the front lip drops a little over the head
  const y = PR.yb + PR.c * k * Math.cos(th) - 0.012 * Math.max(0, u - 0.7);
  return [x, y, PR.b * k * Math.sin(th)];
};
/** Half width of the body at x, at the skirt line (for the machinery band and the hips). */
export const halfWidthAt = (x) => EL.b * Math.pow(elyK(Math.min(ELX0, Math.max(ELX1, x))), 0.92);

// ------------------------------------------------------------ the build
export function buildBeetle() {
  const M = materials();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const parts = [];
  const bySys = Object.fromEntries(SYSTEMS.map((s) => [s, []]));
  const anchors = {};
  const reg = (part, parent, sys, o = {}) => {
    const g = part.build();
    if (o.at) g.position.set(...o.at);
    parent.add(g);
    let box = new THREE.Box3();
    for (const m of g.children) {
      box = box.union(new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position));
      bySys[sys].push(m);
    }
    parts.push({g, sys, base: g.position.clone(), baseQ: g.quaternion.clone(), centre: box.getCenter(new V3()), dist: o.dist ?? 0.3, delay: o.delay ?? 0, spin: o.spin ?? 0.6, axis: new V3(Math.sin(parts.length * 2.3), Math.cos(parts.length * 1.7), Math.sin(parts.length * 0.9)).normalize(), dir: o.dir ? new V3(...o.dir).normalize() : null});
    return g;
  };
  const anchor = (name, parent, p) => {
    const o = new THREE.Object3D();
    o.position.set(...p);
    parent.add(o);
    anchors[name] = o;
    return o;
  };
  // delays: the outermost layer leaves first, so nothing passes through anything
  const D = {shell: 0, wing: 0.05, thorax: 0.1, leg: 0.16, actuator: 0.22, frame: 0.28};
  const XS = 0.8; // teardown spread
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ============================================================ ELYTRA (shell)
  const decal = {1: decalTexture(1), [-1]: decalTexture(-1)};
  const elytra = {};
  for (const side of [-1, 1]) {
    const mat = M.ivory.clone();
    mat.color.set('#ffffff');
    mat.map = decal[side];
    const fn = elyFn(side);
    const crownFront = fn(0, 0);
    const pivotPos = [ELX0, crownFront[1] - 0.004, side * 0.004];
    const pivot = new THREE.Group();
    pivot.position.set(...pivotPos);
    body.add(pivot);
    const toPivot = T(-pivotPos[0], -pivotPos[1], -pivotPos[2]);
    const uc = [0, 0.37, 0.7, 0.985];
    const tc = [0.012, 0.92, EL.thMax];
    const gu = 0.0055;
    const gt = 0.014;
    const uvf = (u, th) => [side > 0 ? 1 - u : u, 1 - th / EL.thMax];
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 2; b++) {
        const u0 = uc[a] + (a ? gu : 0.002);
        const u1 = uc[a + 1] - (a < 2 ? gu : 0);
        const t0 = tc[b] + (b ? gt : 0);
        const t1 = tc[b + 1] - (b ? 0 : gt);
        const sh = shellPatch(fn, u0, u1, t0, t1, Math.max(6, Math.round((u1 - u0) * 44)), Math.max(6, Math.round((t1 - t0) * 11)), 0.0065, [EL.xc, EL.yb - 0.02, 0], uvf);
        const p = new Part(`elytron${side}-${a}${b}`);
        p.add(sh.outer, mat, toPivot);
        p.add(sh.inner, M.blackM, toPivot);
        // bolts near the panel corners
        for (const [uu, tt] of [[u0 + 0.025, t0 + 0.07], [u1 - 0.025, t0 + 0.07], [u0 + 0.025, t1 - 0.07], [u1 - 0.025, t1 - 0.07]]) {
          if (uu > 0.95) continue;
          const q = fn(uu, tt);
          const q2 = fn(uu, tt + 0.01);
          const q3 = fn(uu + 0.01, tt);
          const n = new V3(...q2).sub(new V3(...q)).cross(new V3(...q3).sub(new V3(...q))).normalize();
          if (n.dot(new V3(q[0] - EL.xc, q[1], q[2])) < 0) n.negate();
          p.add(G.hex(), (a + b) % 2 ? M.gold : M.black, new THREE.Matrix4().multiplyMatrices(toPivot, boltM(q, n.toArray())));
        }
        const g = reg(p, pivot, 'shell', {dist: 0.36 + rnd() * 0.12, delay: D.shell + rnd() * 0.04, spin: 0.9});
        if (a === 1 && b === 1) anchor(`elytron${side}`, g, new V3(...fn(0.5, 1.2)).sub(new V3(...pivotPos)).toArray());
      }
    // the suture: a dark trim along the inner edge of the elytron
    {
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const q = fn((i / 12) * 0.96, 0.006);
        pts.push([q[0] - pivotPos[0], q[1] - pivotPos[1] + 0.002, q[2] - pivotPos[2]]);
      }
      const p = new Part(`suture${side}`);
      p.add(sweep(pts, 0.0042, 48, 8).geo, M.gun);
      for (let i = 1; i < 6; i++) {
        const q = fn(i * 0.15, 0.006);
        p.add(G.cylX(12), M.gold, T(q[0] - pivotPos[0], q[1] - pivotPos[1] + 0.003, q[2] - pivotPos[2], 0, 0, 0, [0.008, 0.0055, 0.0055]));
      }
      reg(p, pivot, 'shell', {dist: 0.4, delay: D.shell, spin: 0.4});
    }
    elytra[side] = pivot;
  }

  // ============================================================ ABDOMEN CORE (frame) under the shell
  {
    const p = new Part('abdomen');
    p.add(G.sphere(36, 20), M.blackM, T(-0.115, 0.0, 0, 0, 0, 0, [0.205, 0.105, 0.128]));
    // transverse ribs over the core
    for (let i = 0; i < 6; i++) {
      const x = -0.27 + i * 0.05;
      const k = Math.sqrt(Math.max(0.05, 1 - ((x + 0.115) / 0.205) ** 2));
      p.add(G.torus(0.08), M.gun, T(x, 0.0, 0, 0, PI / 2, 0, [0.132 * k, 0.108 * k, 0.12]));
    }
    // dorsal spine
    p.add(sweep([[0.03, 0.098, 0], [-0.08, 0.108, 0], [-0.2, 0.09, 0], [-0.29, 0.05, 0]], 0.009, 40, 10).geo, M.gun);
    for (let i = 0; i < 7; i++) {
      const x = 0.0 - i * 0.04;
      const y = 0.1 + 0.008 * Math.cos((x + 0.08) * 8) - Math.max(0, -x - 0.18) * 0.4;
      p.add(G.cylX(14), M.gold, T(x, y, 0, 0, 0, 0, [0.006, 0.013, 0.013]));
    }
    reg(p, body, 'frame', {dist: 0.04, delay: D.frame, spin: 0.05});
  }
  // tergites: overlapping armour plates over the core's back, seen when the elytra open
  {
    const ab = (x0, x1) => (u, th) => {
      const x = x0 + (x1 - x0) * u;
      const k = Math.sqrt(Math.max(0.02, 1 - ((x + 0.115) / 0.212) ** 2));
      return [x, 0.002 + 0.112 * k * Math.cos(th), 0.134 * k * Math.sin(th)];
    };
    for (let i = 0; i < 6; i++) {
      const x1 = 0.02 - i * 0.05;
      const x0 = x1 - 0.056;
      const fn = ab(x0, x1);
      const sh = shellPatch(fn, 0, 1, -1.15, 1.15, 8, 14, 0.004, [-0.115, -0.05, 0]);
      const p = new Part(`tergite${i}`);
      p.add(sh.outer, i % 2 ? M.gun : M.blackM);
      p.add(sh.inner, M.blackM);
      for (const th of [-0.8, 0.8]) {
        const q = fn(0.75, th);
        p.add(G.hex(), M.gold, boltM(q, [0, Math.cos(th), Math.sin(th)], 0.0045, 0.003));
      }
      if (i % 2 === 0) p.add(G.rbox(0.3), M.orange, T(...fn(0.6, 0), 0, 0, 0, [0.012, 0.004, 0.03]));
      reg(p, body, 'frame', {dist: 0.2, delay: D.frame - 0.04, spin: 0.5, dir: [0, 1, (i % 2 ? 0.3 : -0.3)]});
    }
  }
  // cable bundles along the back, visible when the elytra open
  for (const side of [-1, 1]) {
    const p = new Part(`cables${side}`);
    for (let k = 0; k < 3; k++) {
      const z = side * (0.03 + k * 0.012);
      const pts = [[0.035, 0.094, z], [-0.05, 0.124 - k * 0.003, z * 1.2], [-0.15, 0.115 - k * 0.004, z * 1.25], [-0.25, 0.075 - k * 0.003, z]];
      p.add(sweep(pts, 0.0034, 36, 6).geo, k === 1 ? M.orange : M.black);
    }
    for (let i = 0; i < 4; i++) {
      const x = -0.03 - i * 0.06;
      p.add(G.cylX(12), M.gold, T(x, 0.124 - i * 0.01, side * 0.042, 0, 0, 0, [0.006, 0.012, 0.03]));
    }
    reg(p, body, 'frame', {dist: 0.18, delay: D.frame, spin: 0.2});
  }

  // ============================================================ MACHINERY BAND under the skirt (actuator)
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const x = -0.29 + i * 0.044;
      const w = halfWidthAt(x);
      const z = side * w * 0.9;
      const big = i % 2 === 0;
      const r = big ? 0.025 : 0.019;
      const p = new Part(`band${side}-${i}`);
      const zz = (d) => z + side * d;
      // a servo can lying across the body, a gold rim, a cap
      const y = -0.008;
      p.add(G.cylZ(28), M.black, T(x, y, zz(0), 0, 0, 0, [r, r, 0.034]));
      p.add(G.cylZ(28), M.gold, T(x, y, zz(0.018), 0, 0, 0, [r * 0.82, r * 0.82, 0.005]));
      p.add(G.cylZ(20), i % 3 === 1 ? M.orange : M.gun, T(x, y, zz(0.022), 0, 0, 0, [r * 0.42, r * 0.42, 0.006]));
      p.add(G.hex(), M.steel, T(x, y, zz(0.026), PI / 2, 0, 0, [r * 0.18, 0.004, r * 0.18]));
      p.add(G.cylZ(20), M.gold, T(x + 0.022, y + 0.014, zz(0.004), 0, 0, 0, [0.008, 0.008, 0.03]));
      if (!big) p.add(gearGeo(0.022, 14, 0.006, 0.3), M.gold, T(x + 0.012, y + 0.008, zz(-0.012), 0, 0, i));
      else p.add(gearGeo(0.016, 12, 0.005, 0.3), M.gun, T(x - 0.014, y + 0.016, zz(0.02), 0, 0, i));
      // linkage bar to the next can
      p.add(G.rbox(0.3), M.gun, T(x + 0.022, y - 0.016, zz(0.008), 0, 0, 0.2 * side, [0.044, 0.008, 0.006]));
      reg(p, body, 'actuator', {dist: 0.22 + rnd() * 0.12, delay: D.actuator + rnd() * 0.05, spin: 1.2, dir: [rnd() - 0.5, rnd() * 0.6 - 0.3, side * 1.2]});
    }
  }
  // ventral plate with the six hip mounts
  {
    const p = new Part('ventral');
    p.add(G.rbox(0.15), M.gun, T(-0.02, -0.046, 0, 0, 0, 0, [0.3, 0.018, 0.15]));
    p.add(G.rbox(0.2), M.blackM, T(-0.21, -0.03, 0, 0, 0, 0.18, [0.16, 0.03, 0.17]));
    for (let k = 0; k < 5; k++) p.add(G.hex(), M.gold, T(-0.13 + k * 0.05, -0.056, 0, 0, 0, 0, [0.006, 0.004, 0.006]));
    reg(p, body, 'frame', {dist: 0.12, delay: D.frame, spin: 0.1, dir: [0, -1, 0]});
  }

  // ============================================================ PRONOTUM, THORACIC SPIKE (thorax)
  {
    const ranges = [[-1.6, -0.44], [-0.42, 0.42], [0.44, 1.6]];
    ranges.forEach(([t0, t1], k) => {
      const sh = shellPatch(proFn, 0.0, 0.98, t0 + 0.006, t1 - 0.006, 22, 16, 0.0065, [PR.xc, PR.yb - 0.03, 0]);
      const p = new Part(`pronotum${k}`);
      p.add(sh.outer, k === 1 ? M.ivory2 : M.ivory);
      p.add(sh.inner, M.blackM);
      for (const [u, th] of [[0.2, t0 + 0.06], [0.2, t1 - 0.06], [0.75, t0 + 0.06], [0.75, t1 - 0.06]]) {
        const q = proFn(u, th);
        const n = new V3(q[0] - PR.xc, q[1] - PR.yb + 0.03, q[2]).normalize();
        p.add(G.hex(), M.gold, boltM(q, n.toArray()));
      }
      if (k === 1) {
        // the thoracic spike, black, up and forward off the front of the shield
        const top = proFn(0.62, 0);
        const s = sweep([[top[0] - 0.02, top[1] - 0.012, 0], [top[0] + 0.02, top[1] + 0.01, 0], [top[0] + 0.05, top[1] + 0.05, 0], [top[0] + 0.058, top[1] + 0.098, 0]], (u) => 0.019 * Math.pow(1 - u, 0.9) + 0.0016, 36, 14);
        p.add(s.geo, M.black);
        p.add(G.torus(0.22), M.gold, T(top[0] + 0.014, top[1] + 0.007, 0, PI / 2, 0.75, 0, [0.0175, 0.0175, 0.0175]));
        p.add(G.rbox(0.4), M.ivory, T(top[0] - 0.01, top[1] - 0.004, 0, 0, 0, -0.35, [0.05, 0.016, 0.044]));
      }
      const g = reg(p, body, 'thorax', {dist: 0.34 + rnd() * 0.1, delay: D.thorax, spin: 0.7});
      if (k === 1) anchor('spike', g, (() => {
        const top = proFn(0.62, 0);
        return [top[0] + 0.05, top[1] + 0.07, 0];
      })());
    });
    // neck block under the shield
    const p = new Part('neck');
    p.add(G.cylX(24), M.gun, T(0.16, -0.006, 0, 0, 0, 0, [0.07, 0.05, 0.05]));
    p.add(G.cylX(24), M.gold, T(0.135, -0.006, 0, 0, 0, 0, [0.006, 0.054, 0.054]));
    p.add(G.cylX(24), M.orange, T(0.145, -0.006, 0, 0, 0, 0, [0.004, 0.052, 0.052]));
    reg(p, body, 'thorax', {dist: 0.16, delay: D.thorax + 0.05, spin: 0.2});
  }

  // ============================================================ HEAD, CEPHALIC HORN (thorax)
  const head = new THREE.Group();
  head.position.set(0.168, -0.004, 0);
  body.add(head);
  {
    const p = new Part('headCapsule');
    p.add(G.sphere(28, 18), M.gun, T(0.035, -0.004, 0, 0, 0, 0, [0.062, 0.046, 0.072]));
    p.add(G.sphere(24, 16), M.black, T(0.058, -0.016, 0, 0, 0, 0, [0.044, 0.03, 0.05]));
    // eyes: black glass in gold rings, an orange iris that glows
    for (const side of [-1, 1]) {
      p.add(G.sphere(24, 16), M.lens, T(0.052, 0.008, side * 0.053, 0, 0, 0, 0.0185));
      p.add(G.torus(0.16), M.gold, T(0.052, 0.008, side * 0.058, 0, side * 0.25, 0, 0.0175));
      p.add(G.sphere(12, 8), M.glow, T(0.06, 0.009, side * 0.0685, 0, 0, 0, [0.0045, 0.0045, 0.0025]));
      // mandibles
      p.add(sweep([[0.08, -0.028, side * 0.022], [0.1, -0.034, side * 0.026], [0.114, -0.036, side * 0.016], [0.118, -0.033, side * 0.006]], (u) => 0.007 * (1 - u) + 0.0015, 20, 8).geo, M.black);
    }
    const g = reg(p, head, 'thorax', {dist: 0.28, delay: D.thorax + 0.03, spin: 0.5, dir: [1, 0.2, 0]});
    anchor('eye', g, [0.06, 0.01, -0.06]);
  }
  // antennae: a gold socket, a chain of black beads, a lamellate club
  for (const side of [-1, 1]) {
    const p = new Part(`antenna${side}`);
    p.add(G.sphere(12, 8), M.gold, T(0.074, -0.004, side * 0.044, 0, 0, 0, 0.0065));
    for (let i = 1; i <= 6; i++) p.add(G.sphere(12, 8), M.black, T(0.074 + i * 0.008, -0.004 - i * 0.0035, side * (0.044 + i * 0.0065), 0, 0, 0, [0.005, 0.0042, 0.0042]));
    for (let i = 0; i < 3; i++) p.add(G.cylZ(16), i === 1 ? M.orange : M.black, T(0.13, -0.026 + i * 0.006, side * 0.087, PI / 2, 0, 0, [0.009, 0.009, 0.0028]));
    reg(p, head, 'thorax', {dist: 0.32, delay: D.thorax + 0.04, spin: 1.4});
  }
  // the horn, swept along a curve with a tapering radius, ivory armour sleeves at its root, gold bands
  const hornPts = [[0.05, 0.004, 0], [0.11, 0.022, 0], [0.165, 0.07, 0], [0.198, 0.145, 0], [0.19, 0.222, 0], [0.148, 0.268, 0]];
  const hornR = (u) => 0.036 * Math.pow(1 - u, 1.1) + 0.0022;
  {
    const p = new Part('horn');
    const s = sweep(hornPts, hornR, 80, 18);
    p.add(s.geo, M.black);
    for (const u of [0.3, 0.33]) {
      const c = s.curve.getPointAt(u);
      const tng = s.curve.getTangentAt(u);
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), tng);
      const r = hornR(u) * 1.04;
      p.add(G.torus(0.16), M.gold, new THREE.Matrix4().compose(c, q, new V3(r, r, r)));
    }
    // a tooth on the inner curve
    const c = s.curve.getPointAt(0.55);
    p.add(G.cone(), M.black, T(c.x - 0.012, c.y + 0.004, 0, 0, 0, 1.9, [0.006, 0.026, 0.006]));
    const g = reg(p, head, 'thorax', {dist: 0.42, delay: D.thorax, spin: 0.5, dir: [0.6, 1, 0]});
    anchor('hornTip', g, s.curve.getPointAt(0.82).toArray());
    anchor('hornMid', g, s.curve.getPointAt(0.45).toArray());
    // the sleeves: two ivory collars split by a gap, over the horn's first quarter
    const p2 = new Part('hornArmour');
    for (const [a, b] of [[0.0, 0.13], [0.145, 0.25]]) {
      const pts = [];
      for (let i = 0; i <= 6; i++) pts.push(s.curve.getPointAt(a + ((b - a) * i) / 6).toArray());
      p2.add(sweep(pts, (u) => hornR(a + (b - a) * u) * 1.28, 24, 18).geo, M.ivory);
    }
    const c2 = s.curve.getPointAt(0.135);
    p2.add(G.torus(0.2), M.orange, new THREE.Matrix4().compose(c2, new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), s.curve.getTangentAt(0.135)), new V3(hornR(0.135) * 1.2, hornR(0.135) * 1.2, hornR(0.135) * 1.2)));
    reg(p2, head, 'thorax', {dist: 0.3, delay: D.thorax + 0.02, spin: 0.6, dir: [1, 0.4, 0]});
  }

  // ============================================================ LEGS (leg)
  // each segment is built along +x from its proximal joint; y is the top of the bone, z the leg plane's normal
  const legs = [];
  const joint = (p, x, r, len, ring = true) => {
    p.add(G.cylZ(28), M.black, T(x, 0, 0, 0, 0, 0, [r, r, len]));
    p.add(G.cylZ(28), M.gold, T(x, 0, len * 0.5, 0, 0, 0, [r * 0.78, r * 0.78, 0.004]));
    p.add(G.cylZ(28), M.gold, T(x, 0, -len * 0.5, 0, 0, 0, [r * 0.78, r * 0.78, 0.004]));
    p.add(G.hex(), M.steel, T(x, 0, len * 0.5 + 0.002, PI / 2, 0, 0, [r * 0.3, 0.003, r * 0.3]));
    if (ring) p.add(G.cylZ(28), M.orange, T(x, 0, len * 0.2, 0, 0, 0, [r * 1.03, r * 1.03, 0.0035]));
  };
  for (let i = 0; i < 6; i++) {
    const front = i % 3 === 0;
    const segs = {};
    // coxa: the hip servo, vertical
    {
      const g = new THREE.Group();
      body.add(g);
      const p = new Part(`coxa${i}`);
      p.add(G.cyl(28), M.black, T(0, 0, 0, 0, 0, 0, [0.021, 0.032, 0.021]));
      p.add(G.cyl(28), M.gold, T(0, 0.017, 0, 0, 0, 0, [0.017, 0.004, 0.017]));
      p.add(G.cyl(28), M.gold, T(0, -0.017, 0, 0, 0, 0, [0.017, 0.004, 0.017]));
      p.add(G.rbox(0.3), M.gun, T(SEG.coxa * 0.5, 0, 0, 0, 0, 0, [SEG.coxa, 0.02, 0.026]));
      p.add(G.rbox(0.35), M.ivory, T(SEG.coxa * 0.45, 0.012, 0, 0, 0, 0, [SEG.coxa * 0.9, 0.01, 0.03]));
      reg(p, g, 'leg', {dist: 0.2, delay: D.leg + 0.04, spin: 0.6});
      segs.coxa = g;
    }
    // femur: black spar, ivory armour, a hydraulic ram underneath, the hip-pitch servo at its root
    {
      const g = new THREE.Group();
      body.add(g);
      const L = SEG.femur;
      const p = new Part(`femur${i}`);
      joint(p, 0, 0.022, 0.04);
      p.add(G.rbox(0.3), M.black, T(L * 0.5, 0, 0, 0, 0, 0, [L * 0.88, 0.022, 0.018]));
      p.add(G.rbox(0.42), M.ivory, T(L * 0.52, 0.01, 0, 0, 0, 0, [L * 0.72, 0.036, 0.04]));
      p.add(G.rbox(0.42), M.ivory2, T(L * 0.5, 0.03, 0, 0, 0, 0, [L * 0.46, 0.012, 0.03]));
      p.add(G.rbox(0.3), M.black, T(L * 0.52, 0.01, 0.0205, 0, 0, 0, [L * 0.5, 0.012, 0.002]));
      p.add(G.cylX(14), M.black, T(0.05, -0.02, 0, 0, 0, 0, [0.05, 0.0078, 0.0078]));
      p.add(G.cylX(10), M.steel, T(0.09, -0.02, 0, 0, 0, 0, [0.04, 0.0036, 0.0036]));
      p.add(G.cylZ(14), M.gold, T(0.022, -0.02, 0, 0, 0, 0, [0.0055, 0.0055, 0.018]));
      p.add(G.cylZ(14), M.gold, T(0.112, -0.02, 0, 0, 0, 0, [0.0055, 0.0055, 0.018]));
      for (const x of [0.04, 0.065, 0.09]) p.add(G.hex(), M.gold, T(x, 0.037, 0, 0, 0, 0, [0.0034, 0.003, 0.0034]));
      const pg = reg(p, g, 'leg', {dist: 0.26, delay: D.leg + 0.02, spin: 0.7});
      if (i === 0) anchor('femurL1', pg, [L * 0.55, 0.03, 0]);
      segs.femur = g;
    }
    // tibia: knee servo, long ivory shin plate, spurs
    {
      const g = new THREE.Group();
      body.add(g);
      const L = SEG.tibia;
      const p = new Part(`tibia${i}`);
      joint(p, 0, 0.02, 0.038);
      p.add(G.rbox(0.3), M.black, T(L * 0.52, 0, 0, 0, 0, 0, [L * 0.9, 0.018, 0.015]));
      p.add(G.rbox(0.42), M.ivory, T(L * 0.4, 0.005, 0, 0, 0, 0, [L * 0.62, 0.032, 0.034]));
      p.add(G.rbox(0.4), front ? M.ivory2 : M.ivory, T(L * 0.78, 0.003, 0, 0, 0, 0, [L * 0.22, 0.022, 0.026]));
      p.add(G.cylZ(16), M.gold, T(L * 0.66, 0.0, 0, 0, 0, 0, [0.006, 0.006, 0.036]));
      for (const x of [0.075, 0.098, 0.12]) p.add(G.cone(), M.black, T(x, -0.011, 0, 0, 0, PI * 0.72, [0.0034, 0.013, 0.0034]));
      if (front) for (const x of [0.11, 0.124]) p.add(G.cone(), M.black, T(x, 0.004, 0.012, 0, 0, -0.3, [0.003, 0.015, 0.003]));
      p.add(G.cylZ(16), M.gold, T(L, 0, 0, 0, 0, 0, [0.0085, 0.0085, 0.02]));
      const pg = reg(p, g, 'leg', {dist: 0.3, delay: D.leg, spin: 0.8});
      if (i === 0) anchor('kneeL1', pg, [0, 0.02, 0]);
      segs.tibia = g;
    }
    // tarsus: four beads on gold rings and a pair of hooked claws
    {
      const g = new THREE.Group();
      body.add(g);
      const L = SEG.tarsus;
      const p = new Part(`tarsus${i}`);
      for (let k = 0; k < 4; k++) {
        const x = 0.011 + k * 0.0185;
        p.add(G.sphere(14, 10), M.black, T(x, 0, 0, 0, 0, 0, [0.0115, 0.0068 - k * 0.0006, 0.0068 - k * 0.0006]));
        p.add(G.cylX(14), M.gold, T(x + 0.009, 0, 0, 0, 0, 0, [0.0025, 0.0052, 0.0052]));
      }
      for (const s of [-1, 1]) p.add(sweep([[0.074, 0, s * 0.003], [0.083, 0.001, s * 0.007], [0.09, -0.004, s * 0.009], [0.091, -0.012, s * 0.008]], (u) => 0.0032 * (1 - u) + 0.0007, 16, 7).geo, M.black);
      const pg = reg(p, g, 'leg', {dist: 0.32, delay: D.leg + 0.01, spin: 1.0});
      if (i === 0) anchor('clawL1', pg, [0.085, -0.004, 0]);
      segs.tarsus = g;
    }
    legs.push(segs);
  }

  // ============================================================ HIND WINGS (wing) and their root drives (actuator)
  const wingTex = wingTexture();
  const membrane = new THREE.MeshStandardMaterial({map: wingTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.32, metalness: 0, emissive: '#5a3a10', emissiveIntensity: 0.22, envMapIntensity: 0.7});
  // the panels in (span s, chord c): c > 0 toward the head
  const WK = 1.4;
  const sc = (pts) => pts.map(([s, c]) => [s * WK, c * WK]);
  const BASE = sc([[0, 0.012], [0.05, 0.02], [0.15, 0.03], [0.15, -0.086], [0.09, -0.084], [0.03, -0.06], [0, -0.02]]);
  const TIP = sc([[0, 0.03], [0.06, 0.03], [0.11, 0.018], [0.145, -0.012], [0.15, -0.045], [0.12, -0.078], [0.06, -0.09], [0, -0.086]]);
  const panelGeo = (pts, s0, side) => {
    const shape = new THREE.Shape(pts.map(([s, c]) => new THREE.Vector2(s, c)));
    const g = new THREE.ShapeGeometry(shape, 8);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let k = 0; k < pos.count; k++) {
      const s = pos.getX(k);
      const c = pos.getY(k);
      uv.setXY(k, (s + s0) / WING.span, 1 - (0.035 * WK - c) / (0.13 * WK));
      pos.setXYZ(k, c, 0, side * s);
    }
    g.computeVertexNormals();
    return g;
  };
  const wings = {};
  for (const side of [-1, 1]) {
    const rootPos = [0.03, 0.106, side * 0.052];
    const rootG = new THREE.Group();
    rootG.position.set(...rootPos);
    body.add(rootG);
    const stroke = new THREE.Group();
    rootG.add(stroke);
    const yaw = new THREE.Group();
    stroke.add(yaw);
    const tipPivot = new THREE.Group();
    tipPivot.position.set(0.03 * WK, 0.0025, side * WING.fold);
    yaw.add(tipPivot);
    const strut = (pts, s0) => {
      const out = pts.map(([s, c]) => [c * WK, 0.0015, side * (s * WK + s0)]);
      return sweep(out, 0.0032, 24, 7).geo;
    };
    {
      const p = new Part(`wingBase${side}`);
      p.add(panelGeo(BASE, 0, side), membrane);
      p.add(strut([[0, 0.012], [0.05, 0.02], [0.15, 0.03]], 0), M.black);
      p.add(strut([[0.0, -0.004], [0.06, -0.03], [0.146, -0.06]], 0), M.black);
      p.add(strut([[0.0, 0.004], [0.08, -0.004], [0.148, -0.01]], 0), M.black);
      p.add(G.cylZ(14), M.gold, T(0.03 * WK, 0.002, side * WING.fold, PI / 2, 0, 0, [0.006, 0.006, 0.016]));
      p.add(G.cylZ(14), M.orange, T(0, 0.002, 0, PI / 2, 0, 0, [0.009, 0.009, 0.01]));
      const g = reg(p, yaw, 'wing', {dist: 0.42, delay: D.wing, spin: 0.5, dir: [0, 0.8, side]});
      g.children[0].castShadow = false;
      anchor(`wing${side}`, g, [-0.04, 0, side * 0.1]);
    }
    {
      const p = new Part(`wingTip${side}`);
      // the tip panel is built relative to the fold pivot
      const g0 = panelGeo(TIP, WING.fold, side);
      g0.translate(-0.03 * WK, 0, 0);
      p.add(g0, membrane);
      p.add(strut([[0, 0.03], [0.06, 0.03], [0.11, 0.018], [0.145, -0.012]], 0).translate(-0.03 * WK, 0, 0), M.black);
      p.add(strut([[0.005, -0.02], [0.07, -0.05], [0.12, -0.07]], 0).translate(-0.03 * WK, 0, 0), M.black);
      p.add(strut([[0.005, 0.0], [0.08, -0.012], [0.14, -0.03]], 0).translate(-0.03 * WK, 0, 0), M.black);
      const g = reg(p, tipPivot, 'wing', {dist: 0.5, delay: D.wing + 0.02, spin: 0.6, dir: [0, 0.6, side]});
      g.children[0].castShadow = false;
    }
    // the root drive, as in the sheet's wing-root exploded view: 06 drive, 05 gearbox, 04 bracket
    {
      const p = new Part(`wingDrive${side}`);
      p.add(G.cylZ(28), M.gun, T(rootPos[0], rootPos[1] - 0.012, side * 0.03, 0, 0, 0, [0.02, 0.02, 0.03]));
      p.add(G.cylZ(28), M.orange, T(rootPos[0], rootPos[1] - 0.012, side * 0.046, 0, 0, 0, [0.0175, 0.0175, 0.006]));
      p.add(gearGeo(0.019, 16, 0.006, 0.32, 4), M.gold, T(rootPos[0], rootPos[1] - 0.012, side * 0.051));
      reg(p, body, 'actuator', {dist: 0.3, delay: D.actuator - 0.06, spin: 0.2, dir: [0, 0.25, side]});
      const q = new Part(`wingBracket${side}`);
      q.add(G.rbox(0.3), M.black, T(rootPos[0], rootPos[1] - 0.004, side * 0.044, 0, 0, 0, [0.03, 0.012, 0.012]));
      q.add(G.cylZ(16), M.gold, T(rootPos[0], rootPos[1], side * 0.05, 0, 0, 0, [0.0062, 0.0062, 0.016]));
      reg(q, body, 'actuator', {dist: 0.38, delay: D.actuator - 0.1, spin: 0.3, dir: [0, 0.3, side]});
    }
    wings[side] = {rootG, stroke, yaw, tipPivot};
  }

  // ============================================================ DEBRIS: the small parts that scatter in the teardown
  const debris = [];
  {
    const kinds = [
      {geo: G.hex(), mat: M.black, n: 70, s: [0.006, 0.004, 0.006]},
      {geo: G.cylZ(16), mat: M.gold, n: 44, s: [0.008, 0.008, 0.006]},
      {geo: gearGeo(0.02, 14, 0.006, 0.3), mat: M.gun, n: 20, s: [0.8, 0.8, 0.8]},
      {geo: G.rbox(0.25), mat: M.debrisOrange, n: 14, s: [0.014, 0.014, 0.014]},
      {geo: G.sphere(12, 8), mat: M.black, n: 30, s: [0.006, 0.006, 0.006]},
    ];
    let r = 41;
    const rr = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (const k of kinds) {
      const mesh = new THREE.InstancedMesh(k.geo, k.mat, k.n);
      mesh.castShadow = true;
      mesh.visible = false;
      mesh.frustumCulled = false;
      body.add(mesh);
      const items = [];
      for (let i = 0; i < k.n; i++) {
        const restP = new V3(-0.11 + (rr() - 0.5) * 0.24, (rr() - 0.5) * 0.08, (rr() - 0.5) * 0.14);
        const u = rr() * 2 - 1;
        const a = rr() * PI * 2;
        const dir = new V3(Math.sqrt(1 - u * u) * Math.cos(a), u * 0.75 + 0.15, Math.sqrt(1 - u * u) * Math.sin(a)).normalize();
        items.push({restP, dir, dist: 0.3 + rr() * 0.42, axis: new V3(rr() - 0.5, rr() - 0.5, rr() - 0.5).normalize(), spin: 2 + rr() * 5, delay: rr() * 0.25, s: new V3(...k.s).multiplyScalar(0.8 + rr() * 0.5)});
      }
      debris.push({mesh, items});
    }
  }
  // orbit rings drawn around the teardown
  const rings = [];
  for (const [rad, rx, rz, acc] of [[0.56, 1.35, 0.1, false], [0.68, 1.1, -0.35, false], [0.79, 1.75, 0.5, true], [0.46, 0.5, 1.2, false]]) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(rad, acc ? 0.0024 : 0.0016, 6, 160), acc ? M.ringAccent : M.ring);
    m.rotation.set(rx, 0, rz);
    m.visible = false;
    m.userData.r0 = [rx, rz];
    root.add(m);
    rings.push(m);
  }

  // ============================================================ posing
  const tmpM = new THREE.Matrix4();
  const X = new V3();
  const Y = new V3();
  const Z = new V3();
  const UP = new V3(0, 1, 0);
  const placeBone = (g, a, b, side, yaw) => {
    X.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const h = new V3(Math.sin(yaw), 0, Math.cos(yaw) * side);
    Z.crossVectors(h, UP).normalize();
    Y.crossVectors(Z, X).normalize();
    Z.crossVectors(X, Y);
    tmpM.makeBasis(X, Y, Z);
    g.quaternion.setFromRotationMatrix(tmpM);
    g.position.set(a[0], a[1], a[2]);
  };

  // ghosting for an isolated system
  const ghostOf = new Map();
  const ghost = (m) => {
    if (!ghostOf.has(m)) {
      const g = m.clone();
      g.transparent = true;
      g.depthWrite = false;
      if (g.color) g.color.lerp(new THREE.Color('#ffffff'), 0.35);
      ghostOf.set(m, g);
    }
    return ghostOf.get(m);
  };
  const allMeshes = Object.entries(bySys).flatMap(([sys, list]) => list.map((m) => ({m, sys, mat: m.material, cast: m.castShadow})));

  const qTmp = new THREE.Quaternion();
  const pQ = new THREE.Quaternion();
  const wc = new V3();
  const centreW = new V3();
  const iq = new THREE.Quaternion();

  /**
   * s: {x, y, pitch, roll, legs[6] (solveLeg results, body frame), horn, elytra, unfold, beat, t, explode, iso, isoSys}
   */
  const update = (s) => {
    root.position.set(s.x, s.y, 0);
    body.rotation.set(s.roll, 0, s.pitch);
    // legs
    s.legs.forEach((L, i) => {
      const side = i < 3 ? -1 : 1;
      const g = legs[i];
      // the coxa turns about the vertical hip axis
      g.coxa.position.set(...L.hip);
      g.coxa.rotation.set(0, Math.atan2(-(L.coxa[2] - L.hip[2]), L.coxa[0] - L.hip[0]), 0);
      placeBone(g.femur, L.coxa, L.knee, side, L.yaw);
      placeBone(g.tibia, L.knee, L.ankle, side, L.yaw);
      placeBone(g.tarsus, L.ankle, L.foot, side, L.yaw);
    });
    head.rotation.set(0, 0, HORN.tilt * s.horn);
    // elytra: roll out, tail up, swing out
    for (const side of [-1, 1]) {
      const e = s.elytra;
      elytra[side].rotation.set(-side * ELYTRA_MAX.roll * e, side * ELYTRA_MAX.yaw * e, -ELYTRA_MAX.pitch * e, 'YZX');
    }
    // wings: the base swings out from along the body, then the tip unfolds; the stroke beats about the body axis
    const u = s.unfold;
    const yawK = Math.min(1, Math.max(0, u / 0.6));
    const tipK = Math.min(1, Math.max(0, (u - 0.32) / 0.68));
    const sm = (x) => x * x * (3 - 2 * x);
    for (const side of [-1, 1]) {
      const w = wings[side];
      w.yaw.rotation.set(0, -side * (PI / 2) * (1 - sm(yawK)) - side * 0.12 * sm(yawK), 0);
      w.tipPivot.rotation.set(-side * PI * (1 - sm(tipK)), 0, 0);
      w.stroke.rotation.set(-side * WING.stroke * s.beat * Math.sin(2 * PI * WING.beatHz * s.t) - side * 0.12 * sm(yawK), 0, 0);
      // stowed wings tuck down under the shell
      w.rootG.position.y = 0.106 + 0.014 * (1 - sm(yawK));
    }

    // explode
    const ex = s.explode;
    for (const p of parts) {
      p.g.position.copy(p.base);
      p.g.quaternion.copy(p.baseQ);
    }
    if (ex > 0.0005) {
      root.updateMatrixWorld(true);
      centreW.set(-0.04, 0.04, 0).applyMatrix4(body.matrixWorld);
      for (const p of parts) {
        const k = sm(Math.min(1, Math.max(0, (ex - p.delay) / 0.62)));
        if (k <= 0) continue;
        wc.copy(p.centre).applyMatrix4(p.g.matrixWorld);
        const dir = p.dir ? p.dir.clone().applyQuaternion(body.getWorldQuaternion(qTmp)) : wc.clone().sub(centreW);
        dir.y += p.dir ? 0 : 0.05;
        dir.normalize();
        p.g.parent.getWorldQuaternion(pQ);
        iq.copy(pQ).invert();
        dir.applyQuaternion(iq);
        p.g.position.addScaledVector(dir, p.dist * XS * k);
        p.g.quaternion.multiply(qTmp.setFromAxisAngle(p.axis, p.spin * k));
      }
    }
    // debris and rings
    for (const d of debris) {
      d.mesh.visible = ex > 0.01;
      if (!d.mesh.visible) continue;
      d.items.forEach((it, i) => {
        const k = sm(Math.min(1, Math.max(0, (ex - it.delay) / 0.7)));
        const p = it.restP.clone().addScaledVector(it.dir, it.dist * XS * k);
        const q = qTmp.setFromAxisAngle(it.axis, it.spin * k + s.t * 0.3 * k);
        d.mesh.setMatrixAt(i, tmpM.compose(p, q, it.s));
      });
      d.mesh.instanceMatrix.needsUpdate = true;
    }
    rings.forEach((m, i) => {
      const k = sm(Math.min(1, Math.max(0, (ex - 0.1 - i * 0.05) / 0.5)));
      m.visible = k > 0.01;
      m.material.opacity = (i === 2 ? 0.75 : 0.32) * k;
      m.scale.setScalar(0.7 + 0.3 * k);
      m.position.set(-0.05, 0.08 + 0.04 * k, 0);
      m.rotation.set(m.userData.r0[0] + 0.08 * s.t, 0.12 * s.t * (i % 2 ? 1 : -1), m.userData.r0[1]);
    });

    // isolate: everything but the chosen system turns to glass
    const iso = s.iso;
    for (const it of allMeshes) {
      if (iso > 0.001 && it.sys !== s.isoSys) {
        const g = ghost(it.mat);
        g.opacity = 1 - 0.88 * iso;
        it.m.material = g;
        it.m.castShadow = iso < 0.5 && it.cast;
      } else {
        it.m.material = it.mat;
        it.m.castShadow = it.cast;
      }
    }
  };

  const ghosts = () => allMeshes.filter((it) => it.m.material !== it.mat).map((it) => it.m);
  return {root, body, head, update, anchors, parts, bySys, legs, wings, elytra, membrane, ghosts, count: partCount(), M};
}
