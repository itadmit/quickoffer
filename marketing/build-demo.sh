#!/usr/bin/env bash
#
# Assembles the demo reel: slices demo-screens.mp4 for every screen beat and
# splices the Higgsfield clips from hf/ between them, per demo-script.md §2.
#
# A live slot with no file yet becomes a brand-coloured slate carrying its
# prompt and length, so the cut always renders and the pacing can be judged
# before any credits are spent.
#
#   ./build-demo.sh            -> quickoffer-demo.mp4
#
set -euo pipefail
cd "$(dirname "$0")"

SRC="demo-screens.mp4"
OUT="quickoffer-demo.mp4"
WORK=".build-demo"
SYSFONT="/System/Library/Fonts/Supplemental/Arial Bold.ttf"

# Same encode for every segment, fixed keyint and no scenecut, so the final
# concat is a clean -c copy with no second generation of compression.
ENC=(-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -profile:v high
     -x264-params "keyint=60:min-keyint=60:scenecut=0" -r 30 -an)
GRAIN="noise=alls=2:allf=t"

# ─── the EDL. The only place the cut is defined ─────────────────────────────
# gfx |<id>|<in>|<out>|<flag>         slice of demo-screens.mp4, seconds
# live|<id>|<duration>|<in>|<flag>    hf/<id>.mp4 from <in>, for <duration>
# flag "paper" = no vignette. The quote page is a white document and has to
# stay paper-white (reel-prompt.md §4).
EDL=(
  # One continuous take for the whole opening. It used to be two clips - a
  # glance and then a separate recording shot - and the cut between them bought
  # nothing: it is one gesture, and Kling gives 5s, so it fits in one.
  "live|hf-open|4.8|0.15|"       # 0.0  glances at the phone, raises it, records
  "gfx|screens|4.8|26.6|"        # 4.8  list -> עופר -> record -> LISTEN -> quote -> send -> the document
  "live|hf-smile|1.5|2.5|"       # 26.6 a glance, a small smile  ("איזה פשוט!")
  "gfx|end|28.1|35.0|"           # 28.1 brand line, then the free offer
)

slate_body() {
  case "$1" in
    hf-open)  printf '%s\n%s\n' "in the van: glances, raises, records" "screen turned away" ;;
    hf-smile) printf '%s\n%s\n' "a glance - a small smile" "back to work" ;;
    *)        printf '%s\n' "$1" ;;
  esac
}

[ -f "$SRC" ] || { echo "missing $SRC - run: node render-demo.mjs" >&2; exit 1; }

mkdir -p "$WORK" hf
rm -f "$WORK"/[0-9][0-9]-*.mp4 "$WORK/concat.txt"
# the font is copied to a path with no spaces; a space breaks the filter string
cp "$SYSFONT" "$WORK/slate.ttf"
FONT="$WORK/slate.ttf"

: > "$WORK/concat.txt"
missing=0
i=0

for row in "${EDL[@]}"; do
  IFS='|' read -r kind id a b flag <<< "$row"
  i=$((i + 1))
  seg=$(printf "%s/%02d-%s.mp4" "$WORK" "$i" "$id")

  if [ "$kind" = "gfx" ]; then
    # light grain so the graphics sit with the shot material; vignette
    # everywhere except the document
    vf="fps=30,$GRAIN"
    [ "$flag" = "paper" ] || vf="$vf,vignette=PI/6"
    printf '  [%2d] gfx   %-10s %s-%s\n' "$i" "$id" "$a" "$b"
    ffmpeg -nostdin -loglevel error -y -i "$SRC" -ss "$a" -to "$b" \
      -vf "$vf" "${ENC[@]}" "$seg"

  elif [ -f "hf/$id.mp4" ]; then
    # normalise to 1080x1920@30 and calm the model's saturation/contrast.
    # -ss before -i so <in> is an accurate seek into the take.
    printf '  [%2d] LIVE  %-10s %ss from %ss\n' "$i" "$id" "$a" "$b"
    ffmpeg -nostdin -loglevel error -y -ss "$b" -i "hf/$id.mp4" -t "$a" \
      -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,eq=saturation=0.94:contrast=1.02:gamma=0.98" \
      "${ENC[@]}" "$seg"

  else
    missing=$((missing + 1))
    slate_body "$id" > "$WORK/$id.txt"
    up=$(echo "$id" | tr 'a-z-' 'A-Z ')
    printf '  [%2d] slate %-10s %ss   (missing hf/%s.mp4)\n' "$i" "$id" "$a" "$id"
    ffmpeg -nostdin -loglevel error -y -f lavfi -i "color=c=0x0b1220:s=1080x1920:r=30:d=$a" \
      -vf "drawtext=fontfile=$FONT:text=$up:fontcolor=0x2dd4bf:fontsize=120:x=(w-text_w)/2:y=h/2-420,\
drawtext=fontfile=$FONT:textfile=$WORK/$id.txt:fontcolor=0xd3dbe6:fontsize=48:line_spacing=22:x=(w-text_w)/2:y=(h-text_h)/2,\
drawtext=fontfile=$FONT:text=higgsfield ${a}s:fontcolor=0x7c8899:fontsize=36:x=(w-text_w)/2:y=h/2+330,\
drawbox=x=0:y=ih-12:w=iw*t/$a:h=12:color=0x2dd4bf@0.9:t=fill" \
      "${ENC[@]}" "$seg"
  fi

  echo "file '$(basename "$seg")'" >> "$WORK/concat.txt"
done

CAPS="$WORK/caps"
if [ -d "$CAPS" ] && [ -n "$(ls -A "$CAPS" 2>/dev/null)" ]; then
  # Captions are a transparent PNG sequence rather than a subtitle track: they
  # have to sit over the Higgsfield shots as well as the graphics, and burning
  # them here means one file ships. This is the only re-encode of the picture -
  # everything above was built so the concat itself stays -c copy.
  echo "  [cc] burning captions from $CAPS"
  ffmpeg -nostdin -loglevel error -y -f concat -safe 0 -i "$WORK/concat.txt" \
    -framerate 30 -i "$CAPS/%05d.png" \
    -filter_complex "[0:v][1:v]overlay=0:0:format=auto,fps=30[v]" \
    -map "[v]" "${ENC[@]}" "$OUT"
else
  echo "  [cc] no caption frames - run: node render-captions.mjs"
  ffmpeg -nostdin -loglevel error -y -f concat -safe 0 -i "$WORK/concat.txt" -c copy "$OUT"
fi

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
echo
printf '%s  %.2f s\n' "$OUT" "$dur"
if [ "$missing" -gt 0 ]; then
  echo "animatic: $missing live slot(s) are still slates. Prompts: demo-script.md §5."
else
  echo "full cut. Soundtrack next:  ./mix-demo.sh"
fi
