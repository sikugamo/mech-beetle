#!/usr/bin/env bash
# Render the Dynastes RB-1 film to a 1920x1080 60 fps MP4 with its score.
#
#   ./render.sh                 build, score, render every chunk, join, mux
#   JOBS=2 ./render.sh          two capture workers in parallel (each ~1.3 GB RAM; 2 is the safe limit on 8 GB)
#
# Chunks are named by their first frame (render/chunks/f00480.mp4) and claimed with an atomic lock directory, so any
# number of workers, even from separate runs of this script, can share the work without rendering a frame twice.
# Resumable: finished chunks are skipped. If a run is killed, delete render/chunks/*.lock before restarting.
# The join only runs once every frame of the film is present; a worker that finishes early just exits.
# Needs the teardown skill (TEARDOWN_SKILL, default ~/.claude/skills/teardown), Node 20+, ffmpeg, Python 3.
# On the original machine: . ~/.local/opt/env.sh first (Node, ffmpeg, chrome-headless-shell as $CHS).
set -euo pipefail
cd "$(dirname "$0")"
SKILL="${TEARDOWN_SKILL:-$HOME/.claude/skills/teardown}"
export TEARDOWN_OUT="$PWD/teardown-out"
[ -n "${CHS:-}" ] && export CHROMIUM="${CHROMIUM:-$CHS}"
JOBS=${JOBS:-1}
STEP=${STEP:-120}     # frames per chunk (2 s)
START=${START:-0}     # first frame to schedule (frames before it are expected to exist as chunks already)
FPS=60
OUT=${OUT:-$PWD/render}
CH="$OUT/chunks"
mkdir -p "$CH"

if [ -z "${NO_BUILD:-}" ]; then
  node "$SKILL/sims/build.mjs" ./beetle-film
  python3 "$SKILL/run_sfx.py" beetle/score.py --out "$OUT/beetle-score.wav"
fi
NF=$(node -e "const t=require('./beetle-film/timeline.json');console.log(Math.round(t.duration*$FPS))")

worker() {
  local w=$1 s name lock a b
  for ((s = START; s < NF; s += STEP)); do
    name=$(printf 'f%05d' "$s")
    [ -s "$CH/$name.mp4" ] && continue
    mkdir "$CH/$name.lock" 2>/dev/null || continue
    a=$(node -e "console.log($s/$FPS)")
    b=$(node -e "console.log(Math.min($NF, $s + $STEP)/$FPS)")
    # a load spike can push one frame past the capture's 30 s screenshot timeout: retry the chunk, 3 attempts
    for attempt in 1 2 3; do
      echo "[worker $w] $name: $a..$b s (attempt $attempt)"
      if node "$SKILL/sims/capture.mjs" beetle-film --size 1600x900 --dpr 1.2 --fps $FPS --from "$a" --to "$b" --out "$CH/$name.part.mp4"; then
        mv "$CH/$name.part.mp4" "$CH/$name.mp4"
        break
      fi
      echo "[worker $w] $name attempt $attempt failed" >&2
      rm -f "$CH/$name.part.mp4"
      sleep 15
    done
    rmdir "$CH/$name.lock"
  done
}
for ((j = 1; j <= JOBS; j++)); do
  worker "$j" &
  sleep 20 # stagger the browser launches
done
wait

# join only when the chunks cover every frame exactly once
ls "$CH"/*.lock >/dev/null 2>&1 && { echo "other workers still running; they will join the film"; exit 0; }
have=0
for f in "$CH"/f*.mp4; do
  n=$(ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$f")
  have=$((have + n))
done
if [ "$have" -ne "$NF" ]; then echo "chunks hold $have of $NF frames; not joining yet"; exit 0; fi
ls "$CH"/f*.mp4 | sed "s/^/file '/; s/$/'/" > "$OUT/chunks.txt"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$OUT/chunks.txt" -c copy "$OUT/beetle-silent.mp4"
ffmpeg -loglevel error -y -i "$OUT/beetle-silent.mp4" -i "$OUT/beetle-score.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -movflags +faststart "$OUT/dynastes-rb1.mp4"
echo "→ $OUT/dynastes-rb1.mp4 ($NF frames)"
