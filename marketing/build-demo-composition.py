#!/usr/bin/env python3
"""Writes marketing/demo-composition.html - the screen half of the demo reel.

v2, "come with me": the narrator walks you through sending one quote. Everything
the ad shows on a screen lives here - the WhatsApp chat list, the chat with
עופר, the customer's chat, and the end card. The two live-action windows are
left black; build-demo.sh drops the Higgsfield clips into them.

Authored on the same 28.8s timeline as the cut (demo-script.md §2), so a beat's
timecode here and in the EDL are the same number.

What v1 had and this does not: the quote page, the signature, the approval
notification. The narration ends at "just forward it to the customer", so the
customer's half of the story is out.

Fonts and the OG card are inlined as base64 - the renderer must open this file
with no server and no network except the two CDN scripts.

    ./build-demo-composition.py       -> demo-composition.html
"""
import base64, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MK = ROOT / "marketing"
SHOTS = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else MK / "shots"


def b64(p: pathlib.Path) -> str:
    return base64.b64encode(p.read_bytes()).decode()


PING_HEAVY = b64(ROOT / "public/fonts/ping-heavy.woff2")
PING_BOLD = b64(ROOT / "public/fonts/ping-bold.woff2")
PLONI_MED = b64(ROOT / "public/fonts/ploni-medium.woff2")
PLONI_DEMI = b64(ROOT / "public/fonts/ploni-demibold.woff2")
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
  /* WhatsApp dark, sampled from the app. The ad has to read as someone's
     actual phone, so these do not get "improved". */
  --wa-bg:#0b141a;
  --wa-panel:#202c33;
  --wa-out:#005c4b;
  --wa-in:#202c33;
  --wa-text:#e9edef;
  --wa-dim:#8696a0;
  --wa-tick:#53bdeb;
  --wa-green:#00a884;
  --wa-rec:#f15c6d;
  --wa-line:#222d34;
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
.body::before{content:"";position:absolute;inset:0;opacity:.035;pointer-events:none;
  background-image:radial-gradient(circle at 20% 30%,#fff 2px,transparent 2.5px),
                   radial-gradient(circle at 70% 60%,#fff 2px,transparent 2.5px),
                   radial-gradient(circle at 45% 85%,#fff 2px,transparent 2.5px);
  background-size:180px 180px,240px 240px,200px 200px}

/* ───────── chat list (new in v2) ───────── */
#listhead{height:150px;flex:none;background:var(--wa-bg);display:flex;align-items:center;
  justify-content:space-between;padding:0 40px}
#listhead .t{font-family:var(--display);font-weight:800;font-size:52px;color:var(--wa-green)}
#listhead .ic{display:flex;gap:34px;align-items:center}
#search{flex:none;margin:6px 34px 18px;background:var(--wa-panel);border-radius:34px;
  padding:22px 30px;display:flex;align-items:center;gap:20px;color:var(--wa-dim);font-size:34px}
#chips{flex:none;display:flex;gap:16px;padding:0 34px 20px}
#chips span{font-size:30px;padding:12px 28px;border-radius:24px;background:var(--wa-panel);
  color:var(--wa-dim)}
#chips span.on{background:#0b3a30;color:#7ee0c8}
#rows{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.crow{display:flex;align-items:center;gap:26px;padding:24px 34px;position:relative}
.crow + .crow::before{content:"";position:absolute;top:0;right:156px;left:34px;height:1px;
  background:var(--wa-line)}
.crow .mid{flex:1;min-width:0}
.crow .nm{font-size:40px;font-weight:700;color:var(--wa-text);line-height:1.25}
.crow .pv{font-size:32px;color:var(--wa-dim);margin-top:6px;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.crow .rt{display:flex;flex-direction:column;align-items:flex-start;gap:10px;flex:none}
.crow .tm{font-size:26px;color:var(--wa-dim)}
.crow .badge{min-width:44px;height:44px;border-radius:22px;background:var(--wa-green);
  color:#04211f;font-size:26px;font-weight:700;display:grid;place-items:center;padding:0 12px}

/* rows: dir=ltr so flex-start really is the left edge, bubble stays rtl */
.row{display:flex;width:100%;direction:ltr}
.row.out{justify-content:flex-start}
.row.in{justify-content:flex-end}
/* No white-space:pre-wrap - it would turn every newline in the markup into a
   blank line inside the bubble. Lines are explicit .sl blocks. */
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

.vn{display:flex;align-items:center;gap:22px;direction:ltr;padding-top:4px}
.vn .play{width:52px;height:52px;flex:none;display:grid;place-items:center}
.vn .wave{flex:1;display:flex;align-items:center;gap:6px;height:56px}
.vn .wave i{display:block;width:6px;border-radius:3px;background:rgba(233,237,239,.55)}
.vn .wave i.on{background:var(--wa-text)}
.vn .pic{width:66px;height:66px;border-radius:50%;background:#3b4a54;flex:none;
  display:grid;place-items:center}

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
/* justify-content:flex-end - the bars sit against the timer on the right and
   the gap falls next to "החלק לביטול", which is how the real bar looks. */
#recwave{flex:1;display:flex;align-items:center;justify-content:flex-end;gap:5px;
  height:48px;direction:ltr}
#recwave i{display:block;width:5px;border-radius:3px;background:var(--wa-dim)}
#recslide{font-size:32px;color:var(--wa-dim);direction:rtl;white-space:nowrap}

.tap{position:absolute;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.55);
  transform:translate(-50%,-50%) scale(0);opacity:.8;pointer-events:none;z-index:9}
.lp{background:rgba(0,0,0,.22);border-radius:16px;overflow:hidden;margin-bottom:12px}
.lp img{display:block;width:100%}

/* ───────── end card ───────── */
#end{background:var(--ink-black)}
#end .inner{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:0 90px;text-align:center}
#endmark{display:flex;align-items:center;gap:24px;margin-bottom:54px}
#endmark .m{width:100px;height:100px;border-radius:28px;background:var(--teal-deep);
  display:grid;place-items:center}
#endmark .w{font-family:var(--display);font-weight:800;font-size:76px;letter-spacing:-.02em}
#endline{font-family:var(--display);font-weight:800;font-size:66px;line-height:1.26;
  letter-spacing:-.02em;color:#fff}
#endrule{width:300px;height:3px;background:#243040;margin:64px 0 56px}
#offer{font-family:var(--display);font-weight:800;font-size:82px;line-height:1.16;
  color:var(--yellow);letter-spacing:-.02em}
#offersub{font-size:36px;color:#8b97a8;margin-top:28px;line-height:1.5}
#enddom{font-size:38px;color:var(--wa-text);margin-top:66px;letter-spacing:.04em;
  border:2px solid #243040;border-radius:44px;padding:20px 48px}
</style>
</head>
<body>
<div id="main" data-composition-id="main" data-width="1080" data-height="1920"
     data-start="0" data-duration="33.4">

<!-- ══ CHAT LIST : 4.8 - 7.2 ════════════════════════════════════════════
     "נכנס לוואטסאפ, בוחר בעופר הבוט". דני יושב מעל עופר ברשימה כדי שהסיבה
     לכל מה שקורה אחר כך תהיה על המסך לפני שהיא נאמרת. -->
<div class="scene" id="list" data-start="4.8" data-duration="2.4" data-track-index="0"
     style="visibility:hidden">
  <div class="phone">
    <div class="statusbar"><span class="num">16:32</span><span class="icons">__SIGNAL__</span></div>
    <div id="listhead"><span class="t">וואטסאפ</span><span class="ic">__CAM__ __SEARCH__ __DOTS__</span></div>
    <div id="search">__SEARCH__<span>חיפוש</span></div>
    <div id="chips"><span class="on">הכל</span><span>לא נקראו</span><span>קבוצות</span></div>
    <div id="rows">
      <div class="crow">
        <span class="avatar person">__PERSON_LG__</span>
        <span class="mid"><div class="nm">דני כהן</div><div class="pv">מעולה, תשלח לי הצעה 🙏</div></span>
        <span class="rt"><span class="tm" style="color:var(--wa-green)">16:28</span>
          <span class="badge">1</span></span>
      </div>
      <div class="crow" id="rowofer">
        <span class="avatar">__MIC_SM__</span>
        <span class="mid"><div class="nm">עופר הבוט</div><div class="pv">היי, אני עופר 👋 שלחו לי הודעה קולית או כתבו לי</div></span>
        <span class="rt"><span class="tm">15:40</span></span>
      </div>
      <div class="crow">
        <span class="avatar person">__PERSON_LG__</span>
        <span class="mid"><div class="nm">רינת</div><div class="pv">אל תשכח חלב</div></span>
        <span class="rt"><span class="tm">12:47</span></span>
      </div>
      <div class="crow">
        <span class="avatar person">__PERSON_LG__</span>
        <span class="mid"><div class="nm">הבניין ברמת גן</div><div class="pv">אבי: מחר ב-8 בבוקר</div></span>
        <span class="rt"><span class="tm">11:30</span></span>
      </div>
      <div class="crow">
        <span class="avatar person">__PERSON_LG__</span>
        <span class="mid"><div class="nm">אבא</div><div class="pv">תתקשר כשתוכל</div></span>
        <span class="rt"><span class="tm">אתמול</span></span>
      </div>
      <!-- the list has to reach the bottom of the screen. A real WhatsApp is
           never five rows and then a void, and the void is the first thing
           that reads as a mockup. -->
      <div class="crow">
        <span class="avatar person">__PERSON_LG__</span>
        <span class="mid"><div class="nm">מוסך אבי</div><div class="pv">הרכב מוכן לאיסוף</div></span>
        <span class="rt"><span class="tm">אתמול</span></span>
      </div>
      <div class="crow">
        <span class="avatar person">__PERSON_LG__</span>
        <span class="mid"><div class="nm">שירה - דירה בהרצליה</div><div class="pv">תודה רבה!! 😊</div></span>
        <span class="rt"><span class="tm">אתמול</span></span>
      </div>
      <div class="crow">
        <span class="avatar person">__PERSON_LG__</span>
        <span class="mid"><div class="nm">ספקי חשמל - צפון</div><div class="pv">מוטי: הגיע מלאי חדש</div></span>
        <span class="rt"><span class="tm">יום ג׳</span></span>
      </div>
      <div class="crow">
        <span class="avatar person">__PERSON_LG__</span>
        <span class="mid"><div class="nm">דוד</div><div class="pv">סגרנו על יום חמישי</div></span>
        <span class="rt"><span class="tm">יום ג׳</span></span>
      </div>
      <div class="tap" id="tap0"></div>
    </div>
  </div>
</div>

<!-- ══ CHAT with עופר : 7.2 - 23.4 ══════════════════════════════════════ -->
<div class="scene" id="chat" data-start="7.2" data-duration="16.2" data-track-index="0"
     style="visibility:hidden">
  <div class="phone">
    <div class="statusbar"><span class="num">16:32</span><span class="icons">__SIGNAL__</span></div>
    <div class="wahead">
      __BACK__
      <span class="avatar">__MIC_SM__</span>
      <span class="who"><div class="nm">עופר הבוט</div><div class="st" id="wastatus">מחובר</div></span>
    </div>
    <div class="body" id="cbody">
      <!-- No history: this is his first quote, so the only thing in the chat is
           what עופר says when you first reach him. Full opacity on purpose - it
           is a second pitch, inside the ad, for free. -->
      <div class="row in">
        <div class="bub" style="max-width:940px"><span
          class="sl">היי, אני עופר 👋</span><span
          class="sl">שלחו לי הודעה קולית 🎤 או כתבו מה העבודה -</span><span
          class="sl">ואני הופך את זה להצעת מחיר מעוצבת, בקלות ✨</span>
          <div class="stamp"><span class="num">15:40</span></div>
        </div>
      </div>

      <div class="row out" id="m-voice" style="display:none">
        <div class="bub" style="padding:18px 24px 12px;width:620px">
          <div class="vn">
            <span class="pic">__PERSON__</span>
            <span class="play">__PLAY__</span>
            <span class="wave" id="vnwave"></span>
          </div>
          <div class="stamp" style="margin-top:6px">
            <span class="num">0:09</span><span style="flex:1"></span>
            <span class="num">16:32</span>__TICK2__
          </div>
        </div>
      </div>

      <div class="row in" id="m-proc" style="display:none">
        <div class="bub">⏳ מעבד...<div class="stamp"><span class="num">16:32</span></div></div>
      </div>

      <div class="row in" id="m-sum" style="display:none">
        <div class="bub" style="max-width:880px">
<span class="sl">📋 הצעה #1 - דני כהן</span>
<span class="sl">• נקודת חשמל ×3 - 540 ₪</span>
<span class="sl">• ביקור ×1 - 200 ₪</span>
<span class="sl" id="sumtot" style="font-weight:700">סה״כ 740 ₪ + מע״מ = 873.20 ₪</span>
<span class="sl">&#8203;</span>
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
      <div id="recbar" style="display:none">
        <span id="recdot"></span>
        <span id="rectime" class="num">0:00</span>
        <span id="recwave"></span>
        <span id="recslide">‹ החלק לביטול</span>
      </div>
      <div class="inputpill" id="pill">הודעה</div>
      <span class="circbtn" id="micbtn">__MIC__</span>
    </div>
  </div>
</div>

<!-- ══ CHAT with דני : 23.4 - 24.6 ══════════════════════════════════════ -->
<div class="scene" id="dani" data-start="23.4" data-duration="1.2" data-track-index="0"
     style="visibility:hidden">
  <div class="phone">
    <div class="statusbar"><span class="num">16:33</span><span class="icons">__SIGNAL__</span></div>
    <div class="wahead">
      __BACK__
      <span class="avatar person">__PERSON_LG__</span>
      <span class="who"><div class="nm">דני כהן</div><div class="st">נראה לאחרונה היום</div></span>
    </div>
    <div class="body">
      <div class="row in hist">
        <div class="bub"><span class="sl">מעולה, תשלח לי הצעה 🙏</span></div>
      </div>
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

<!-- ══ END CARD : 26.1 - 33.4 ═══════════════════════════════════════════
     One scene, not two: the brand line and the offer are one continuous
     thought, and a hard cut onto a static card in the last seconds reads as
     the ad ending twice. -->
<div class="scene" id="end" data-start="26.1" data-duration="7.3" data-track-index="0"
     style="visibility:hidden">
  <div class="inner">
    <div id="endmark"><span class="m">__MIC_LG__</span><span class="w">QuickOffer</span></div>
    <div id="endline">ככה שולחים<br>הצעות מחיר היום.</div>
    <div id="endrule"></div>
    <div id="offer">5 הצעות<br>ראשונות חינם</div>
    <div id="offersub">בלי אפליקציה · בלי הרשמה · בלי כרטיס אשראי</div>
    <div id="enddom">quickoffer.co.il</div>
  </div>
</div>

</div>

<script>
(function () {
  var H = [14,26,38,22,44,30,48,20,34,42,26,50,32,18,40,28,46,24,36,20];
  /* guarded: the history bubble that used to carry a second waveform is gone,
     and a missing id here throws before the timeline ever registers - which
     surfaces as "timeline never registered", nowhere near the real cause. */
  ["vnwave", "vnwave2"].forEach(function (id, k) {
    var w = document.getElementById(id);
    if (!w) return;
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
var show = function (s, t) { tl.set(s, { autoAlpha: 1 }, t); };
var hide = function (s, t) { tl.set(s, { autoAlpha: 0 }, t); };

/* ── scene cuts. Outside a scene window the frame is black, which is where
      build-demo.sh splices the Higgsfield clips in. ──────────────────────
   0.0-4.8    live: he lifts the phone     ("בואו איתי לראות...")
   4.8-7.2    list                         ("נכנס לוואטסאפ, בוחר בעופר הבוט")
   7.2-23.4   chat                         (record, LISTEN, quote, one-tap send)
  23.4-24.6   dani                         ("...להעביר את זה ללקוח")
  24.6-26.1   live: his smile              ("איזה פשוט!")
  26.1-33.4   end card                     (brand line, then the offer)        */
show("#list", 4.8);  hide("#list", 7.2);
show("#chat", 7.2);  hide("#chat", 23.4);
show("#dani", 23.4); hide("#dani", 24.6);
show("#end", 26.1);

/* ═══ LIST 4.8-7.2 ════════════════════════════════════════════════════ */
tl.from("#list .crow", { autoAlpha: 0, y: 26, duration: .34, ease: "power2.out",
  stagger: .05 }, 4.85);
/* the tap lands on עופר as the narrator names him */
tl.set("#tap0", { left: 540, top: 250 }, 6.55);
tl.fromTo("#tap0", { scale: 0, opacity: .6 },
  { scale: 3.2, opacity: 0, duration: .55, ease: "power2.out" }, 6.58);
tl.to("#rowofer", { backgroundColor: "rgba(255,255,255,.08)", duration: .12 }, 6.58);
tl.to("#rowofer", { backgroundColor: "rgba(255,255,255,0)", duration: .3 }, 6.82);

/* ═══ CHAT 7.2-23.4 ═══════════════════════════════════════════════════ */

/* 8.0 the thumb goes down on the mic and stays down until 17.3. The timer is
   the real one: the recording we hear runs 9.7-17.3, and the bubble that lands
   afterwards reports the same 0:09. */
tl.set("#pill", { display: "none" }, 8.0);
tl.set("#recbar", { display: "flex" }, 8.0);
var rec = { v: 0 };
tl.to(rec, { v: 9.3, duration: 9.3, ease: "none", onUpdate: function () {
  var s = Math.floor(rec.v);
  document.getElementById("rectime").textContent = "0:0" + s;
} }, 8.0);
tl.to("#recdot", { opacity: .25, duration: .55, ease: "sine.inOut", yoyo: true, repeat: 16 }, 8.0);
tl.to("#recwave i", { scaleY: 1.9, transformOrigin: "center", duration: .34, ease: "sine.inOut",
  yoyo: true, repeat: 26, stagger: { each: .035, from: "random" } }, 8.0);
tl.to("#recslide", { opacity: .45, duration: .9, ease: "sine.inOut", yoyo: true, repeat: 7 }, 8.3);
/* No push on the recording beat. A phone screen does not drift, and the one
   thing this shot must read as is a plain screen recording. The timer and the
   waveform are the only motion, and the audio is what is actually happening. */

/* 17.3 release - the bubble is in the chat */
tl.set("#recbar", { display: "none" }, 17.3);
tl.set("#pill", { display: "flex" }, 17.3);
tl.set("#m-voice", { display: "flex" }, 17.32);
tl.from("#m-voice", { y: 40, autoAlpha: 0, scale: .94, transformOrigin: "left bottom",
  duration: .4, ease: "back.out(1.4)" }, 17.32);
tl.to("#vnwave i", { className: "on", duration: 0, stagger: { each: .045 } }, 17.7);

/* the bot works, then answers - "אחרי כמה שניות" lands at 17.68 */
tl.set("#wastatus", { innerText: "מקליד..." }, 17.75);
tl.set("#m-proc", { display: "flex" }, 17.95);
tl.from("#m-proc", { y: 30, autoAlpha: 0, duration: .32, ease: "power3.out" }, 17.95);

tl.to("#m-proc", { autoAlpha: 0, height: 0, marginBottom: -22, duration: .2,
  ease: "power2.in" }, 19.45);
tl.set("#m-proc", { display: "none" }, 19.65);
tl.set("#wastatus", { innerText: "מחובר" }, 19.6);
tl.set("#m-sum", { display: "flex" }, 19.68);
tl.from("#m-sum", { y: 44, autoAlpha: 0, scale: .96, transformOrigin: "right bottom",
  duration: .42, ease: "back.out(1.3)" }, 19.68);
tl.from("#m-sum .sl", { autoAlpha: 0, x: 26, duration: .3, ease: "power2.out",
  stagger: .145 }, 19.92);
tl.fromTo("#sumtot", { color: "#e9edef" },
  { color: "#7ee0c8", duration: .28, ease: "power2.out" }, 20.8);
tl.fromTo("#sumtot", { scale: 1 },
  { scale: 1.045, transformOrigin: "right center", duration: .24, ease: "back.out(2.4)",
    yoyo: true, repeat: 1 }, 20.8);

/* "ומה שנשאר לי זה רק להעביר את זה ללקוח" - the one-tap send */
tl.set("#m-send", { display: "flex" }, 21.82);
tl.from("#m-send", { y: 40, autoAlpha: 0, duration: .36, ease: "back.out(1.3)" }, 21.82);
tl.set("#tap1", { left: 300, top: 1290 }, 22.72);
tl.fromTo("#tap1", { scale: 0, opacity: .75 },
  { scale: 2.6, opacity: 0, duration: .58, ease: "power2.out" }, 22.75);
tl.to("#sendlink", { opacity: .55, duration: .12, yoyo: true, repeat: 1 }, 22.79);

/* ═══ דני 23.4-24.6 ═══════════════════════════════════════════════════ */
tl.from("#dpill", { autoAlpha: 0, duration: .18, ease: "power1.out" }, 23.42);
tl.set("#tap2", { left: 116, top: 1706 }, 23.7);
tl.fromTo("#tap2", { scale: 0, opacity: .7 },
  { scale: 2.2, opacity: 0, duration: .48, ease: "power2.out" }, 23.72);
tl.to("#sendbtn", { scale: .88, duration: .1, ease: "power2.out" }, 23.72);
tl.to("#sendbtn", { scale: 1, duration: .22, ease: "back.out(2.6)" }, 23.82);
tl.to("#dpill", { autoAlpha: 0, y: -18, duration: .14, ease: "power2.in" }, 23.84);
tl.set("#dpill", { innerText: "הודעה", className: "inputpill" }, 23.98);
tl.to("#dpill", { autoAlpha: 1, y: 0, duration: .12 }, 23.98);
tl.set("#m-cust", { display: "flex" }, 23.86);
tl.from("#m-cust", { y: 150, autoAlpha: 0, scale: .9, transformOrigin: "left bottom",
  duration: .42, ease: "power3.out" }, 23.86);

/* ═══ END CARD 26.1-33.4 ══════════════════════════════════════════════
   Reveals are pinned to the narration: the brand line lands under
   "ככה שולחים הצעות מחיר היום" (26.1-28.7) and the offer under
   "קחו חמש הצעות ללא תשלום" (31.5-33.4). */
tl.from("#endmark", { scale: .84, autoAlpha: 0, duration: .5, ease: "back.out(1.6)" }, 26.2);
tl.from("#endline", { y: 34, autoAlpha: 0, duration: .46, ease: "power3.out" }, 26.8);
tl.from("#endrule", { scaleX: 0, autoAlpha: 0, duration: .5, ease: "power2.out" }, 29.55);
tl.from("#offer", { y: 40, autoAlpha: 0, scale: .9, duration: .55,
  ease: "back.out(1.5)" }, 29.85);
tl.to("#offer", { scale: 1.035, duration: .26, ease: "back.out(2.2)",
  yoyo: true, repeat: 1 }, 31.55);
tl.from("#offersub", { autoAlpha: 0, y: 18, duration: .42, ease: "power2.out" }, 30.7);
tl.from("#enddom", { autoAlpha: 0, y: 20, duration: .45, ease: "power3.out" }, 32.0);

/* hold the last frame so the timeline matches data-duration */
tl.to({}, { duration: .1 }, 33.3);

window.__timelines["main"] = tl;
</script>
</body>
</html>
"""

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
CAM = ('<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#e9edef"'
       ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
       '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>'
       '<circle cx="12" cy="13" r="4"/></svg>')
SEARCH = ('<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8696a0"'
          ' stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/>'
          '<path d="m20 20-3.5-3.5"/></svg>')
DOTS = ('<svg width="40" height="40" viewBox="0 0 24 24" fill="#e9edef">'
        '<circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>')
def mic(size, color="#ffffff"):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}"'
            f' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
            f'<rect x="9" y="2" width="6" height="12" rx="3" fill="{color}" stroke="none"/>'
            f'<path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v4"/></svg>')
def person(size):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="#8696a0">'
            f'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>')
PLAY = '<svg width="40" height="40" viewBox="0 0 24 24" fill="#e9edef"><path d="M8 5v14l11-7z"/></svg>'
# mirrored: in an RTL chat the send arrow points left, toward the thread
SEND = ('<svg width="44" height="44" viewBox="0 0 24 24" fill="#ffffff" style="transform:scaleX(-1)">'
        '<path d="M3 20.5 21 12 3 3.5 3 10l12 2-12 2z"/></svg>')
def ticks(double, tid=""):
    i = f' id="{tid}"' if tid else ""
    if double:
        return (f'<svg class="tick"{i} viewBox="0 0 20 12" fill="none" stroke="#8696a0"'
                f' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
                f'<path d="m1 6.6 3.2 3.2L10.4 3"/><path d="m8.2 6.6 3.2 3.2L18 3"/></svg>')
    return (f'<svg class="tick"{i} viewBox="0 0 20 12" fill="none" stroke="#8696a0"'
            f' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="m4 6.6 3.2 3.2L14 3"/></svg>')

out = (HTML
       .replace("__PING_HEAVY__", PING_HEAVY).replace("__PING_BOLD__", PING_BOLD)
       .replace("__PLONI_MED__", PLONI_MED).replace("__PLONI_DEMI__", PLONI_DEMI)
       .replace("__OG__", OG_PNG)
       .replace("__SIGNAL__", SIGNAL).replace("__BACK__", BACK)
       .replace("__CAM__", CAM).replace("__SEARCH__", SEARCH).replace("__DOTS__", DOTS)
       .replace("__MIC_SM__", mic(46)).replace("__MIC_LG__", mic(52)).replace("__MIC__", mic(44))
       .replace("__PERSON_LG__", person(52)).replace("__PERSON__", person(36))
       .replace("__PLAY__", PLAY).replace("__SEND__", SEND)
       .replace("__TICK2__", ticks(True, "tick2")).replace("__TICK3__", ticks(True))
       .replace("__TICK1__", ticks(False)))

dest = MK / "demo-composition.html"
dest.write_text(out, encoding="utf-8")
print(f"wrote {dest}  {len(out):,} chars")
