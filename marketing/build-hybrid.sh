#!/usr/bin/env bash
#
# בונה את הקאט המשולב של §8.5 ב-reel-prompt.md: פורס את quickoffer-ad.mp4 לסצנות,
# משלב ביניהן שישה קליפים חיים מ-hf/, ומדביק הכול לקובץ אחד.
#
# קליפ שעוד לא קיים ב-hf/ מוחלף בסלייט בצבע המותג עם הפרומפט והאורך, כך שהקאט
# תמיד מתרנדר ואפשר לראות את הקצב לפני שיש חומר. ככל שנוחתים קבצים, האנימטיק
# הופך לסרט - בלי לגעת בסקריפט.
#
#   ./build-hybrid.sh            → quickoffer-ad-hybrid.mp4
#
set -euo pipefail
cd "$(dirname "$0")"

SRC="quickoffer-ad.mp4"
OUT="quickoffer-ad-hybrid.mp4"
WORK=".build"
SYSFONT="/System/Library/Fonts/Supplemental/Arial Bold.ttf"

# פרמטרי קידוד זהים לכל סגמנט. keyint קבוע ובלי scenecut, כדי שההדבקה
# בסוף תהיה -c copy נקייה בלי קידוד שני.
#
# CRF 22 ולא 16: הגריין הטמפורלי (GRAIN למטה) משנה כל פיקסל בכל פריים ומבטל
# כמעט לגמרי את החיזוי בין פריימים. באותו קאט, alls=6 ב-CRF 16 נתן 405MB
# ו-alls=2 ב-CRF 22 נותן ~6MB - באותה מידה של "יושב עם חומר מצולם".
ENC=(-c:v libx264 -preset medium -crf 22 -pix_fmt yuv420p -profile:v high
     -x264-params "keyint=60:min-keyint=60:scenecut=0" -r 30 -an)
GRAIN="noise=alls=2:allf=t"

# ─── ה-EDL. זה המקום היחיד לשנות את הקאט ────────────────────────────────────
# gfx|<id>|<in>|<out>|<flag>     חיתוך מתוך quickoffer-ad.mp4 (שניות)
# live|<id>|<duration>||<flag>   חריץ לייב-אקשן; משתמש ב-hf/<id>.mp4 אם קיים
# flag "paper" = בלי ויניטה. המסמך חייב להישאר נייר לבן (reel-prompt.md §4)
EDL=(
  "live|hf-a|2.0||"
  "gfx|s1|0|4|"
  "live|hf-b|2.0||"
  "gfx|s3|7.5|11|"
  "live|hf-d|3.5||"
  "gfx|s5|15.5|21|"
  "gfx|s6|21|26.5|paper"
  "live|hf-e|1.2||"
  "gfx|s7|26.5|31|paper"
  "gfx|s8|31|34|"
  "live|hf-f|1.2||"
  "gfx|s9|34|37.5|"
)
# להורדה ל-~37.6 שנ׳: למחוק את שורת s8. ההתראה עדיין מסופרת ע"י hf-f.

# ─── כותרת וגוף הסלייט לכל חריץ ─────────────────────────────────────────────
slate_body() {
  case "$1" in
    hf-a) printf '%s\n%s\n' "hands in the panel" "phone buzzes - unanswered" ;;
    hf-b) printf '%s\n%s\n' "one-finger typing in the van" "screen turned away" ;;
    hf-d) printf '%s\n%s\n' "holds the record button" "phone covers his mouth" ;;
    hf-e) printf '%s\n%s\n' "thumb signing on glass" "flat grey screen - replaced in post" ;;
    hf-f) printf '%s\n%s\n' "a glance - a small smile" "back to work" ;;
    *)    printf '%s\n' "$1" ;;
  esac
}

rm -rf "$WORK"; mkdir -p "$WORK" hf
# הפונט מועתק לשם בלי רווחים - נתיב עם רווח שובר מחרוזת פילטר
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
    # גריין עדין כדי שהגרפיקה תשב עם חומר מצולם. ויניטה בכל מקום חוץ מהמסמך
    vf="fps=30,$GRAIN"
    [ "$flag" = "paper" ] || vf="$vf,vignette=PI/6"
    echo "  [$i] gfx  $id  $a-$b"
    ffmpeg -nostdin -loglevel error -y -i "$SRC" -ss "$a" -to "$b" \
      -vf "$vf" "${ENC[@]}" "$seg"

  elif [ -f "hf/$id.mp4" ]; then
    # נרמול לפי §8.6: 1080x1920@30 והרגעת הסטורציה/ניגודיות של הפלט מהמודל
    echo "  [$i] LIVE $id  ${a}s  (hf/$id.mp4)"
    ffmpeg -nostdin -loglevel error -y -i "hf/$id.mp4" -t "$a" \
      -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,eq=saturation=0.94:contrast=1.02:gamma=0.98" \
      "${ENC[@]}" "$seg"

  else
    # אין קליפ - סלייט. הפס התחתון מראה את האורך שהחריץ תופס בקאט
    missing=$((missing + 1))
    slate_body "$id" > "$WORK/$id.txt"
    up=$(echo "$id" | tr 'a-z-' 'A-Z ')
    echo "  [$i] slate $id  ${a}s  (חסר hf/$id.mp4)"
    ffmpeg -nostdin -loglevel error -y -f lavfi -i "color=c=0x0b1220:s=1080x1920:r=30:d=$a" \
      -vf "drawtext=fontfile=$FONT:text=$up:fontcolor=0x2dd4bf:fontsize=130:x=(w-text_w)/2:y=h/2-430,\
drawtext=fontfile=$FONT:textfile=$WORK/$id.txt:fontcolor=0xd3dbe6:fontsize=50:line_spacing=22:x=(w-text_w)/2:y=(h-text_h)/2,\
drawtext=fontfile=$FONT:text=higgsfield ${a}s:fontcolor=0x7c8899:fontsize=38:x=(w-text_w)/2:y=h/2+330,\
drawtext=fontfile=$FONT:text=drop hf/$id.mp4 here:fontcolor=0x475569:fontsize=32:x=(w-text_w)/2:y=h-260,\
drawbox=x=0:y=ih-12:w=iw*t/$a:h=12:color=0x2dd4bf@0.9:t=fill" \
      "${ENC[@]}" "$seg"
  fi

  echo "file '$(basename "$seg")'" >> "$WORK/concat.txt"
done

ffmpeg -nostdin -loglevel error -y -f concat -safe 0 -i "$WORK/concat.txt" -c copy "$OUT"

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
echo
printf '%s  %.1f שנ׳\n' "$OUT" "$dur"
if [ "$missing" -gt 0 ]; then
  echo "אנימטיק: $missing מתוך 6 החריצים החיים עדיין סלייטים."
  echo "הפרומפטים ב-reel-prompt.md §8.7, חוזה הקבצים ב-hf/README.md."
else
  echo "קאט משולב מלא. להוסיף וויס-אובר ומוזיקה:"
  echo "  ffmpeg -i $OUT -i vo.wav -i music.wav -filter_complex \\"
  echo "    \"[1:a]volume=1.0[v];[2:a]volume=0.22[m];[v][m]amix=inputs=2:duration=first[a]\" \\"
  echo "    -map 0:v -map '[a]' -c:v copy -c:a aac -b:a 192k reel-final.mp4"
fi
