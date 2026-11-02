// Dynastes RB-1, the math. Real dimensions in metres, no three.js in here.
// One beetle frame: x forward, y up, z to the beetle's right. The body origin sits between the middle legs' hips.
// Inputs are the gait phase (integrated from the walking speed), the hover lift and the operator's switches; every
// pose and every number the console shows comes out of these functions.

export const MASS = 2.4; // kg, the whole machine
export const G = 9.81;

// ------------------------------------------------------------ body
export const BODY = {
  height: 0.112, // body origin above the ground when standing
  elytraLen: 0.4, // shell length, front hinge to tail
  elytraFront: 0.045, // x of the elytra hinge line
  halfWidth: 0.13,
  crown: 0.148, // shell crown above the body origin
  skirt: -0.026, // lowest edge of the shell
  pronotumFront: 0.172,
};

// ------------------------------------------------------------ legs
// 0 L1, 1 L2, 2 L3 (left: z < 0), 3 R1, 4 R2, 5 R3
export const LEG_NAMES = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3'];
export const SEG = {coxa: 0.03, femur: 0.122, tibia: 0.134, tarsus: 0.088};
const HIP = [
  [0.13, -0.03, 0.07],
  [0.0, -0.04, 0.086],
  [-0.082, -0.042, 0.08],
];
// where each foot rests on the ground, body frame
const REST = [
  [0.27, 0.245],
  [0.02, 0.312],
  [-0.235, 0.285],
];
export const hip = (i) => {
  const [x, y, z] = HIP[i % 3];
  return [x, y, i < 3 ? -z : z];
};
export const restFoot = (i) => {
  const [x, z] = REST[i % 3];
  return [x, i < 3 ? -z : z];
};

// ------------------------------------------------------------ tripod gait
export const GAIT = {stride: 0.1, duty: 0.56, lift: 0.046, vMax: 0.12};
// cycles per second at the walking speed v: the foot travels one stride backwards during the stance
export const freqAt = (v) => (v * GAIT.duty) / GAIT.stride;
// tripod A (L1, R2, L3) and tripod B (R1, L2, R3) half a cycle apart
export const legPhase = (i) => ([0, 0.5, 0, 0.5, 0, 0.5][i]);
// body travel for a phase: every stance foot moves back exactly as far as the body moves forward, so nothing slips
export const travelAt = (phase) => (GAIT.stride / GAIT.duty) * phase;

/** One foot relative to its rest spot: dx along the body, lift above the ground, stance true when planted. */
export function footCycle(i, phase, liftK = 1) {
  const p = (((phase + legPhase(i)) % 1) + 1) % 1;
  const {stride: S, duty: B, lift: H} = GAIT;
  if (p < B) return {dx: S / 2 - S * (p / B), lift: 0, stance: true, p};
  const q = (p - B) / (1 - B);
  const e = q * q * (3 - 2 * q);
  return {dx: -S / 2 + S * e, lift: H * Math.sin(Math.PI * q) * liftK, stance: liftK < 0.5, p};
}

// ------------------------------------------------------------ inverse kinematics
// The hip yaws toward the ankle, the coxa reaches out, then femur and tibia solve as a two-bar linkage with the knee
// up. The tarsus hangs from the ankle to the claw at a fixed lean, so the ankle sits above and inside the foot.
const TARSUS_IN = 0.062; // horizontal reach of the tarsus
const TARSUS_UP = Math.sqrt(SEG.tarsus * SEG.tarsus - TARSUS_IN * TARSUS_IN);

/** Joint positions for leg i with its claw at foot (body frame). */
export function solveLeg(i, foot) {
  const H = hip(i);
  const side = i < 3 ? -1 : 1;
  // the ankle: back toward the hip in plan view, up by the tarsus height
  const fx = foot[0] - H[0];
  const fz = foot[2] - H[2];
  const fl = Math.hypot(fx, fz) || 1e-6;
  const ankle = [foot[0] - (fx / fl) * TARSUS_IN, foot[1] + TARSUS_UP, foot[2] - (fz / fl) * TARSUS_IN];
  const ax = ankle[0] - H[0];
  const az = ankle[2] - H[2];
  const yaw = Math.atan2(ax, az * side); // 0 = straight out sideways, + = toward the head
  const hx = Math.sin(yaw);
  const hz = Math.cos(yaw) * side;
  const K = [H[0] + hx * SEG.coxa, H[1], H[2] + hz * SEG.coxa];
  const dh = Math.hypot(ankle[0] - K[0], ankle[2] - K[2]);
  const dy = ankle[1] - K[1];
  const {femur: Lf, tibia: Lt} = SEG;
  const d = Math.min(Lf + Lt - 1e-4, Math.max(Math.abs(Lf - Lt) + 1e-4, Math.hypot(dh, dy)));
  const base = Math.atan2(dy, dh);
  const a = Math.acos((Lf * Lf + d * d - Lt * Lt) / (2 * Lf * d));
  const femurEl = base + a;
  const knee = [K[0] + hx * Lf * Math.cos(femurEl), K[1] + Lf * Math.sin(femurEl), K[2] + hz * Lf * Math.cos(femurEl)];
  const kneeAngle = Math.acos((Lf * Lf + Lt * Lt - d * d) / (2 * Lf * Lt));
  return {hip: H, coxa: K, knee, ankle, foot, yaw, femurEl, kneeAngle, reach: d / (Lf + Lt)};
}

/** Knee torque (N·m) holding the body: the body's weight shared by the planted feet, times the knee-to-ankle lever. */
export function kneeTorque(leg, planted, lifted) {
  if (!planted || lifted) return 0.04;
  const lever = Math.hypot(leg.ankle[0] - leg.knee[0], leg.ankle[2] - leg.knee[2]);
  return ((MASS * G) / planted) * lever;
}
export const KNEE_STALL = 2.6; // N·m, the knee servo's rating

// ------------------------------------------------------------ wings
// Hind wing: 0.30 m span, folded in two under the elytron. The base panel swings out about the root, then the tip
// panel unfolds about the fold line. Beat shown at a slowed test rate so the stroke reads on camera.
export const WING = {span: 0.42, fold: 0.21, chord: 0.168, beatHz: 3.0, stroke: 0.95, realHz: 38};
export const ELYTRA_MAX = {roll: 1.0, pitch: 0.42, yaw: 0.2};
export const HORN = {length: 0.29, tilt: 0.34}; // horn tilt range in rad at full raise

// ------------------------------------------------------------ power
export const BATTERY = {wh: 96, cells: 6, vFull: 25.2};
/** Electrical draw (W) for the machine's state. */
export const drawW = ({torques, beat, horn, unfold}) => 38 + torques.reduce((s, t) => s + t * 9.5, 0) + beat * 214 + horn * 18 + unfold * 26;
