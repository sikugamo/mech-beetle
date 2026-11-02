# Dynastes RB-1: mechanical rhinoceros beetle

A 20-second, 1920×1080, 60 fps explainer film of a robotic rhinoceros beetle, with music and sound effects. It's built with the [teardown](https://github.com/elvarofficial/teardown) Claude Code skill, in the visual style of its demo videos. The beetle follows the concept sheet in `reference/concept-sheet.jpg`. All of it is built from code: no 3D model files, no keyframes, no recorded footage.

**▶ Watch the film: [`media/dynastes-rb1.mp4`](media/dynastes-rb1.mp4)** (20.4 s, 1920×1080, 60 fps, AAC stereo, 20 MB)

Rendering locally writes a fresh copy to `render/dynastes-rb1.mp4`.

## What the film shows

| Time | Operator action | What happens |
|---|---|---|
| 0.0 s | | The beetle walks in on a tripod gait. The panels show stride frequency, foot lift, knee torque, battery and attitude. |
| 3.2 s | ASSEMBLIES · HORN | Close-up on the head. The head pitches up and the horn rises 19.5°. Callouts on the cephalic horn, thoracic spike and optic. |
| 6.0 s | ASSEMBLIES · LEGS | The shell turns to glass. Side view of the legs, with callouts on the femur servo, knee and claw. |
| 9.0 s | ASSEMBLIES · WINGS | The beetle stops. The elytra open, and the hind wings unfold in the sheet's three stages: 01 stowed, 02 partial, 03 deployed. |
| 11.8 s | DISPLAY · HOVER | Test wing beat. The beetle lifts 105 mm and its legs tuck. |
| 13.6 s | DISPLAY · EXPLODED | Teardown: every part flies out on its own path, the outer layers first. Loose small parts scatter, orbit rings appear, and the view turns like a turntable. |
| 16.6 s | DISPLAY · EXPLODED (off) | Reassembly. The wings fold and the elytra close. |
| 18.3 s | ASSEMBLIES · HERO | The beetle walks off. |

## Layout

| Path | Job |
|---|---|
| `beetle/kin.js` | The maths: real dimensions in metres, the tripod gait, leg inverse kinematics, knee torque, wing and elytra ranges, power draw. No three.js. |
| `beetle/plan.js` | The film's plan. Reads `beetle-film/timeline.json` and returns every switch and every moving quantity as a pure function of `t`. Also holds the gait phase, integrated from the speed profile, so the feet never slip. |
| `beetle/parts.js` | Geometry helpers: thick shell panels, tapered swept tubes, gears, bolts, and a part builder that merges each part's pieces by material. |
| `beetle/model.js` | The beetle: about 600 merged components in 6 subsystems (shell, wing, thorax, leg, actuator, frame). Covers posing, the exploded view, and turning parts to glass for isolation. |
| `beetle/stage.js` | Studio, key light with soft shadows, ambient occlusion (GTAO), ink outlines, bloom. |
| `beetle/console.js` | The 1600×900 field-simulator overlay: panels, buttons, callouts, cursor. |
| `beetle/film.js` | Ties it together: pose, cameras, the operator's cursor, and each frame's console data. |
| `beetle/score.py` | The soundtrack, generated on the same timeline (see Sound). |
| `beetle-film/` | Entry point and `timeline.json`, the single source of every beat time. |
| `beetle-preview/` | The model with no console, for checking geometry from any angle. |
| `render.sh` | Full render: build, score, resumable 4 s chunks, concatenation, audio mux. |

## Install

You need the teardown skill installed with its dependencies:

```
git clone https://github.com/elvarofficial/teardown ~/.claude/skills/teardown
cd ~/.claude/skills/teardown && npm ci && npx playwright install chromium
```

You also need Node.js 20+, `ffmpeg` and Python 3 (standard library only). To use a Chromium that's already installed instead of Playwright's download, set `CHROMIUM=/path/to/chrome`. On the original machine, `. ~/.local/opt/env.sh` provides Node, ffmpeg and `$CHS` (chrome-headless-shell), and `render.sh` picks up `$CHS` on its own.

## Run

```
./render.sh                       # → render/dynastes-rb1.mp4
JOBS=2 ./render.sh                # two capture workers in parallel (~1.3 GB RAM each; 2 is the safe limit on 8 GB)
```

Chunks are 2 s, named by first frame (`render/chunks/f00480.mp4`) and claimed with lock directories, so workers never render a frame twice. A failed chunk is retried up to 3 times (a load spike can push one frame past the capture's 30 s screenshot timeout). The final join runs only when the chunks hold every frame. If a run is killed, delete `render/chunks/*.lock` and run again; finished chunks are kept.

- **Resuming:** chunks that already exist are skipped. Delete `render/chunks/` to start over.
- **Speed:** without a GPU (SwiftShader), expect about 5 s per frame, so 1–2 hours for the whole film. With a real GPU it's minutes.
- **Configuration:** `TEARDOWN_SKILL` (skill folder), `CHUNK` (seconds per chunk, default 4), `OUT` (output folder).

For a single step:

```
SKILL=~/.claude/skills/teardown; export TEARDOWN_OUT=$PWD/teardown-out
node $SKILL/sims/build.mjs ./beetle-film                 # offline HTML page: teardown-out/dist/beetle-film.html
node $SKILL/sims/capture.mjs beetle-film --size 1600x900 --dpr 1.2 --stills beats \
     --timeline beetle-film/timeline.json --cols 4 --out teardown-out/beats.png   # review sheet, one tile per beat
python3 $SKILL/run_sfx.py beetle/score.py                # soundtrack only
```

The built `beetle-film.html` also plays in a browser in real time, and loops.

## Changing the film

- **Timing:** edit `beetle-film/timeline.json`. The film, the review sheets and the soundtrack all read it.
- **Proportions:** the shell and pronotum shapes are the `EL` and `PR` blocks in `model.js`. Leg mounts, lengths and foot positions are in `kin.js`.
- **Camera views:** `VIEW_FN` in `film.js`.

## Sound

The reference demo's audio is a single final mix, timed to a different creature's actions, so it can't be reused for this film. `score.py` builds a new soundtrack in the same style instead: a lo-fi bed at 90 bpm (the demo's tempo), mastered to the demo's loudness (−14 LUFS, −2.7 dBTP true peak). The accents fall on this film's own events:
- footfalls computed from the gait
- button clicks and camera whooshes
- servo whine for the horn, elytra and wing unfold
- wing beats during the hover
- the teardown impact, and locking clicks during the rebuild

## Known limits

- **Detail:** the model is procedural, like the teardown demos. It matches the concept's shapes, palette and mechanisms, but not every bolt and seam of the painted concept.
- **Wing beat:** shown at a slowed 3 Hz test rate so the stroke reads on camera. The panel notes the real figure.
