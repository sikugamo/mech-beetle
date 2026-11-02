// Dynastes RB-1, the console film: the beetle in the studio (stage.js) under the RB-1 field sheet (console.js).
// It walks in on a tripod gait, raises its horn, shows its legs through a glass shell, opens the elytra and unfolds
// its hind wings in three stages, hovers on a test beat, comes apart into a teardown with every part on its own
// path, rebuilds and walks off. Everything is a pure function of t, read from timeline.json through plan.js.
import {runSim} from 'teardown-kit/runtime.js';
import {BATTERY, BODY, drawW, footCycle, freqAt, GAIT, HORN, KNEE_STALL, kneeTorque, LEG_NAMES, restFoot, SEG, solveLeg, WING} from './kin.js';
import {createConsole, LEGS} from './console.js';
import * as P from './plan.js';
import {createBeetleStage} from './stage.js';

const D2R = Math.PI / 180;
export const DEFAULTS = {duration: P.DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'Dynastes RB-1', subtitle: ''}, director: {enabled: false}, watermark: ''};

// ------------------------------------------------------------ the pose
const HANG = (i) => {
  const r = restFoot(i);
  return [r[0] * 0.72, -0.07, r[1] * 0.74];
};
/** Everything the model and the console need at time t, from the kinematics alone. */
export function poseAt(t) {
  const phase = P.phaseAt(t);
  const speed = P.speedAt(t);
  const liftK = P.liftKAt(t);
  const hv = P.hoverAt(t);
  const beat = P.beatAt(t);
  const walkK = Math.min(1, speed / GAIT.vMax);
  // the body: a small bob and roll at twice and once the stride, a breath when standing, the hover lift
  const bob = 0.0035 * Math.sin(4 * Math.PI * phase) * walkK + 0.0012 * Math.sin((2 * Math.PI * t) / 2.4) * (1 - walkK);
  const lift = 0.105 * hv + 0.004 * beat * Math.sin(2 * Math.PI * WING.beatHz * t * 2) * hv;
  const y = BODY.height + bob + lift;
  const roll = 0.012 * Math.sin(2 * Math.PI * phase) * walkK + 0.02 * hv * Math.sin(t * 1.3);
  const pitch = -0.02 * P.hornAt(t) + 0.07 * hv;
  const x = P.travel(t);
  // feet: world ground points brought into the body frame (inverse of the body's x-then-z rotation)
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const toBody = (v) => {
    // undo Rx(roll) then Rz(pitch): R = Rx * Rz, inverse = Rz^T * Rx^T
    const ax = v[0];
    const ay = cr * v[1] + sr * v[2];
    const az = -sr * v[1] + cr * v[2];
    return [cp * ax + sp * ay, -sp * ax + cp * ay, az];
  };
  const cycles = [];
  const legs = [0, 1, 2, 3, 4, 5].map((i) => {
    const c = footCycle(i, phase, liftK);
    cycles.push(c);
    const r = restFoot(i);
    const ground = toBody([r[0] + c.dx, c.lift - y, r[1]]);
    const h = HANG(i);
    const f = hv > 0 ? ground.map((g, k) => g + (h[k] - g) * hv) : ground;
    return solveLeg(i, f);
  });
  return {t, x, y, roll, pitch, phase, speed, liftK, hv, beat, legs, cycles, horn: P.hornAt(t), elytra: P.elytraAt(t), unfold: P.unfoldAt(t), explode: P.explodeAt(t), iso: P.isoAt(t)};
}
const planted = (p) => (p.hv > 0.3 ? 0 : p.cycles.filter((c) => c.lift < 0.004).length);
const torques = (p) => {
  const n = planted(p);
  return p.legs.map((L, i) => (p.explode > 0.05 ? 0 : kneeTorque(L, n, p.hv > 0.3 || p.cycles[i].lift >= 0.004)));
};
const drawAt = (p) => drawW({torques: torques(p), beat: p.beat, horn: Math.abs(P.hornAt(p.t + 0.05) - P.hornAt(p.t - 0.05)) > 0.002 ? 1 : 0, unfold: Math.abs(P.unfoldAt(p.t + 0.05) - P.unfoldAt(p.t - 0.05)) > 0.002 ? 1 : 0});

// battery energy used, integrated once at load at 30 Hz
const EN = (() => {
  const n = Math.ceil(P.DURATION * 30) + 2;
  const e = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) e[i] = e[i - 1] + drawAt(poseAt((i - 0.5) / 30)) / 30 / 3600;
  return e;
})();
const energyAt = (t) => {
  const u = Math.min(EN.length - 2, Math.max(0, t * 30));
  const i = Math.floor(u);
  return EN[i] + (EN[i + 1] - EN[i]) * (u - i);
};

// ------------------------------------------------------------ views
// each view as a function of u, the seconds since it was switched on, and the body's x; angles in degrees
export const VIEW_FN = {
  hero: (u, bx) => ({tx: bx + 0.03, ty: 0.14, tz: 0, az: 34 + 1.6 * u, el: 13, d: 2.15, sx: 0, sy: -36}),
  horn: (u, bx) => ({tx: bx + 0.2, ty: 0.19, tz: -0.02, az: 50 + 2.2 * u, el: 9, d: 1.75, sx: 20, sy: -40}),
  legs: (u, bx) => ({tx: bx + 0.01, ty: 0.12, tz: 0, az: 80 + 1.4 * u, el: 10, d: 2.45, sx: 0, sy: -40}),
  wings: (u, bx) => ({tx: bx - 0.03, ty: 0.2, tz: 0, az: 146 + 2.4 * u, el: 30, d: 2.25, sx: 0, sy: -30}),
  hover: (u, bx) => ({tx: bx - 0.02, ty: 0.27, tz: 0, az: 160 + 3.2 * u, el: 18, d: 2.4, sx: 0, sy: -26}),
  teardown: (u, bx) => ({tx: bx - 0.04, ty: 0.24, tz: 0, az: 118, el: 17, d: 4.0, sx: 0, sy: -20}),
  rebuild: (u, bx) => ({tx: bx + 0.0, ty: 0.16, tz: 0, az: 238 - 0 * u, el: 15, d: 2.55, sx: 0, sy: -30}),
  close: (u, bx) => ({tx: bx + 0.05, ty: 0.15, tz: 0, az: 38 + 2.0 * u, el: 10, d: 2.2, sx: 0, sy: -36}),
};
const VIEWS = P.MODES.map((m) => [m.t, m.view]);
const lerpDeg = (a, b, k) => a + ((((b - a + 540) % 360) - 180) * k);
export function viewAt(t, bx) {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0], bx);
  cur.az += P.turntableAt(t);
  if (i === 0) return cur;
  const prev = VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0], bx);
  prev.az += P.turntableAt(t);
  const k = P.ss(VIEWS[i][0] + 0.12, VIEWS[i][0] + 1.75, t);
  const o = {};
  for (const key in cur) o[key] = key === 'az' ? lerpDeg(prev.az, cur.az, k) : prev[key] + (cur[key] - prev[key]) * k;
  // a wide swing backs off and climbs a little so the camera never grazes the model
  const swing = Math.min(1, Math.abs(((cur.az - prev.az + 540) % 360) - 180) / 90);
  o.el += 6 * Math.sin(Math.PI * k) * swing;
  o.d += 0.35 * swing * Math.sin(Math.PI * k);
  return o;
}
const toCam = (c) => ({...c, az: c.az * D2R, el: c.el * D2R});

// ------------------------------------------------------------ the operator's pointer
const REST = [[1196, 470], [1150, 395], [1210, 560], [1180, 440], [1222, 520], [1170, 600], [1205, 455]];
function makeCursor(spots) {
  const EV = P.ACTIONS.map((a) => ({t: a.t, spot: spots[`${a.group}:${a.key}`]}));
  const WP = [[0, 1200, 500]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.16, ...e.spot]);
    WP.push([e.t + 0.24, ...e.spot]);
    WP.push([e.t + 1.6, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = P.ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(26, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + 0.09) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ console data for a frame
const lastAction = (t) => P.ACTIONS.filter((a) => a.t <= t).pop();
const wingStage = (u) => (u < 0.04 ? '01 STOWED' : u < 0.96 ? '02 PARTIAL' : '03 DEPLOYED');
const CALLS = {
  horn: (p) => [
    {a: 'hornTip', name: 'CEPHALIC HORN', sub: `${Math.round(HORN.length * 1000)} MM · +${(p.horn * HORN.tilt * 57.3).toFixed(1)}°`, dx: 120, dy: -40},
    {a: 'spike', name: 'THORACIC SPIKE', sub: 'FIXED · CARBON SHELL', dx: 130, dy: -70},
    {a: 'eye', name: 'OPTIC', sub: 'Ø 37 MM · IR IRIS', dx: -110, dy: 60},
  ],
  legs: (p, tq) => [
    {a: 'femurL1', name: 'FEMUR SERVO', sub: `${tq[0].toFixed(2)} N·M · ${Math.round((tq[0] / KNEE_STALL) * 100)}%`, dx: -110, dy: -86},
    {a: 'kneeL1', name: 'KNEE JOINT', sub: `${(p.legs[0].kneeAngle * 57.3).toFixed(0)}° · HIGH STANCE`, dx: -130, dy: -26},
    {a: 'clawL1', name: 'TARSAL CLAW', sub: '4 BEADS · 2 HOOKS', dx: -110, dy: 40},
  ],
  wings: (p) => [
    {a: 'wing1', name: 'HIND WING', sub: `${Math.round(WING.span * 1000)} MM SPAN · ${wingStage(p.unfold)}`, dx: 120, dy: -50},
    {a: 'elytron1', name: 'ELYTRON', sub: `RAISED ${(p.elytra * 57).toFixed(0)}° · 6 PANELS`, dx: 120, dy: 36},
  ],
  teardown: (p) => [
    {a: 'elytron1', name: 'SHELL', sub: '12 PANELS · 48 BOLTS', dx: 120, dy: -40},
    {a: 'wing1', name: 'HIND WING', sub: '2 PANELS · 6 STRUTS', dx: 130, dy: -30},
    {a: 'hornTip', name: 'HORN ASSY', sub: 'SLEEVED · 2 BANDS', dx: -120, dy: -30},
    {a: 'femurL1', name: 'LEG ASSY', sub: '6 × 4 SEGMENTS', dx: -120, dy: 40},
  ],
};
const callSet = (t) => {
  const O = P.TL.ops;
  if (t < O.legs) return 'horn';
  if (t < O.wings) return 'legs';
  if (t < O.explode) return 'wings';
  return 'teardown';
};

export function makeConsoleFrame(ui, st) {
  return (t, p) => {
    const tq = torques(p);
    const draw = drawAt(p);
    const used = energyAt(t);
    const pct = 91.4 - (used / BATTERY.wh) * 100;
    const m = P.modeAt(t);
    const disp = P.displayAt(t);
    const n = planted(p);
    const ex = p.explode;
    const hist = (leg) => Array.from({length: 81}, (_, k) => {
      const tt = t - 4 + k * 0.05;
      const c = footCycle(leg, P.phaseAt(tt), P.liftKAt(tt));
      return c.lift / GAIT.lift;
    });
    const servoTag = ex > 0.05 ? 'DETACHED' : p.hv > 0.3 ? 'AIRBORNE' : p.speed > 0.004 ? 'WALKING' : 'HOLDING';
    const hornDeg = p.horn * HORN.tilt * 57.3;
    const sub = {
      'WALKING': `TRIPOD · ${p.speed.toFixed(2)} M/S · ${n} FEET DOWN`,
      'HORN RAISED': `HORN +${hornDeg.toFixed(1)}° · HEAD PITCH`,
      'TRIPOD GAIT': `DUTY ${Math.round(GAIT.duty * 100)}% · ${n} FEET DOWN`,
      'WING DEPLOY': `${wingStage(p.unfold)} · ${Math.round(p.unfold * 100)}%`,
      'HOVER TEST': `LIFT ${Math.round(p.hv * 105)} MM · ${WING.beatHz.toFixed(1)} HZ TEST BEAT`,
      'TEARDOWN': `TURNTABLE ${Math.round(P.turntableAt(t))}° · ${Math.round(ex * 100)}% APART`,
      'REASSEMBLY': `${Math.round((1 - ex) * 100)}% SEATED`,
      'PATROL': `TRIPOD · ${p.speed.toFixed(2)} M/S`,
    }[m.mode];
    const iso = m.asm;
    const subs = [
      ex > 0.05 ? ['DETACHED', 'o'] : p.elytra > 0.03 ? [`OPEN ${Math.round(p.elytra * 57)}°`, 'o'] : ['SEALED', ''],
      ex > 0.05 ? ['DETACHED', 'o'] : p.beat > 0.05 ? [`BEAT ${WING.beatHz.toFixed(1)} HZ`, 'o'] : p.unfold > 0.96 ? ['DEPLOYED', ''] : p.unfold > 0.02 ? [`UNFOLD ${Math.round(p.unfold * 100)}%`, 'o'] : ['STOWED', 'g'],
      ex > 0.05 ? ['DETACHED', 'o'] : p.horn > 0.02 ? [`HORN +${hornDeg.toFixed(0)}°`, 'o'] : ['LOCKED', ''],
      [servoTag, servoTag === 'DETACHED' ? 'o' : servoTag === 'AIRBORNE' ? 'g' : ''],
      ex > 0.05 ? ['DETACHED', 'o'] : ['RUNNING', ''],
      ex > 0.05 ? ['EXPOSED', 'o'] : ['NOMINAL', ''],
    ];
    const hi = {horn: 2, legs: 3, wings: 1}[iso];
    if (hi !== undefined) subs[hi].push(true);
    // callouts
    const lab = P.labelsAt(t);
    const callouts = lab < 0.02 ? [] : CALLS[callSet(t)](p, tq).map((c) => {
      const at = st.anchorPx(c.a);
      if (!at) return {o: 0};
      const lx = at[0] + c.dx;
      const ly = at[1] + c.dy;
      const w = 160;
      if (at[0] < 330 || at[0] > 1270 || at[1] < 100 || at[1] > 750 || ui.covered(c.dx < 0 ? lx - w : lx, ly, w)) return {o: 0};
      return {...c, at, o: lab};
    });
    // labels on the same side never stack on each other: push them apart vertically, 38 px at least
    for (const left of [true, false]) {
      const list = callouts.filter((c) => c.o > 0 && c.dx < 0 === left).sort((a, b) => a.at[1] + a.dy - (b.at[1] + b.dy));
      for (let k = 1; k < list.length; k++) {
        const prev = list[k - 1].at[1] + list[k - 1].dy;
        const y = list[k].at[1] + list[k].dy;
        if (y - prev < 38) list[k].dy += 38 - (y - prev);
      }
    }
    const a = lastAction(t);
    ui.update({
      t,
      duration: P.DURATION,
      load: Math.min(1, draw / 320),
      status: m.status,
      statusWarn: ex > 0.05,
      mode: m.mode,
      modeSub: sub,
      iso: m.iso,
      gait: {freq: freqAt(p.speed), duty: GAIT.duty, pattern: p.speed > 0.004 ? 'TRIPOD' : p.hv > 0.3 ? 'TUCKED' : 'STANCE', histA: hist(0), histB: hist(3)},
      power: {pct, draw, cell: BATTERY.vFull - 0.6 - (91.4 - pct) * 0.05 - draw * 0.0016, motor: 24 + 9 * (1 - Math.exp(-used / 0.5)) + draw * 0.004},
      servos: tq.map((v) => v / KNEE_STALL),
      servoTag,
      att: {height: p.y, pitch: p.pitch * 57.3, roll: p.roll * 57.3, speed: p.speed, mode: p.hv > 0.3 ? 'HOVER' : 'GROUNDED', wings: p.unfold < 0.04 ? 'STOWED' : p.unfold < 0.96 ? 'UNFOLDING' : p.beat > 0.1 ? `${WING.beatHz.toFixed(1)} HZ` : 'DEPLOYED'},
      asm: iso,
      disp,
      subs,
      log: a ? `OPERATOR · ${a.log}` : 'AUTO · WALK CYCLE',
      callouts,
      cursor: ui.cursorAt(t),
    });
  };
}

export function makeFilm() {
  return async ({cfg, canvas, capture}) => {
    const st = createBeetleStage({canvas, ink: cfg.ink ?? 0.55});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'), {parts: st.beetle.count, actions: P.ACTIONS, duration: P.DURATION});
    ui.cursorAt = makeCursor(ui.spots);
    const frame = makeConsoleFrame(ui, st);
    window.RB = {st, poseAt, P};
    return {
      resize,
      render(t) {
        const p = poseAt(t);
        const isoSys = 'leg';
        st.frame({...p, isoSys}, toCam(viewAt(t, p.x)));
        frame(t, p);
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
export {LEG_NAMES, LEGS, SEG};
