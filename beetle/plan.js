// The film's plan: every operator switch and every moving quantity as a pure function of t, read from
// beetle-film/timeline.json (the score reads the same file). No three.js, so node scripts can import it too.
import TL from '../beetle-film/timeline.json' with {type: 'json'};
import {freqAt, GAIT, travelAt} from './kin.js';

export {TL};
export const DURATION = TL.duration;
const E = TL.events;
const O = TL.ops;

export const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));
const ramp = (ev, t) => ss(ev.t, ev.t + ev.duration, t);

// ------------------------------------------------------------ walking speed and the integrated gait phase
// full speed from the start, slowing to a stand before the wings, walking again at half speed for the last shot
export const speedAt = (t) => GAIT.vMax * (1 - ramp(E.stop, t)) + GAIT.vMax * 0.5 * ramp(E.walk, t);
const T0 = -4;
const DT = 1 / 480;
const NTAB = Math.ceil((DURATION + 1 - T0) / DT);
const PH = new Float64Array(NTAB + 1);
{
  const i0 = Math.round(-T0 / DT);
  for (let i = i0 + 1; i <= NTAB; i++) PH[i] = PH[i - 1] + freqAt(speedAt(T0 + (i - 0.5) * DT)) * DT;
  for (let i = i0 - 1; i >= 0; i--) PH[i] = PH[i + 1] - freqAt(speedAt(T0 + (i + 0.5) * DT)) * DT;
}
/** Gait phase in cycles; 0 at t = 0. */
export const phaseAt = (t) => {
  const u = Math.min(NTAB - 1e-6, Math.max(0, (t - T0) / DT));
  const i = Math.floor(u);
  return PH[i] + (PH[i + 1] - PH[i]) * (u - i);
};
/** Body travel along x, metres. */
export const travel = (t) => travelAt(phaseAt(t));
// feet stop lifting as the walk dies away, so a leg caught mid-swing sets down where it is
export const liftKAt = (t) => smoother(speedAt(t) / (GAIT.vMax * 0.3));

// ------------------------------------------------------------ the machine's switches
export const hornAt = (t) => ramp(E.hornUp, t) * (1 - ramp(E.hornDown, t));
export const elytraAt = (t) => ramp(E.elytraOpen, t) * (1 - ramp(E.elytraClose, t));
/** Wing unfold 0..1: stowed, partly open, deployed; folds back after the rebuild. */
export const unfoldAt = (t) => ramp(E.wingUnfold, t) * (1 - ramp(E.wingFold, t));
export const beatAt = (t) => ramp(E.beat, t) * (1 - ss(E.burst.t - 0.15, E.burst.t + 0.45, t));
export const hoverAt = (t) => ramp(E.lift, t) * (1 - ramp(E.land, t));
export const explodeAt = (t) => ramp(E.burst, t) * (1 - ramp(E.rebuild, t));
export const isoAt = (t) => ss(O.legs + 0.1, O.legs + 0.7, t) * (1 - ss(O.wings, O.wings + 0.6, t));
// labels: on for the horn, the legs, the wings and the teardown; off in the hover and the last shot
export const labelsAt = (t) => {
  const on = (a, b) => ss(a, a + 0.5, t) * (1 - ss(b, b + 0.35, t));
  return Math.max(on(O.horn + 0.7, O.legs - 0.2), on(O.legs + 0.9, O.wings - 0.2), on(O.wings + 1.5, O.hover - 0.1), on(O.explode + 1.0, O.assemble));
};
// turntable: the camera's extra swing during the teardown, degrees
export const turntableAt = (t) => {
  const a = O.explode + 0.3;
  const b = O.assemble + 1.4;
  if (t <= a) return 0;
  return 26 * (Math.min(t, b) - a);
};

// ------------------------------------------------------------ operator actions, modes and views
export const ACTIONS = [
  {t: O.horn, key: 'horn', group: 'asm', log: 'ISOLATE · HORN'},
  {t: O.legs, key: 'legs', group: 'asm', log: 'ISOLATE · LEGS'},
  {t: O.wings, key: 'wings', group: 'asm', log: 'WINGS · DEPLOY'},
  {t: O.hover, key: 'hover', group: 'disp', log: 'HOVER · TEST'},
  {t: O.explode, key: 'exploded', group: 'disp', log: 'EXPLODED · ON'},
  {t: O.assemble, key: 'exploded', group: 'disp', log: 'EXPLODED · OFF'},
  {t: O.hero, key: 'hero', group: 'asm', log: 'ISOLATE · HERO'},
];
export const MODES = [
  {t: 0, view: 'hero', mode: 'WALKING', status: 'WALKING', asm: 'hero', iso: 'HERO'},
  {t: O.horn, view: 'horn', mode: 'HORN RAISED', status: 'HORN UP', asm: 'horn', iso: 'HORN'},
  {t: O.legs, view: 'legs', mode: 'TRIPOD GAIT', status: 'ISOLATE', asm: 'legs', iso: 'LEGS'},
  {t: O.wings, view: 'wings', mode: 'WING DEPLOY', status: 'DEPLOY', asm: 'wings', iso: 'WINGS'},
  {t: O.hover, view: 'hover', mode: 'HOVER TEST', status: 'HOVERING', asm: 'wings', iso: 'WINGS'},
  {t: O.explode, view: 'teardown', mode: 'TEARDOWN', status: 'TEARDOWN', asm: null, iso: 'ALL'},
  {t: O.assemble, view: 'rebuild', mode: 'REASSEMBLY', status: 'ASSEMBLY', asm: null, iso: 'ALL'},
  {t: O.hero, view: 'close', mode: 'PATROL', status: 'PATROL', asm: 'hero', iso: 'HERO'},
];
export const modeAt = (t) => {
  let m = MODES[0];
  for (const x of MODES) if (x.t <= t) m = x;
  return m;
};
export const displayAt = (t) => ({
  labels: labelsAt(t) > 0.5,
  exploded: t >= O.explode && t < O.assemble,
  hover: t >= O.hover && t < O.explode,
  turntable: t >= O.explode && t < O.assemble + 1.4,
});
