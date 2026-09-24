#!/usr/bin/env bash
#
# מייצא את הפסקול בנפרד מהתמונה, לחיבור בעורך חיצוני.
#
#   ./export-audio.sh        → export/
#
# כל הקבצים באורך זהה (39.4 שנ׳) ומתחילים ב-0, כך שמספיק להפיל אותם על הטיימליין
# בזמן 00:00 והם מסונכרנים. אין צורך ביישור ידני.
#
#   export/video-silent.mp4   התמונה בלבד, בלי סאונד
#   export/mix.wav            הפסקול המלא (מסתכם עם הסטמים, עם ראש)
#   export/mix-loud.wav       אותו פסקול מנורמל ל--15 LUFS, להדבקה ישירה
#   export/stem-vo.wav        קריינות + ההודעה הקולית
#   export/stem-sfx.wav       אפקטים נקודתיים
#   export/stem-ambience.wav  רעש רקע (רחוב / תא הרכב)
#   export/stem-music.wav     מצע מוזיקלי (כבר עם דאקינג מתחת לקריינות)
#
# הסטמים מסתכמים בדיוק ל-mix.wav: כולם מקבלים את אותו gain קבוע, ואין לימיטר
# על אף קובץ. loudnorm או לימיטר על כל סטם בנפרד היו הורסים את הסכימה.
# יש 3dB ראש - העורך יעשה את הנרמול הסופי.
#
set -euo pipefail
cd "$(dirname "$0")"

IN="quickoffer-ad-hybrid.mp4"
A="audio"
OUTDIR="export"
TARGET_LUFS=-15
mkdir -p "$OUTDIR"

# ─── מה נכלל בפסקול ─────────────────────────────────────────────────────────
# 1 = בפנים, 0 = בחוץ. הגרף לא משתנה - רק ה-gain יורד ל-0, כך שאפשר להחזיר
# בלי לגעת בשום דבר אחר.
INCLUDE_SCREW=0       # סאונד ההברגה בפתיחה
INCLUDE_VOICENOTE=0   # ההודעה הקולית (הפלייסהולדר) - החריץ נשאר פתוח ב-12.3 שנ׳
INCLUDE_SIGN=0        # צליל האצבע על הזכוכית בשוט החתימה

VO_G=0.54; VN_G=$([ "$INCLUDE_VOICENOTE" = 1 ] && echo 0.57 || echo 0); OFER_G=0.54; MUS_G=0.47
STREET_G=2.34; VAN_G=1.84; SCREW_G=$([ "$INCLUDE_SCREW" = 1 ] && echo 5.31 || echo 0); VIBRATE_G=0.126
NOTIF_G=0.86; SEND_G=0.25; UI_G=0.50; SIGN_G=$([ "$INCLUDE_SIGN" = 1 ] && echo 0.83 || echo 0); DING_G=0.89

# הגרף זהה ל-mix-audio.sh, רק שכאן הוא מסתעף לארבעה סטמים במקום להתמזג לאחד
GRAPH="
  [1:a]volume=${VO_G}[nar];
  [nar]asplit=5[n1][n3][n4][n5][n6];
  [n1]atrim=0:3.170,asetpts=PTS-STARTPTS,adelay=5400|5400[v1];
  [3:a]volume=${OFER_G},adelay=8700|8700[v2];
  [2:a]volume=${VN_G},adelay=12300|12300[vn];
  [n3]atrim=5.700:12.440,asetpts=PTS-STARTPTS,adelay=18800|18800[v3];
  [n4]atrim=12.440:16.000,asetpts=PTS-STARTPTS,adelay=25700|25700[v4];
  [n5]atrim=16.000:18.240,asetpts=PTS-STARTPTS,adelay=31900|31900[v5];
  [n6]atrim=18.240:21.708,asetpts=PTS-STARTPTS,adelay=35200|35200[v6];
  [v1][v2][vn][v3][v4][v5][v6]amix=inputs=7:normalize=0,aresample=48000,apad[VOA];
  [VOA]asplit=3[VO][VOSC][VOOUT];
  [4:a]atrim=0:8,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1,afade=t=out:st=6.4:d=1.6,volume=${STREET_G}[amb1];
  [5:a]asplit=2[van1][van2];
  [van1]atrim=0:8,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.6,afade=t=out:st=6.6:d=1.4,volume=${VAN_G},adelay=6000|6000[amb2];
  [van2]atrim=0:4,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.5,afade=t=out:st=2.8:d=1.2,volume=${VAN_G},adelay=11500|11500[amb3];
  [amb1][amb2][amb3]amix=inputs=3:normalize=0,apad[AMB];
  [AMB]asplit=2[AMBMIX][AMBOUT];
  [6:a]atrim=0:2.1,asetpts=PTS-STARTPTS,afade=t=out:st=1.5:d=0.6,volume=${SCREW_G}[sx0];
  [7:a]volume=${VIBRATE_G},adelay=1050|1050[sx1];
  [8:a]asplit=2[nf1][nf2];
  [nf1]volume=${NOTIF_G},adelay=2150|2150[sx2];
  [nf2]volume=${NOTIF_G},adelay=4420|4420[sx2b];
  [9:a]volume=${SEND_G},adelay=8200|8200[sx3];
  [10:a]volume=${UI_G},adelay=17200|17200[sx4];
  [11:a]volume=${SIGN_G},adelay=26050|26050[sx5];
  [12:a]volume=${DING_G},adelay=31750|31750[sx6];
  [sx0][sx1][sx2][sx2b][sx3][sx4][sx5][sx6]amix=inputs=8:normalize=0,apad[SFXA];
  [SFXA]asplit=2[SFXMIX][SFXOUT];
  [13:a]volume=${MUS_G}[p1];
  [14:a]volume=1.05[p2];
  [p1][p2]acrossfade=d=3:c1=tri:c2=tri[padcat];
  [padcat]atrim=0:29.0,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=2.5,afade=t=out:st=26:d=3,adelay=10500|10500,apad[MUS];
  [MUS][VOSC]sidechaincompress=threshold=0.055:ratio=6:attack=25:release=420:makeup=1[MUSD];
  [MUSD]asplit=2[MUSMIX][MUSOUT];
  [VO][AMBMIX][SFXMIX][MUSMIX]amix=inputs=4:normalize=0[RAW];
  [RAW]anull[RAWOUT]
"
INPUTS=(-i "$IN" -i "$A/narration.mp3" -i "$A/voicenote.mp3" -i "$A/line-ofer.mp3"
        -i "$A/street.mp3" -i "$A/van.mp3" -i "$A/screw.mp3" -i "$A/vibrate.mp3"
        -i "$A/notif.mp3" -i "$A/send.mp3" -i "$A/ui.mp3" -i "$A/sign.mp3" -i "$A/ding.mp3"
        -i "$A/pad1.mp3" -i "$A/pad2.mp3")

# ─── מעבר 1: מרנדרים הכול פעם אחת ברמה גולמית ───────────────────────────────
echo "מרנדר תמונה, מיקס וסטמים..."
ffmpeg -nostdin -loglevel error -y "${INPUTS[@]}" -filter_complex "${GRAPH}" \
  -map 0:v -c:v copy -an -t 39.4 "$OUTDIR/video-silent.mp4" \
  -map "[RAWOUT]" -c:a pcm_s24le -ar 48000 -t 39.4 "$OUTDIR/mix.wav" \
  -map "[VOOUT]"  -c:a pcm_s24le -ar 48000 -t 39.4 "$OUTDIR/stem-vo.wav" \
  -map "[SFXOUT]" -c:a pcm_s24le -ar 48000 -t 39.4 "$OUTDIR/stem-sfx.wav" \
  -map "[AMBOUT]" -c:a pcm_s24le -ar 48000 -t 39.4 "$OUTDIR/stem-ambience.wav" \
  -map "[MUSOUT]" -c:a pcm_s24le -ar 48000 -t 39.4 "$OUTDIR/stem-music.wav"

# ─── מעבר 2: gain קבוע אחד, זהה לכל הקבצים ──────────────────────────────────
# בלי לימיטר על אף קובץ. לימיטר לכל קובץ בנפרד שובר את הסכימה: הוא נכנס על
# המיקס במקומות שבהם הוא לא נכנס על הסטמים, והסטמים מפסיקים להסתכם למיקס.
# במקום זה בוחרים gain שממילא לא מגיע לקליפ, ומשאירים 3dB ראש לעורך.
read -r MEAS TPEAK < <(ffmpeg -nostdin -hide_banner -i "$OUTDIR/mix.wav" -af ebur128=peak=true -f null - 2>&1 \
  | awk '/^ *I: /{i=$2} /^ *Peak: /{p=$2} END{print i, p}')
G_LOUD=$(python3 -c "print(10**((${TARGET_LUFS}-(${MEAS}))/20))")
G_PEAK=$(python3 -c "print(10**((-3.0-(${TPEAK}))/20))")
GAIN=$(python3 -c "print(round(min(${G_LOUD}, ${G_PEAK}), 4))")
echo "  גולמי: ${MEAS} LUFS, שיא ${TPEAK} dBFS"
echo "  gain ×${GAIN}  (יעד עוצמה ×$(printf '%.3f' ${G_LOUD}), תקרת שיא ×$(printf '%.3f' ${G_PEAK}) - נבחר הנמוך)"
for f in mix stem-vo stem-sfx stem-ambience stem-music; do
  ffmpeg -nostdin -loglevel error -y -i "$OUTDIR/$f.wav" \
    -af "volume=${GAIN}" -c:a pcm_s24le -ar 48000 "$OUTDIR/$f.tmp.wav"
  mv "$OUTDIR/$f.tmp.wav" "$OUTDIR/$f.wav"
done

# ─── מאסטר שני, לשימוש ישיר ─────────────────────────────────────────────────
# mix.wav שומר על ראש ומסתכם בדיוק עם הסטמים, ולכן הוא יוצא שקט (~-21 LUFS).
# מי שרק רוצה להדביק סאונד לתמונה בלי לגעת באיזון - שייקח את mix-loud.wav.
ffmpeg -nostdin -loglevel error -y -i "$OUTDIR/mix.wav" \
  -af "loudnorm=I=-15:TP=-1.5:LRA=9,alimiter=limit=0.95" \
  -c:a pcm_s24le -ar 48000 "$OUTDIR/mix-loud.wav"
echo "  נכתב גם mix-loud.wav (מנורמל ל--15 LUFS, לא מסתכם עם הסטמים)"

echo
printf '%-26s %8s %10s\n' "קובץ" "אורך" "גודל"
for f in "$OUTDIR"/*.wav "$OUTDIR"/*.mp4; do
  printf '%-26s %8.2f %9sK\n' "$(basename "$f")" \
    "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")" \
    "$(( $(stat -f%z "$f") / 1024 ))"
done
