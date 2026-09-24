#!/usr/bin/env bash
#
# מלביש את הפסקול על הקאט המשולב: קריינות, ההודעה הקולית, אפקטים ומצע מוזיקלי.
#
# כל הזמנים כאן הם מיקומים בקאט של 39.4 שנ׳ (טבלת §8.5 ב-reel-prompt.md,
# אחרי שהוצא HF-C). הקריינות נחתכת לבלוקים לפי גבולות משפטים שנמדדו בקובץ
# המקור, וכל בלוק מונח על פעימת התמונה שלו - לא נמתח על ציר אחיד.
#
#   ./mix-audio.sh            → quickoffer-ad-hybrid-vo.mp4
#
# מפת התמונה:
#   0.0  hf-a ידיים בלוח      2.0  s1 ההודעה       6.0  hf-b ברכב
#   8.0  s3 עופר הבוט שלנו   11.5  hf-d מקליט      15.0 s5 תמלול→טבלה
#  20.5  s6 המסמך            26.0  hf-e חותם       27.2 s7 אישור
#  31.7  s8 התראה            34.7  hf-f חיוך       35.9 s9 CTA
#
set -euo pipefail
cd "$(dirname "$0")"

IN="quickoffer-ad-hybrid.mp4"
OUT="quickoffer-ad-hybrid-vo.mp4"
A="audio"

# ─── רמות ───────────────────────────────────────────────────────────────────
# כל ערך כאן הוא gain שמביא את הקובץ ליעד RMS מוצהר, ולא מספר שנבחר בעין.
# הקבצים שחוזרים מ-ElevenLabs נבדלים זה מזה ב-40dB (screw -44.5, vibrate -6.0),
# ולכן מכפיל אחיד על כולם פשוט מעלים את השקטים שבהם.
# ─── מה נכלל בפסקול ─────────────────────────────────────────────────────────
# 1 = בפנים, 0 = בחוץ. הגרף לא משתנה - רק ה-gain יורד ל-0, כך שאפשר להחזיר
# בלי לגעת בשום דבר אחר.
INCLUDE_SCREW=0       # סאונד ההברגה בפתיחה
INCLUDE_VOICENOTE=0   # ההודעה הקולית (הפלייסהולדר) - החריץ נשאר פתוח ב-12.3 שנ׳
INCLUDE_SIGN=0        # צליל האצבע על הזכוכית בשוט החתימה

VO_G=0.54        # narration  -14.7dB → -20
VN_G=$([ "$INCLUDE_VOICENOTE" = 1 ] && echo 0.57 || echo 0)        # voicenote  -17.1dB → -22
OFER_G=0.54      # line-ofer  -14.8dB → -20
MUS_G=0.47       # pad1       -26.5dB → -33
STREET_G=2.34    # street     -44.4dB → -37
VAN_G=1.84       # van        -42.3dB → -37
SCREW_G=$([ "$INCLUDE_SCREW" = 1 ] && echo 5.31 || echo 0)     # screw      -44.5dB → -30   הפעולה שרואים בפריים הראשון
VIBRATE_G=0.126  # vibrate     -6.0dB → -24   קצבי בכוונה, שלא יתחלף בזמזום חשמל
NOTIF_G=0.86     # notif      -26.7dB → -28
SEND_G=0.25      # send       -15.9dB → -28
UI_G=0.50        # ui         -24.9dB → -31
SIGN_G=$([ "$INCLUDE_SIGN" = 1 ] && echo 0.83 || echo 0)      # sign       -25.4dB → -27
DING_G=0.89      # ding       -25.0dB → -26

ffmpeg -nostdin -loglevel error -y -i "$IN" \
  -i "$A/narration.mp3" -i "$A/voicenote.mp3" -i "$A/line-ofer.mp3" \
  -i "$A/street.mp3" -i "$A/van.mp3" -i "$A/screw.mp3" -i "$A/vibrate.mp3" \
  -i "$A/notif.mp3" -i "$A/send.mp3" -i "$A/ui.mp3" -i "$A/sign.mp3" -i "$A/ding.mp3" \
  -i "$A/pad1.mp3" -i "$A/pad2.mp3" \
  -filter_complex "
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
  [VOA]asplit=2[VO][VOSC];
  [4:a]atrim=0:8,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1,afade=t=out:st=6.4:d=1.6,volume=${STREET_G}[amb1];
  [5:a]asplit=2[van1][van2];
  [van1]atrim=0:8,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.6,afade=t=out:st=6.6:d=1.4,volume=${VAN_G},adelay=6000|6000[amb2];
  [van2]atrim=0:4,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.5,afade=t=out:st=2.8:d=1.2,volume=${VAN_G},adelay=11500|11500[amb3];
  [amb1][amb2][amb3]amix=inputs=3:normalize=0[AMB];
  [6:a]atrim=0:2.1,asetpts=PTS-STARTPTS,afade=t=out:st=1.5:d=0.6,volume=${SCREW_G}[sx0];
  [7:a]volume=${VIBRATE_G},adelay=1050|1050[sx1];
  [8:a]asplit=2[nf1][nf2];
  [nf1]volume=${NOTIF_G},adelay=2150|2150[sx2];
  [nf2]volume=${NOTIF_G},adelay=4420|4420[sx2b];
  [9:a]volume=${SEND_G},adelay=8200|8200[sx3];
  [10:a]volume=${UI_G},adelay=17200|17200[sx4];
  [11:a]volume=${SIGN_G},adelay=26050|26050[sx5];
  [12:a]volume=${DING_G},adelay=31750|31750[sx6];
  [sx0][sx1][sx2][sx2b][sx3][sx4][sx5][sx6]amix=inputs=8:normalize=0[SFX];
  [13:a]volume=${MUS_G}[p1];
  [14:a]volume=1.05[p2];
  [p1][p2]acrossfade=d=3:c1=tri:c2=tri[padcat];
  [padcat]atrim=0:29.0,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=2.5,afade=t=out:st=26:d=3,adelay=10500|10500[MUS];
  [MUS][VOSC]sidechaincompress=threshold=0.055:ratio=6:attack=25:release=420:makeup=1[MUSD];
  [VO][AMB][SFX][MUSD]amix=inputs=4:normalize=0,
    loudnorm=I=-15:TP=-1.5:LRA=9,alimiter=limit=0.95,aresample=48000[mix]" \
  -map 0:v -map "[mix]" -shortest -c:v copy -c:a aac -b:a 192k "$OUT"

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
printf '%s  %.1f שנ׳  (וידאו הועתק, אודיו חדש)\n' "$OUT" "$dur"
