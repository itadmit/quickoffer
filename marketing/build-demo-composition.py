#!/usr/bin/env python3
"""Writes marketing/demo-composition.html - the screen half of the demo reel.

Everything the ad shows on a screen lives here: the WhatsApp chat with עופר,
the customer's chat, the real quote page, the approval notification and the end
card. The live-action windows are left black; build-demo.sh drops the
Higgsfield clips into them.

Authored on the same 25.2s timeline as the cut (demo-script.md §2), so a beat's
timecode here and in the EDL are the same number.

Fonts and screenshots are inlined as base64 - the renderer must be able to open
this file with no server and no network except the two CDN scripts.

    ./build-demo-composition.py       -> demo-composition.html
"""
import base64, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MK = ROOT / "marketing"
# Screens captured from the real product by capture916.mjs / the OG route.
SHOTS = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else MK / "shots"


def b64(p: pathlib.Path) -> str:
    return base64.b64encode(p.read_bytes()).decode()


PING_HEAVY = b64(ROOT / "public/fonts/ping-heavy.woff2")
PING_BOLD = b64(ROOT / "public/fonts/ping-bold.woff2")
PLONI_MED = b64(ROOT / "public/fonts/ploni-medium.woff2")
PLONI_DEMI = b64(ROOT / "public/fonts/ploni-demibold.woff2")
QUOTE_PNG = b64(SHOTS / "scr-quote916.png")
OG_PNG = b64(SHOTS / "og-card.png")

HTML = r"""<!doctype html>
<html lang="he" dir="rtl" style="overflow:hidden; margin:0">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<title>QuickOffer - הדמו</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@hyperframes/core/dist/hyperframe.runtime.iife.js"></script>
<style>
@font-face{font-family:"QO Display";font-weight:800;font-display:block;
  src:url(data:font/woff2;base64,__PING_HEAVY__) format("woff2");}
@font-face{font-family:"QO Display";font-weight:700;font-display:block;
  src:url(data:font/woff2;base64,__PING_BOLD__) format("woff2");}
@font-face{font-family:"QO Text";font-weight:500;font-display:block;
  src:url(data:font/woff2;base64,__PLONI_MED__) format("woff2");}
@font-face{font-family:"QO Text";font-weight:700;font-display:block;
  src:url(data:font/woff2;base64,__PLONI_DEMI__) format("woff2");}

:root{
  /* WhatsApp dark, sampled from the app - not invented brand colours. The ad
     has to read as someone's actual phone, so these do not get "improved". */
  --wa-bg:#0b141a;
  --wa-panel:#202c33;
  --wa-out:#005c4b;
  --wa-in:#202c33;
  --wa-text:#e9edef;
  --wa-dim:#8696a0;
  --wa-tick:#53bdeb;
  --wa-green:#00a884;
  --wa-rec:#f15c6d;
  --ink-black:#0a0a0a;
  --teal:#2dd4bf;
  --teal-deep:#0f766e;
  --yellow:#FFD400;
  --display:"QO Display","QO Text",system-ui,sans-serif;
  --text:"QO Text",system-ui,sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#000;color:#fff;
  font-family:var(--text);-webkit-font-smoothing:antialiased}
.scene{position:absolute;top:0;left:0;width:1080px;height:1920px;overflow:hidden}
.num{font-variant-numeric:tabular-nums}

/* ───────── phone chrome ───────── */
.phone{position:absolute;inset:0;background:var(--wa-bg);display:flex;flex-direction:column}
.statusbar{height:86px;flex:none;display:flex;align-items:center;justify-content:space-between;
  padding:0 46px;color:var(--wa-text);font-size:32px;font-weight:700;letter-spacing:.02em}
.statusbar .icons{display:flex;gap:12px;align-items:center}
.wahead{height:150px;flex:none;background:var(--wa-panel);display:flex;align-items:center;
  gap:26px;padding:0 34px}
.wahead .who{flex:1;min-width:0}
.wahead .nm{font-size:44px;font-weight:700;color:var(--wa-text);line-height:1.2}
.wahead .st{font-size:28px;color:var(--wa-dim);margin-top:4px}
.avatar{width:96px;height:96px;border-radius:50%;flex:none;display:grid;place-items:center;
  background:var(--teal-deep)}
.avatar.person{background:#3b4a54}
.body{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;
  gap:22px;padding:28px 34px 20px;position:relative}
/* the doodle wallpaper, faint - a flat colour reads as a mockup */
.body::before{content:"";position:absolute;inset:0;opacity:.035;pointer-events:none;
  background-image:radial-gradient(circle at 20% 30%,#fff 2px,transparent 2.5px),
                   radial-gradient(circle at 70% 60%,#fff 2px,transparent 2.5px),
                   radial-gradient(circle at 45% 85%,#fff 2px,transparent 2.5px);
  background-size:180px 180px,240px 240px,200px 200px}

/* rows: dir=ltr so flex-start really is the left edge, bubble stays rtl */
.row{display:flex;width:100%;direction:ltr}
.row.out{justify-content:flex-start}
.row.in{justify-content:flex-end}
/* No white-space:pre-wrap here. It would turn every newline in the markup into
   a blank line inside the bubble, which is what padded the voice note out to a
   square. Lines are explicit .sl blocks instead. */
.bub{max-width:830px;border-radius:24px;padding:22px 28px 16px;font-size:42px;line-height:1.46;
  color:var(--wa-text);direction:rtl;text-align:right;position:relative;
  box-shadow:0 2px 6px rgba(0,0,0,.35)}
.sl{display:block}
.row.hist{opacity:.34}
.row.out .bub{background:var(--wa-out);border-bottom-left-radius:8px}
.row.in  .bub{background:var(--wa-in);border-bottom-right-radius:8px}
.stamp{display:flex;align-items:center;gap:8px;justify-content:flex-start;direction:ltr;
  font-size:26px;color:rgba(233,237,239,.6);margin-top:8px}
.tick{width:34px;height:20px;flex:none}

/* voice note bubble */
.vn{display:flex;align-items:center;gap:22px;direction:ltr;padding-top:4px}
.vn .play{width:52px;height:52px;flex:none;display:grid;place-items:center}
.vn .wave{flex:1;display:flex;align-items:center;gap:6px;height:56px}
.vn .wave i{display:block;width:6px;border-radius:3px;background:rgba(233,237,239,.55)}
.vn .wave i.on{background:var(--wa-text)}
.vn .pic{width:66px;height:66px;border-radius:50%;background:#3b4a54;flex:none;
  display:grid;place-items:center}

/* composer + recording */
.composer{flex:none;min-height:150px;padding:20px 34px 34px;display:flex;align-items:flex-end;gap:20px}
.inputpill{flex:1;background:var(--wa-panel);border-radius:34px;padding:24px 32px;
  font-size:40px;color:var(--wa-dim);min-height:88px;display:flex;align-items:center}
.inputpill.filled{color:var(--wa-text);text-align:right;display:block;line-height:1.42;
  white-space:pre-wrap;font-size:38px}
.circbtn{width:88px;height:88px;border-radius:50%;background:var(--wa-green);flex:none;
  display:grid;place-items:center;position:relative}
/* rtl: the red dot and the timer sit on the right, "החלק לביטול" by the mic */
#recbar{flex:1;display:flex;align-items:center;gap:26px;direction:rtl;
  background:var(--wa-panel);border-radius:34px;padding:22px 32px;min-height:88px}
#recdot{width:22px;height:22px;border-radius:50%;background:var(--wa-rec);flex:none}
#rectime{font-size:40px;color:var(--wa-text);font-variant-numeric:tabular-nums;min-width:110px}
#recwave{flex:1;display:flex;align-items:center;gap:5px;height:48px;direction:ltr}
#recwave i{display:block;width:5px;border-radius:3px;background:var(--wa-dim)}
#recslide{font-size:32px;color:var(--wa-dim);direction:rtl;white-space:nowrap}

/* tap ripple */
.tap{position:absolute;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.55);
  transform:translate(-50%,-50%) scale(0);opacity:.8;pointer-events:none;z-index:9}

/* link preview card inside a bubble */
.lp{background:rgba(0,0,0,.22);border-radius:16px;overflow:hidden;margin-bottom:12px}
.lp img{display:block;width:100%}

/* ───────── quote page ───────── */
#qimg{position:absolute;top:0;left:0;width:1080px;height:1919px;display:block}

/* ───────── end card ───────── */
#cta{background:var(--ink-black)}
#cta .inner{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:0;padding:0 90px;text-align:center}
.ctaline{font-family:var(--display);font-weight:800;font-size:82px;line-height:1.24;
  letter-spacing:-.02em;color:#fff}
.ctaline.hi{color:var(--yellow)}
#ctamark{display:flex;align-items:center;gap:24px;margin-bottom:70px}
#ctamark .m{width:100px;height:100px;border-radius:28px;background:var(--teal-deep);
  display:grid;place-items:center}
#ctamark .w{font-family:var(--display);font-weight:800;font-size:72px;letter-spacing:-.02em}
#ctadom{font-size:36px;color:#8b97a8;margin-top:64px;letter-spacing:.04em}
</style>
</head>
<body>
<div id="main" data-composition-id="main" data-width="1080" data-height="1920"
     data-start="0" data-duration="25.2">

<!-- ══ CHAT with עופר : 4.6 - 15.2 ══════════════════════════════════════ -->
<div class="scene" id="chat" data-start="4.6" data-duration="10.6" data-track-index="0"
     style="visibility:hidden">
  <div class="phone">
    <div class="statusbar">
      <span class="num">16:32</span>
      <span class="icons">__SIGNAL__</span>
    </div>
    <div class="wahead">
      __BACK__
      <span class="avatar">__MIC_SM__</span>
      <span class="who"><div class="nm">עופר</div><div class="st" id="wastatus">מקוון</div></span>
    </div>
    <div class="body" id="cbody">
      <!-- history, so the recording beat is not a blank screen, and so this
           reads as a habit rather than a first try. Same message shape the bot
           really sends, from the job before this one. -->
      <div class="row out hist">
        <div class="bub" style="padding:18px 24px 12px;width:560px">
          <div class="vn">
            <span class="pic">__PERSON__</span><span class="play">__PLAY__</span>
            <span class="wave" id="vnwave2"></span>
          </div>
          <div class="stamp" style="margin-top:6px"><span class="num">0:11</span>
            <span style="flex:1"></span><span class="num">14:05</span>__TICK3__</div>
        </div>
      </div>
      <div class="row in hist">
        <div class="bub"><span class="sl">📋 הצעה #11 - משפחת לוי</span><span
          class="sl">• נקודת חשמל ×6 - 1,080 ₪</span><span
          class="sl">סה״כ 1,080 ₪ + מע״מ = 1,274.40 ₪</span></div>
      </div>

      <div class="row out" id="m-voice" style="display:none">
        <div class="bub" style="padding:18px 24px 12px;width:620px">
          <div class="vn">
            <span class="pic">__PERSON__</span>
            <span class="play">__PLAY__</span>
            <span class="wave" id="vnwave"></span>
          </div>
          <div class="stamp" style="margin-top:6px">
            <span class="num">0:08</span><span style="flex:1"></span>
            <span class="num">16:32</span>__TICK2__
          </div>
        </div>
      </div>

      <div class="row in" id="m-proc" style="display:none">
        <div class="bub">⏳ מעבד...<div class="stamp"><span class="num">16:32</span></div></div>
      </div>

      <div class="row in" id="m-sum" style="display:none">
        <div class="bub" style="max-width:880px">
<span class="sl">📋 הצעה #12 - דני כהן</span>
<span class="sl">• נקודת חשמל ×3 - 540 ₪</span>
<span class="sl">• ביקור ×1 - 200 ₪</span>
<span class="sl" id="sumtot" style="font-weight:700">סה״כ 740 ₪ + מע״מ = 873.20 ₪</span>
<span class="sl">&#8203;</span>
<!-- 36px: at 42 the parenthesised example wraps and bidi drops the closing
     bracket onto the next line. Smaller is also the right emphasis. -->
<span class="sl" style="color:#b9c4cc;font-size:36px">✏️ לתקן: לכתוב או להגיד לי ("תשנה ביקור ל-250")</span>
<span class="sl" style="color:#b9c4cc;font-size:36px">🖊️ עריכה מלאה: <span style="color:var(--wa-tick)">quickoffer.co.il/e/K7m2xP</span></span>
          <div class="stamp"><span class="num">16:32</span></div>
        </div>
      </div>

      <div class="row in" id="m-send" style="display:none">
        <div class="bub" style="max-width:880px"><span
          class="sl">📲 לשלוח לדני כהן (050-123-4567) - בלחיצה אחת:</span><span
          class="sl" id="sendlink" style="color:var(--wa-tick)">quickoffer.co.il/w/K7m2xP</span><span
          class="sl" style="color:#b9c4cc">נפתח הצ׳אט עם ההודעה מוכנה. רק ללחוץ שלח.</span>
          <div class="stamp"><span class="num">16:33</span></div>
        </div>
      </div>
      <div class="tap" id="tap1"></div>
    </div>

    <div class="composer">
      <div id="recbar">
        <span id="recdot"></span>
        <span id="rectime" class="num">0:03</span>
        <span id="recwave"></span>
        <span id="recslide">‹ החלק לביטול</span>
      </div>
      <div class="inputpill" id="pill" style="display:none">הודעה</div>
      <span class="circbtn" id="micbtn">__MIC__</span>
    </div>
  </div>
</div>

<!-- ══ CHAT with דני : 15.2 - 16.2 ══════════════════════════════════════ -->
<div class="scene" id="dani" data-start="15.2" data-duration="1.0" data-track-index="0"
     style="visibility:hidden">
  <div class="phone">
    <div class="statusbar">
      <span class="num">16:33</span>
      <span class="icons">__SIGNAL__</span>
    </div>
    <div class="wahead">
      __BACK__
      <span class="avatar person">__PERSON_LG__</span>
      <span class="who"><div class="nm">דני כהן</div><div class="st">נראה לאחרונה היום</div></span>
    </div>
    <div class="body" id="dbody">
      <div class="row out" id="m-cust" style="display:none">
        <div class="bub" style="max-width:880px">
          <div class="lp"><img src="data:image/png;base64,__OG__" alt="" /></div><span
          class="sl">שלום דני, מצורפת הצעת מחיר מיוסי חשמל ותאורה:</span><span
          class="sl" style="color:var(--wa-tick)">quickoffer.co.il/q/A3f9Qd</span><span
          class="sl">ההצעה תקפה ל-14 יום. לאישור ולחתימה - הקישור למעלה.</span>
          <div class="stamp"><span class="num">16:33</span>__TICK1__</div>
        </div>
      </div>
      <div class="tap" id="tap2"></div>
    </div>
    <div class="composer">
      <div class="inputpill filled" id="dpill">שלום דני, מצורפת הצעת מחיר מיוסי חשמל ותאורה:
quickoffer.co.il/q/A3f9Qd
ההצעה תקפה ל-14 יום. לאישור ולחתימה - הקישור למעלה.</div>
      <span class="circbtn" id="sendbtn">__SEND__</span>
    </div>
  </div>
</div>

<!-- ══ QUOTE PAGE : 17.4 - 19.6 ═════════════════════════════════════════
     2.2s, not the 1.6 the script first assumed: hf-e is only 1.2s long, and
     the document is the thing that most needs reading time anyway. -->
<div class="scene" id="quote" data-start="17.4" data-duration="2.2" data-track-index="0"
     style="visibility:hidden;background:#f6f7f9">
  <img id="qimg" src="data:image/png;base64,__QUOTE__" alt="" />
</div>

<!-- ══ NOTIFICATION : 22.0 - 23.6 ═══════════════════════════════════════ -->
<div class="scene" id="notif" data-start="22.0" data-duration="1.6" data-track-index="0"
     style="visibility:hidden">
  <div class="phone">
    <div class="statusbar">
      <span class="num">16:41</span>
      <span class="icons">__SIGNAL__</span>
    </div>
    <div class="wahead">
      __BACK__
      <span class="avatar">__MIC_SM__</span>
      <span class="who"><div class="nm">עופר</div><div class="st">מקוון</div></span>
    </div>
    <div class="body">
      <div class="row in hist">
        <div class="bub" style="max-width:880px"><span
          class="sl">📲 לשלוח לדני כהן (050-123-4567) - בלחיצה אחת:</span><span
          class="sl" style="color:var(--wa-tick)">quickoffer.co.il/w/K7m2xP</span></div>
      </div>
      <div class="row in" id="m-ok" style="display:none">
        <div class="bub" id="okbub" style="max-width:940px;font-size:50px;line-height:1.4">✅ הצעה #12 אושרה ונחתמה (873.20 ₪) - דני כהן.<div class="stamp"><span class="num">16:41</span></div></div>
      </div>
    </div>
    <div class="composer"><div class="inputpill">הודעה</div><span class="circbtn">__MIC__</span></div>
  </div>
</div>

<!-- ══ END CARD : 23.6 - 25.2 ═══════════════════════════════════════════ -->
<div class="scene" id="cta" data-start="23.6" data-duration="1.6" data-track-index="0"
     style="visibility:hidden">
  <div class="inner">
    <div id="ctamark"><span class="m">__MIC_LG__</span><span class="w">QuickOffer</span></div>
    <div class="ctaline" id="c1">שלח הודעה קולית.</div>
    <div class="ctaline" id="c2">קבל הצעת מחיר.</div>
    <div class="ctaline hi" id="c3">סגור עסקה.</div>
    <div id="ctadom">quickoffer.co.il</div>
  </div>
</div>

</div>

<script>
/* ── waveform bars, built once so the markup stays readable ────────────── */
(function () {
  var H = [14,26,38,22,44,30,48,20,34,42,26,50,32,18,40,28,46,24,36,20];
  ["vnwave", "vnwave2"].forEach(function (id, k) {
    var w = document.getElementById(id);
    for (var i = 0; i < 26; i++) {
      var b = document.createElement("i");
      b.style.height = H[(i + k * 5) % H.length] + "px";
      w.appendChild(b);
    }
  });
  var r = document.getElementById("recwave");
  for (var j = 0; j < 30; j++) {
    var c = document.createElement("i");
    c.style.height = (10 + (j * 7) % 34) + "px";
    r.appendChild(c);
  }
})();

window.__timelines = window.__timelines || {};
var tl = gsap.timeline({ paused: true });
var show = function (sel, t) { tl.set(sel, { autoAlpha: 1 }, t); };
var hide = function (sel, t) { tl.set(sel, { autoAlpha: 0 }, t); };

/* ── scene cuts. Everything outside a scene window is black, which is where
      build-demo.sh splices the Higgsfield clips in. ───────────────────── */
show("#chat", 4.6);   hide("#chat", 15.2);
show("#dani", 15.2);  hide("#dani", 16.2);
show("#quote", 17.4); hide("#quote", 19.6);
show("#notif", 22.0); hide("#notif", 23.6);
show("#cta", 23.6);

/* ═══ CHAT 4.6-15.2 ═══════════════════════════════════════════════════ */

/* recording. The counter is driven from the real recording: he pressed at
   t=1.0 and released at t=8.56, so what the timer shows is what the audio
   is doing - not a decorative number. */
var rec = { v: 3.6 };
tl.to(rec, { v: 7.56, duration: 3.96, ease: "none", onUpdate: function () {
  var s = Math.floor(rec.v);
  document.getElementById("rectime").textContent = "0:" + (s < 10 ? "0" + s : s);
} }, 4.6);
tl.to("#recdot", { opacity: .25, duration: .55, ease: "sine.inOut", yoyo: true, repeat: 7 }, 4.6);
tl.to("#recwave i", { scaleY: 1.9, transformOrigin: "center", duration: .34, ease: "sine.inOut",
  yoyo: true, repeat: 11, stagger: { each: .035, from: "random" } }, 4.6);
tl.to("#recslide", { opacity: .45, duration: .9, ease: "sine.inOut", yoyo: true, repeat: 3 }, 4.9);

/* release -> the bubble is in the chat. 8.56 is where the audio ends. */
tl.set("#recbar", { display: "none" }, 8.5);
tl.set("#pill", { display: "flex" }, 8.5);
tl.set("#m-voice", { display: "flex" }, 8.52);
tl.from("#m-voice", { y: 40, autoAlpha: 0, scale: .94, transformOrigin: "left bottom",
  duration: .42, ease: "back.out(1.4)" }, 8.52);
/* playhead crawling the waveform - the note is playing back, not just sitting */
tl.to("#vnwave i", { className: "on", duration: 0, stagger: { each: .055 } }, 8.95);
tl.fromTo("#tick2", { stroke: "#8696a0" }, { stroke: "var(--wa-tick)", duration: .01 }, 8.98);

/* the bot is working */
tl.set("#wastatus", { innerText: "מקליד..." }, 9.0);
tl.set("#m-proc", { display: "flex" }, 9.25);
tl.from("#m-proc", { y: 30, autoAlpha: 0, duration: .34, ease: "power3.out" }, 9.25);

/* ── the quote lands 10.0-14.0 ── */
tl.to("#m-proc", { autoAlpha: 0, height: 0, marginBottom: -22, duration: .22,
  ease: "power2.in" }, 10.0);
tl.set("#m-proc", { display: "none" }, 10.22);
tl.set("#wastatus", { innerText: "מקוון" }, 10.2);
tl.set("#m-sum", { display: "flex" }, 10.24);
tl.from("#m-sum", { y: 44, autoAlpha: 0, scale: .96, transformOrigin: "right bottom",
  duration: .46, ease: "back.out(1.3)" }, 10.24);
/* line by line - the viewer reads it being assembled, which is the point */
tl.from("#m-sum .sl", { autoAlpha: 0, x: 26, duration: .34, ease: "power2.out",
  stagger: .215 }, 10.55);
/* the total is the number they came for */
tl.fromTo("#sumtot", { color: "#e9edef" },
  { color: "#7ee0c8", duration: .3, ease: "power2.out" }, 12.05);
tl.fromTo("#sumtot", { scale: 1 },
  { scale: 1.045, transformOrigin: "right center", duration: .26, ease: "back.out(2.4)",
    yoyo: true, repeat: 1 }, 12.05);

/* ── one tap to send 14.0-15.2 ── */
tl.set("#m-send", { display: "flex" }, 14.02);
tl.from("#m-send", { y: 40, autoAlpha: 0, duration: .38, ease: "back.out(1.3)" }, 14.02);
tl.set("#tap1", { left: 300, top: 1290 }, 14.6);
tl.fromTo("#tap1", { scale: 0, opacity: .75 },
  { scale: 2.6, opacity: 0, duration: .62, ease: "power2.out" }, 14.62);
tl.to("#sendlink", { opacity: .55, duration: .12, yoyo: true, repeat: 1 }, 14.66);

/* ═══ דני 15.2-16.2 ═══════════════════════════════════════════════════ */
/* the message is already written - that is the whole claim of this beat */
tl.from("#dpill", { autoAlpha: 0, duration: .2, ease: "power1.out" }, 15.22);
tl.set("#tap2", { left: 116, top: 1706 }, 15.44);
tl.fromTo("#tap2", { scale: 0, opacity: .7 },
  { scale: 2.2, opacity: 0, duration: .5, ease: "power2.out" }, 15.46);
tl.to("#sendbtn", { scale: .88, duration: .1, ease: "power2.out" }, 15.46);
tl.to("#sendbtn", { scale: 1, duration: .22, ease: "back.out(2.6)" }, 15.56);
tl.to("#dpill", { autoAlpha: 0, y: -18, duration: .16, ease: "power2.in" }, 15.58);
tl.set("#dpill", { innerText: "הודעה" }, 15.74);
tl.set("#dpill", { className: "inputpill" }, 15.74);
tl.to("#dpill", { autoAlpha: 1, y: 0, duration: .14 }, 15.74);
tl.set("#m-cust", { display: "flex" }, 15.6);
tl.from("#m-cust", { y: 150, autoAlpha: 0, scale: .9, transformOrigin: "left bottom",
  duration: .44, ease: "power3.out" }, 15.6);

/* ═══ QUOTE PAGE 17.4-19.6 ════════════════════════════════════════════ */
/* a slow settle, no pan: the document has to be readable, not cinematic */
tl.from("#qimg", { scale: 1.055, transformOrigin: "50% 30%", duration: 2.2,
  ease: "sine.out" }, 17.4);
tl.from("#quote", { autoAlpha: 0, duration: .22, ease: "power1.out" }, 17.4);

/* ═══ NOTIFICATION 22.0-23.6 ══════════════════════════════════════════ */
tl.set("#m-ok", { display: "flex" }, 22.16);
tl.from("#m-ok", { y: 56, autoAlpha: 0, scale: .92, transformOrigin: "right bottom",
  duration: .5, ease: "back.out(1.5)" }, 22.16);
tl.to("#okbub", { scale: 1.028, transformOrigin: "right center", duration: .22,
  ease: "back.out(2.2)", yoyo: true, repeat: 1 }, 22.72);

/* ═══ END CARD 23.6-25.2 ══════════════════════════════════════════════ */
tl.from("#ctamark", { scale: .84, autoAlpha: 0, duration: .46, ease: "back.out(1.6)" }, 23.68);
tl.from("#c1", { y: 30, autoAlpha: 0, duration: .34, ease: "power3.out" }, 24.0);
tl.from("#c2", { y: 30, autoAlpha: 0, duration: .34, ease: "power3.out" }, 24.22);
tl.from("#c3", { y: 30, autoAlpha: 0, duration: .34, ease: "power3.out" }, 24.44);
tl.from("#ctadom", { autoAlpha: 0, duration: .36, ease: "power1.out" }, 24.78);

/* hold the last frame so the timeline matches data-duration */
tl.to({}, { duration: .1 }, 25.1);

window.__timelines["main"] = tl;
</script>
</body>
</html>
"""

# ── inline SVG, kept out of the template so the markup above stays readable ──
SIGNAL = (
    '<svg width="34" height="26" viewBox="0 0 24 18" fill="#e9edef">'
    '<rect x="0" y="12" width="4" height="6" rx="1"/><rect x="6" y="8" width="4" height="10" rx="1"/>'
    '<rect x="12" y="4" width="4" height="14" rx="1"/><rect x="18" y="0" width="4" height="18" rx="1"/></svg>'
    '<svg width="34" height="26" viewBox="0 0 24 18" fill="none" stroke="#e9edef" stroke-width="2"'
    ' stroke-linecap="round"><path d="M2 6a15 15 0 0 1 20 0"/><path d="M6 10.5a9 9 0 0 1 12 0"/>'
    '<circle cx="12" cy="15" r="1.6" fill="#e9edef" stroke="none"/></svg>'
    '<svg width="44" height="24" viewBox="0 0 30 16" fill="none"><rect x="1" y="1" width="25" height="14"'
    ' rx="4" stroke="#e9edef" stroke-width="1.6"/><rect x="3.5" y="3.5" width="18" height="9" rx="2"'
    ' fill="#e9edef"/><rect x="27" y="5.5" width="2.5" height="5" rx="1.2" fill="#e9edef"/></svg>'
)
BACK = ('<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#e9edef"'
        ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex:none">'
        '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>')
def mic(size, color="#ffffff"):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}"'
            f' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
            f'<rect x="9" y="2" width="6" height="12" rx="3" fill="{color}" stroke="none"/>'
            f'<path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v4"/></svg>')
def person(size):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="#8696a0">'
            f'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>')
PLAY = ('<svg width="40" height="40" viewBox="0 0 24 24" fill="#e9edef">'
        '<path d="M8 5v14l11-7z"/></svg>')
# mirrored: in an RTL chat the send arrow points left, toward the thread
SEND = ('<svg width="44" height="44" viewBox="0 0 24 24" fill="#ffffff"'
        ' style="transform:scaleX(-1)">'
        '<path d="M3 20.5 21 12 3 3.5 3 10l12 2-12 2z"/></svg>')
def ticks(double, tid=""):
    i = f' id="{tid}"' if tid else ""
    c = "#8696a0"
    if double:
        return (f'<svg class="tick"{i} viewBox="0 0 20 12" fill="none" stroke="{c}" stroke-width="1.8"'
                f' stroke-linecap="round" stroke-linejoin="round">'
                f'<path d="m1 6.6 3.2 3.2L10.4 3"/><path d="m8.2 6.6 3.2 3.2L18 3"/></svg>')
    return (f'<svg class="tick"{i} viewBox="0 0 20 12" fill="none" stroke="{c}" stroke-width="1.8"'
            f' stroke-linecap="round" stroke-linejoin="round"><path d="m4 6.6 3.2 3.2L14 3"/></svg>')

out = (HTML
       .replace("__PING_HEAVY__", PING_HEAVY).replace("__PING_BOLD__", PING_BOLD)
       .replace("__PLONI_MED__", PLONI_MED).replace("__PLONI_DEMI__", PLONI_DEMI)
       .replace("__QUOTE__", QUOTE_PNG).replace("__OG__", OG_PNG)
       .replace("__SIGNAL__", SIGNAL).replace("__BACK__", BACK)
       .replace("__MIC_SM__", mic(46)).replace("__MIC_LG__", mic(52)).replace("__MIC__", mic(44))
       .replace("__PERSON_LG__", person(52)).replace("__PERSON__", person(36))
       .replace("__PLAY__", PLAY).replace("__SEND__", SEND)
       .replace("__TICK2__", ticks(True, "tick2")).replace("__TICK3__", ticks(True))
       .replace("__TICK1__", ticks(False)))

dest = MK / "demo-composition.html"
dest.write_text(out, encoding="utf-8")
print(f"wrote {dest}  {len(out):,} chars")
