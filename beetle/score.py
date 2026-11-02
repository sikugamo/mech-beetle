"""Score for the Dynastes RB-1 console film: a warm lo-fi bed (Fmaj9 chords, 90 bpm, the tempo of the reference
demo) at one level the whole way, with accents on the film's own timeline:

- a soft footfall on every tripod touchdown, computed from the same gait integral the legs walk on (plan.js),
- a click on each operator action, a whoosh under each camera move,
- servo whine for the horn, the elytra and the wing unfold, a stepped blip for each unfold stage,
- a puff of air on every down-stroke of the test beat over a low motor hum,
- a riser into the teardown, the impact, scattering parts, and locking clicks as it rebuilds,
- a chime on the last shot.

    python run_sfx.py beetle/score.py

Every time comes from beetle-film/timeline.json; the speed profile and gait constants mirror plan.js and kin.js.
"""

import math
import os

from sfx.score_kit import airy, bed, chords, hz, motor, puff, rumble, thud
from sfx.synth import blip, chime, click, impact, pop, riser, whoosh

TIMELINE = "../beetle-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "beetle-score.wav")
TARGET_LUFS = -14.0
SEED = 17

CHORDS = chords("Fmaj9:F2 C3 E3 G3 A3/F1", "Dm9:D2 A2 C3 E3 F3/D1", "Bbmaj7:Bb1 F2 A2 D3/Bb0", "C6sus:C2 F2 G2 A2 D3/C1")
MOTIF = [(0.5, hz("C5")), (1.5, hz("A4")), (2.5, hz("G4"))]

# kin.js
V_MAX, STRIDE, DUTY, BEAT_HZ = 0.12, 0.1, 0.56, 3.0


def smoother(x):
    u = min(1.0, max(0.0, x))
    return u * u * u * (u * (u * 6 - 15) + 10)


def ramp(ev, t):
    return smoother((t - ev["t"]) / ev["duration"])


def touchdowns(E, dur):
    """Times a tripod lands: the gait phase crossing a whole or a half cycle while the legs still lift."""
    speed = lambda t: V_MAX * (1 - ramp(E["stop"], t)) + V_MAX * 0.5 * ramp(E["walk"], t)
    dt = 1 / 480
    ph, t, out, prev = 0.0, 0.0, [], 0
    while t < dur:
        v = speed(t)
        ph += v * DUTY / STRIDE * dt
        k = math.floor(ph * 2)
        if k != prev and v > V_MAX * 0.3:
            out.append((t, k % 2))
        prev = k
        t += dt
    return out


def score(mix, tl):
    dur = tl["duration"]
    O, E = tl["ops"], tl["events"]

    left, right, low, drums = bed(dur, 90, CHORDS, MOTIF, motif_voice="epiano", kicks=(0, 2.5), snares=(), hats=8, swing=0.0, keys_vel=0.7, keys_lp=3400)
    mix.put_stereo(0, left, right, 0.12)
    mix.put(0, low, 0.13)
    mix.put(0, drums, 0.045)

    # footfalls, tripod A a little left, tripod B a little right
    for t, side in touchdowns(E, dur):
        mix.put(t, thud(150, 0.018, 0.14), 0.04, -0.25 if side == 0 else 0.25)
        mix.put(t + 0.004, click(1100, 0.018), 0.012, -0.2 if side == 0 else 0.2)

    # operator clicks and the camera moves that follow them
    for t in O.values():
        mix.put(t, click(2400, 0.025), 0.06)
        mix.put(t + 0.12, whoosh(1.5, 380, 1700, peak=0.45), 0.03)

    # horn up and down: a geared servo
    mix.put(E["hornUp"]["t"], motor(E["hornUp"]["duration"], f0=190, grit_hz=1700), 0.02, 0.15)
    mix.put(E["hornDown"]["t"], motor(E["hornDown"]["duration"], f0=160, grit_hz=1500), 0.018, 0.15)
    mix.put(E["hornUp"]["t"] + E["hornUp"]["duration"], thud(110, 0.03, 0.2), 0.035)

    # elytra open: a slow heavy servo, a latch at the top; closing later the same way
    eo, ec = E["elytraOpen"], E["elytraClose"]
    mix.put(eo["t"], motor(eo["duration"], f0=130, grit_hz=1200, wobble=11), 0.024)
    mix.put(eo["t"], airy(eo["duration"] + 0.3, 400, 1100, 0.6), 0.02)
    mix.put(eo["t"] + eo["duration"], thud(95, 0.04, 0.3), 0.045)
    mix.put(ec["t"], motor(ec["duration"], f0=150, grit_hz=1300, wobble=11), 0.02)
    mix.put(ec["t"] + ec["duration"], thud(90, 0.05, 0.35), 0.06)

    # wing unfold: air sweeping up, one blip for each stage of the sheet (stowed, partial, deployed), in key
    wu, wf = E["wingUnfold"], E["wingFold"]
    mix.put(wu["t"], airy(wu["duration"], 500, 2600, 0.7), 0.026)
    mix.put(wu["t"], motor(wu["duration"], f0=240, grit_hz=2200, wobble=23), 0.012)
    for k, note in enumerate(("A4", "C5", "F5")):
        mix.put(wu["t"] + wu["duration"] * k / 2, blip(hz(note), 0.32, 0.11), 0.04)
    mix.put(wf["t"], airy(wf["duration"], 2200, 600, 0.6), 0.022)

    # hover test: a puff on each down-stroke while the beat is up, a low motor hum under it
    b, burst = E["beat"], E["burst"]
    t = b["t"]
    while t < burst["t"]:
        g = smoother((t - b["t"]) / b["duration"])
        mix.put(t, puff(1.0), 0.05 * g)
        t += 1 / BEAT_HZ
    mix.put(b["t"], rumble(burst["t"] - b["t"] + 0.3, lambda x: 76.0, 1.0), 0.012)
    mix.put(E["lift"]["t"], airy(E["lift"]["duration"] + 0.8, 300, 900, 0.6), 0.02)

    # teardown: rise into it, the hit, parts scattering
    mix.put(burst["t"] - 1.2, riser(1.2, 300, 4200), 0.035)
    mix.put(burst["t"], impact(1.2), 0.12)
    mix.put(burst["t"], whoosh(1.0, 2000, 300, peak=0.2), 0.04)
    for k in range(10):
        tt = burst["t"] + 0.12 + k * 0.09 + (k % 3) * 0.02
        mix.put(tt, pop(900 + 120 * k, 1400 + 140 * k, 0.12), 0.016, -0.6 + 0.13 * k)

    # rebuild: the cloud drawing back, then the assemblies locking home one by one, each a step higher
    rb = E["rebuild"]
    mix.put(rb["t"], whoosh(rb["duration"], 2400, 450, peak=0.75), 0.04)
    for k in range(7):
        mix.put(rb["t"] + 0.45 + k * 0.13, click(1500 + 160 * k, 0.03), 0.045, -0.4 + 0.13 * k)

    # the last shot
    mix.put(O["hero"] + 0.3, chime([hz("F4"), hz("A4"), hz("C5"), hz("E5")], 2.2, 0.8), 0.05)
