#!/usr/bin/env python3
"""Writes marketing/captions.html - the burned-in caption layer, TikTok style.

Rendered on a transparent background to a PNG sequence and overlaid on the cut
by build-demo.sh, rather than authored inside demo-composition.html, because
captions have to sit over the Higgsfield shots too and those are spliced in
later. Doing it in HTML rather than an .ass subtitle file is deliberate: Chrome
does real bidi, and Hebrew through libass is a coin flip.

Timings are whisper word timestamps measured on the assembled audio - the text
is written out correctly by hand, whisper only supplies the clock. (It hears
"אופר", "פיקור", "מאם"; those are not what goes on screen.)

    ./build-captions.py       -> captions.html
"""
import base64, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
MK = ROOT / "marketing"

PING_HEAVY = base64.b64encode((ROOT / "public/fonts/ping-heavy.woff2").read_bytes()).decode()

# (start, end, text, kind, pos)
#   kind: "vo" = the narrator, "note" = the voice note he is recording. The two
#         get different colours so nobody thinks the narrator started dictating.
#   pos:  "lo" = y 1290, between the middle and the bottom, where captions live.
#         "hi" = y 300, up under the WhatsApp header.
#
# The height is not one number. From 17.68 the chat is full - the quote bubble,
# then the send message - and a caption at 1290 sits on top of the thing the ad
# exists to show. So the block from "אחרי כמה שניות" to "...ללקוח" goes up,
# where the chat is empty, and "איזה פשוט!" drops back down for the payoff.
# Every switch happens inside a gap between cues, so nothing is ever seen moving.
#
# Captions STOP at 27.4. From 26.1 the end card carries its own typography, and
# repeating it in a caption would just be two sets of words fighting.
CUES = [
    (0.00, 0.96, "בואו איתי לראות", "vo", "lo"),
    (0.96, 1.60, "איך אני שולח", "vo", "lo"),
    (1.60, 2.90, "הצעת מחיר ללקוח", "vo", "lo"),
    (2.90, 4.46, "דרך הקלטה בוואטסאפ", "vo", "lo"),

    (5.28, 6.68, "נכנס לוואטסאפ", "vo", "lo"),
    (6.68, 8.06, "בוחר בעופר הבוט", "vo", "lo"),
    (8.06, 9.60, "ושולח אליו הקלטה", "vo", "lo"),

    (9.70, 12.26, "עופר, תכין הצעה לדני כהן", "note", "lo"),
    (12.26, 13.86, "שלוש נקודות חשמל", "note", "lo"),
    (13.86, 15.30, "180 ליחידה", "note", "lo"),
    (15.30, 16.48, "ביקור 200", "note", "lo"),
    (16.48, 17.38, "לפני מע״מ", "note", "lo"),

    # up: the chat fills from here and the quote must stay readable
    (17.68, 19.16, "אחרי כמה שניות", "vo", "hi"),
    (19.16, 19.94, "עופר מחזיר לי", "vo", "hi"),
    (19.94, 20.98, "את ההצעה מוכנה", "vo", "hi"),
    (21.36, 22.64, "ומה שנשאר לי זה", "vo", "hi"),
    (22.64, 24.02, "רק להעביר את זה ללקוח", "vo", "hi"),

    # back down for the punchline, over his face in the stairwell
    # +2.0: the quote document now sits at 24.6-26.6 and pushes this along
    (26.64, 27.42, "איזה פשוט!", "vo", "lo"),
]

TOP = {"lo": 1290, "hi": 300}

HTML = r"""<!doctype html>
<html lang="he" dir="rtl" style="overflow:hidden; margin:0">
<head>
<meta charset="UTF-8" />
<title>QuickOffer - כתוביות</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
@font-face{font-family:"QO Display";font-weight:800;font-display:block;
  src:url(data:font/woff2;base64,__PING_HEAVY__) format("woff2");}
*{margin:0;padding:0;box-sizing:border-box}
/* transparent: puppeteer screenshots this with omitBackground so the PNGs
   carry alpha and overlay straight onto the cut */
html,body{width:1080px;height:1920px;overflow:hidden;background:transparent}

#stage{position:absolute;inset:0;width:1080px;height:1920px}
.cue{
  /* centred with auto margins rather than translateX, so GSAP owns the
     transform outright and the tilt is not fighting a centring hack */
  position:absolute;left:0;right:0;margin:0 auto;width:fit-content;
  max-width:880px;text-align:center;
  font-family:"QO Display",system-ui,sans-serif;font-weight:800;
  font-size:74px;line-height:1.2;letter-spacing:-.02em;
  padding:18px 38px;border-radius:26px;
  background:rgba(8,10,14,.62);
  /* a heavy outline as well as the plate: over a bright car window the plate
     alone is not enough separation */
  text-shadow:0 0 22px rgba(0,0,0,.85),
              -3px -3px 0 #05070b,  3px -3px 0 #05070b,
              -3px  3px 0 #05070b,  3px  3px 0 #05070b,
               0   -4px 0 #05070b,  0    4px 0 #05070b,
              -4px  0   0 #05070b,  4px  0   0 #05070b;
  visibility:hidden;
  /* the tilt is set per cue from JS so GSAP owns the transform - a rotate()
     here would be overwritten the moment it animates scale */
}
.cue.vo{color:#ffffff}
/* the voice note is him talking, not the narrator - brand yellow marks it as a
   different source without needing a label */
.cue.note{color:#FFD400}
</style>
</head>
<body>
<div id="stage">__CUES__</div>
<script>
window.__timelines = window.__timelines || {};
var tl = gsap.timeline({ paused: true });
var CUES = __CUEDATA__;

/* A small alternating tilt. Deterministic, not random, so a re-render is
   identical - but uneven enough that the captions read as stuck on by hand
   rather than poured out of a template. */
var TILT = [-2.6, 1.9, -2.1, 2.4, -1.7, 2.2, -2.4, 1.6];

CUES.forEach(function (c, i) {
  var sel = "#c" + i;
  var ang = TILT[i % TILT.length];
  tl.set(sel, { autoAlpha: 1, rotation: ang }, c[0]);
  /* a short pop rather than a fade: a caption that eases in reads as a lower
     third, and this has to read as a phone app caption. The tilt overshoots
     slightly and settles, which is what stops it looking pasted on. */
  tl.fromTo(sel, { scale: .88, y: 14, rotation: ang * 1.7 },
    { scale: 1, y: 0, rotation: ang, duration: .18, ease: "back.out(2.6)" }, c[0]);
  tl.set(sel, { autoAlpha: 0 }, c[1]);
});

tl.to({}, { duration: .1 }, 34.9);
window.__timelines["main"] = tl;
</script>
</body>
</html>
"""

cue_html = "\n".join(
    f'<div class="cue {kind}" id="c{i}" style="top:{TOP[pos]}px">{text}</div>'
    for i, (a, b, text, kind, pos) in enumerate(CUES)
)

out = (HTML
       .replace("__PING_HEAVY__", PING_HEAVY)
       .replace("__CUES__", cue_html)
       .replace("__CUEDATA__", json.dumps([[a, b] for a, b, _, _, _ in CUES])))

dest = MK / "captions.html"
dest.write_text(out, encoding="utf-8")
lo = sum(1 for c in CUES if c[4] == "lo")
print(f"wrote {dest}  {len(CUES)} cues ({lo} low, {len(CUES) - lo} high), "
      f"last ends {CUES[-1][1]}s")
