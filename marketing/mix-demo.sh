#!/usr/bin/env bash
#
# Lays the soundtrack over the demo cut: the voice note, UI cues, a pad, and
# the two narration lines.
#
#   ./mix-demo.sh             -> quickoffer-demo-vo.mp4
#
# Picture map (demo-script.md §2):
#   0.0  n1 lifts the phone      1.0  hf-d records        4.6  recording screen
#   7.6  n2 lowers it            8.6  bubble + processing 10.0 the quote lands
#  14.0  one-tap send           15.2  the customer's chat 16.2 she opens it
#  17.4  the quote page         19.6  she signs           20.8 his phone buzzes
#  22.0  approved               23.6  end card
#
# Every gain below is the number that brings that file to a stated RMS target,
# measured with volumedetect - not a value picked by ear. The ElevenLabs assets
# differ by up to 40dB from each other, so one flat multiplier would bury the
# quiet ones and clip the loud ones.
set -euo pipefail
cd "$(dirname "$0")"

IN="quickoffer-demo.mp4"
OUT="quickoffer-demo-vo.mp4"
A="audio"

VN_G=1.00       # voicenote-demo  -22.1dB - already on target, it carries 0-8.6
VO_G=0.75       # narration-demo  -17.5dB -> -20
MUS_G=0.30      # pad1            -26.5dB -> -37, it only holds the floor
VAN_G=1.84      # van             -42.3dB -> -37
SEND_G=0.25     # send            -15.9dB -> -28
UI_G=0.50       # ui              -24.9dB -> -31
DING_G=0.89     # ding            -25.0dB -> -26
SIGN_G=0.83     # sign            -25.4dB -> -27
VIBRATE_G=0.126 # vibrate          -6.0dB -> -24, deliberately restrained so it
                #                  does not read as an electrical buzz
NOTIF_G=0.86    # notif           -26.7dB -> -28

# Narration in/out points measured with silencedetect on narration-demo.mp3.
# Re-measure if that file is regenerated - the lines are not stretched to fit,
# each is placed so its own phrases land on their own picture beats.
#
# Line 2 is placed at 20.0 rather than on the end card, because its three
# phrases then fall exactly where they belong: "הודעה קולית אחת" as his phone
# buzzes, "ועסקה סגורה" as the ✅ lands, "קוויק אופר" on the card.
VO1_IN=0.00; VO1_OUT=4.25; VO1_AT=10100
VO2_IN=4.50; VO2_OUT=9.15; VO2_AT=20000

[ -f "$IN" ] || { echo "missing $IN - run ./build-demo.sh first" >&2; exit 1; }

# Narration is optional: the cut is built to carry on the voice note and the UI
# alone, so a missing file drops the two lines instead of failing the mix.
if [ -f "$A/narration-demo.mp3" ]; then
  NAR_IN=(-i "$A/narration-demo.mp3")
  NAR_F="[10:a]volume=${VO_G}[nar];
    [nar]asplit=2[na][nb];
    [na]atrim=${VO1_IN}:${VO1_OUT},asetpts=PTS-STARTPTS,adelay=${VO1_AT}|${VO1_AT}[v1];
    [nb]atrim=${VO2_IN}:${VO2_OUT},asetpts=PTS-STARTPTS,adelay=${VO2_AT}|${VO2_AT}[v2];
    [v1][v2]amix=inputs=2:normalize=0[VOXA];"
else
  echo "note: $A/narration-demo.mp3 not found - mixing without narration"
  NAR_IN=()
  NAR_F="anullsrc=r=48000:cl=mono,atrim=0:25.2,asetpts=PTS-STARTPTS[VOXA];"
fi

# Note: an ffmpeg filtergraph has no comment syntax - /* */ inside
# -filter_complex is a parse error, so the commentary stays out here.
# The graph ends in stereo because every source is mono and a mono AAC track is
# the kind of thing a social platform re-encodes oddly. Dual-mono costs nothing.
ffmpeg -nostdin -loglevel error -y -i "$IN" \
  -i "$A/voicenote-demo.mp3" -i "$A/van.mp3" -i "$A/send.mp3" -i "$A/ui.mp3" \
  -i "$A/ding.mp3" -i "$A/sign.mp3" -i "$A/vibrate.mp3" -i "$A/notif.mp3" \
  -i "$A/pad1.mp3" "${NAR_IN[@]}" \
  -filter_complex "
  ${NAR_F}
  [VOXA]asplit=2[VOX][VOSC];

  [1:a]volume=${VN_G},adelay=1000|1000[VN];
  [2:a]atrim=0:9.4,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.8,afade=t=out:st=8.2:d=1.2,volume=${VAN_G}[AMB];

  [4:a]asplit=3[u1][u2][u3];
  [5:a]asplit=2[d1][d2];
  [3:a]volume=${SEND_G},adelay=8620|8620[s1];
  [u1]volume=${UI_G},adelay=9280|9280[s2];
  [d1]volume=${DING_G},adelay=10180|10180[s3];
  [u2]volume=${UI_G},adelay=14640|14640[s4];
  [d2]volume=${DING_G},adelay=15620|15620[s5];
  [u3]volume=${UI_G},adelay=17450|17450[s6];
  [6:a]volume=${SIGN_G},adelay=19750|19750[s7];
  [7:a]volume=${VIBRATE_G},adelay=20850|20850[s8];
  [8:a]volume=${NOTIF_G},adelay=22180|22180[s9];
  [s1][s2][s3][s4][s5][s6][s7][s8][s9]amix=inputs=9:normalize=0[SFX];

  [9:a]atrim=0:17.0,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1.6,afade=t=out:st=15.4:d=1.6,
       volume=${MUS_G},adelay=8600|8600[MUS];
  [MUS][VOSC]sidechaincompress=threshold=0.05:ratio=6:attack=12:release=420[MUSD];

  [VN][AMB][SFX][MUSD][VOX]amix=inputs=5:normalize=0:duration=longest[PRE];
  [PRE]loudnorm=I=-14:TP=-1.0:LRA=11,aresample=48000,
       aformat=channel_layouts=stereo,atrim=0:25.2[MIX]
  " -map 0:v -map "[MIX]" -c:v copy -c:a aac -b:a 192k "$OUT"

echo
ffmpeg -nostdin -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1 |
  grep -E "^\s+(I|LRA|Peak):" | head -4
printf '%s  %.2f s\n' "$OUT" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")"
