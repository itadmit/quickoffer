#!/usr/bin/env bash
#
# Lays the soundtrack over the demo cut: the narration, the voice note, UI cues
# and a pad.
#
#   ./mix-demo.sh             -> quickoffer-demo-vo.mp4
#
# Picture map (demo-script.md §2):
#   0.0  he lifts the phone      1.6  hf-d records       4.8  WhatsApp list
#   6.6  taps עופר               8.0  holds the mic
#   9.7  THE RECORDING PLAYS - all 7.6s of it, through "לפני מע״מ"
#  17.3  the bubble lands       18.0  ⏳ מעבד            19.7  the quote lands
#  19.9  the numbers land - the one place the calculating sound plays
#  21.8  one-tap send           23.4  the customer's chat
#  24.4  taps the preview card  24.6  THE QUOTE ITSELF, 2s to look at it
#  26.6  his smile              28.1  end card + the free offer
#
# Unlike v1 the narration is ONE continuous take and is laid at 0 with no
# splitting: it is a real recording with its own breathing, and cutting it into
# blocks to reposition them would undo exactly what makes it sound human. The
# picture was cut to the narration, not the other way round.
#
# Every gain below is the number that brings that file to a stated RMS target,
# measured with volumedetect - not a value picked by ear.
set -euo pipefail
cd "$(dirname "$0")"

IN="quickoffer-demo.mp4"
OUT="quickoffer-demo-vo.mp4"
A="audio"

VO_G=1.00       # narration-demo  -20.0dB - already on target, it is the spine
VN_G=0.79       # voicenote-demo  -22.1dB -> -24, a step under the narrator so
                #                  it reads as coming from inside the story
MUS_G=0.24      # pad1            -26.5dB -> -39, it only holds the floor
VAN_G=1.84      # van             -42.3dB -> -37
SEND_G=0.25     # send            -15.9dB -> -28
TAP_G=1.10      # tap             -31.2dB -> -30
DING_G=0.89     # ding            -25.0dB -> -26
# ⚠️ ui.mp3 is a 4.05s bright digital TEXTURE, not a click. It was being used as
# a tap at four points, so it covered 6.6-12.1 and 17.9-26.8 and read as a
# "calculating" sound running under most of the ad. It now plays exactly once,
# where numbers actually appear on screen, and taps use audio/tap.mp3.
CALC_G=0.55     # ui              -24.9dB -> -29, under the narrator

[ -f "$IN" ] || { echo "missing $IN - run ./build-demo.sh first" >&2; exit 1; }

# The narration is what this cut is built on, so unlike v1 a missing file is an
# error rather than something to mix around.
[ -f "$A/narration-demo.mp3" ] || {
  echo "missing $A/narration-demo.mp3 - the cut is timed to it" >&2; exit 1; }

# Note: an ffmpeg filtergraph has no comment syntax - /* */ inside
# -filter_complex is a parse error, so the commentary stays out here.
# The graph ends in stereo because every source is mono and a mono AAC track is
# the kind of thing a social platform re-encodes oddly. Dual-mono costs nothing.
WORK=".build-demo"; mkdir -p "$WORK"
PRE="$WORK/premix.wav"

ffmpeg -nostdin -loglevel error -y \
  -i "$A/narration-demo.mp3" -i "$A/voicenote-demo.mp3" -i "$A/van.mp3" \
  -i "$A/send.mp3" -i "$A/tap.mp3" -i "$A/ding.mp3" -i "$A/pad1.mp3" \
  -i "$A/ui.mp3" -i "$A/tap.mp3" -i "$A/send.mp3" \
  -filter_complex "
  [0:a]volume=${VO_G}[VOXA];
  [VOXA]asplit=2[VOX][VOSC];
  [1:a]volume=${VN_G},adelay=9700|9700[VN];
  [2:a]atrim=0:5.6,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.8,afade=t=out:st=4.2:d=1.4,volume=${VAN_G}[AMB];

  [4:a]asplit=3[u1][u2][u3];
  [3:a]asplit=2[w1][w2];
  [u1]volume=${TAP_G},adelay=6580|6580[s1];
  [u2]volume=${TAP_G},adelay=8000|8000[s2];
  [w1]volume=${SEND_G},adelay=17320|17320[s3];
  [5:a]volume=${DING_G},adelay=19700|19700[s4];
  [7:a]atrim=0.70:2.60,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.10,
       afade=t=out:st=1.60:d=0.30,volume=${CALC_G},adelay=19850|19850[s5];
  [u3]volume=${TAP_G},adelay=22750|22750[s6];
  [w2]volume=${SEND_G},adelay=23860|23860[s7];
  [8:a]volume=${TAP_G},adelay=24400|24400[s8];
  [9:a]volume=0.14,adelay=24600|24600[s9];
  [s1][s2][s3][s4][s5][s6][s7][s8][s9]amix=inputs=9:normalize=0[SFX];

  [6:a]atrim=0:30.4,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=2.0,afade=t=out:st=28.4:d=2.0,
       volume=${MUS_G},adelay=4600|4600[MUS];
  [MUS][VOSC]sidechaincompress=threshold=0.04:ratio=8:attack=12:release=460[MUSD];

  [VOX][VN][AMB][SFX][MUSD]amix=inputs=5:normalize=0:duration=longest,
    aresample=48000,aformat=channel_layouts=stereo,atrim=0:35.0[MIX]
  " -map "[MIX]" -c:a pcm_s16le "$PRE"

# Two-pass loudnorm. Single pass uses a running estimate and landed 1.6dB under
# target on this mix; measuring first and feeding the numbers back is the only
# way the printed loudness is the loudness you asked for.
LN="loudnorm=I=-14:TP=-1.0:LRA=11"
read -r M_I M_TP M_LRA M_TH M_OFF < <(
  ffmpeg -nostdin -hide_banner -i "$PRE" -af "${LN}:print_format=json" -f null - 2>&1 |
  python3 -c "
import sys, json, re
t = sys.stdin.read()
d = json.loads(t[t.rindex('{'):t.rindex('}') + 1])
print(d['input_i'], d['input_tp'], d['input_lra'], d['input_thresh'], d['target_offset'])"
)

ffmpeg -nostdin -loglevel error -y -i "$IN" -i "$PRE" \
  -af "${LN}:measured_I=${M_I}:measured_TP=${M_TP}:measured_LRA=${M_LRA}:measured_thresh=${M_TH}:offset=${M_OFF}:linear=true,aresample=48000" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k "$OUT"
rm -f "$PRE"

echo
ffmpeg -nostdin -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1 |
  grep -E "^\s+(I|LRA|Peak):" | head -4
printf '%s  %.2f s\n' "$OUT" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")"
