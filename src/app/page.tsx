import type { Metadata } from "next";
import {
  BadgeCheck,
  Ban,
  BatteryFull,
  Blinds,
  Bug,
  Cctv,
  ChevronDown,
  Camera,
  Check,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  Droplets,
  Eye,
  Fence,
  FileSignature,
  Forward,
  Grid2x2,
  Hammer,
  House,
  KeyRound,
  Layers,
  Leaf,
  Mic,
  PaintRoller,
  PanelTop,
  Pencil,
  Phone,
  Play,
  Plus,
  Refrigerator,
  Ruler,
  Signal,
  Snowflake,
  Tag,
  Video,
  WashingMachine,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/reveal";
import { NotificationToast } from "@/components/notification-toast";
import { formatPhone } from "@/components/quote-document";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QuickOffer - הצעת מחיר מהודעה קולית ב-WhatsApp",
  description:
    "בעל מקצוע? שלח הודעה קולית ב-WhatsApp וקבל תוך דקה הצעת מחיר מעוצבת, מוכנה להעברה ללקוח. הלקוח מאשר וחותם בקישור. בלי אפליקציה, בלי הרשמה.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "QuickOffer - שלח הודעה קולית. קבל הצעת מחיר. סגור עסקה.",
    description: "הצעות מחיר מעוצבות מהודעה קולית ב-WhatsApp, תוך דקה.",
    locale: "he_IL",
    type: "website",
  },
};

const WELCOME = "היי";

export default async function LandingPage() {
  const phone = (await getSetting("bot.phone")).replace(/\D/g, "");
  const wa = `https://wa.me/${phone}?text=${encodeURIComponent(WELCOME)}`;
  const tgUser = await getSetting("telegram.bot_username");
  const tg = tgUser ? `https://t.me/${tgUser}` : null;
  const channels = tg ? "WhatsApp או טלגרם" : "WhatsApp";

  return (
    <main className="flex-1 overflow-x-hidden">
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative">
        {/* soft background */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-soft/80 via-surface to-surface" />
          <div className="anim-blob absolute -top-32 -end-24 h-[420px] w-[420px] rounded-full bg-brand/15 blur-3xl" />
          <div className="anim-blob absolute top-40 -start-32 h-[380px] w-[380px] rounded-full bg-[#25D366]/15 blur-3xl [animation-delay:-6s]" />
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)",
            }}
          />
        </div>

        <div className="max-w-6xl mx-auto px-5 pt-6 pb-20 md:pt-8 md:pb-28">
          <nav className="flex items-center justify-between mb-14 md:mb-20 anim-fade-up">
            <div className="flex items-center gap-2.5 font-bold text-lg">
              <span className="grid place-items-center h-10 w-10 rounded-2xl bg-brand text-brand-ink shadow-md shadow-brand/30">
                <Mic className="h-5 w-5" />
              </span>
              QuickOffer
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="#how" className="text-muted hover:text-ink hidden sm:block">איך זה עובד</a>
              <a href="#pricing" className="text-muted hover:text-ink hidden sm:block">תמחור</a>
              <a href="#faq" className="text-muted hover:text-ink hidden sm:block">שאלות</a>
              <WhatsAppButton href={wa} compact />
            </div>
          </nav>

          <div className="grid md:grid-cols-[1.15fr_0.85fr] gap-14 md:gap-8 items-center">
            <div className="space-y-7">
              <span className="anim-fade-up inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white/70 backdrop-blur px-3 py-1.5 text-xs font-medium text-brand shadow-sm">
                <span className="relative grid place-items-center h-2 w-2">
                  <span className="anim-ring absolute inset-0 rounded-full text-[#25D366]" />
                  <span className="h-2 w-2 rounded-full bg-[#25D366]" />
                </span>
                עובד בתוך {channels}. בלי אפליקציה.
              </span>
              <h1 className="anim-fade-up [animation-delay:80ms] text-[2.6rem] sm:text-5xl md:text-6xl font-bold leading-[1.12] tracking-tight">
                שלח הודעה קולית.
                <br />
                קבל הצעת מחיר.
                <br />
                <span className="text-brand">סגור עסקה.</span>
              </h1>
              <p className="anim-fade-up [animation-delay:160ms] text-lg md:text-xl text-muted max-w-[34rem] leading-relaxed">
                לבעלי מקצוע בשטח - חשמלאים, אינסטלטורים, מזגנים, שיפוצים. מדברים 20 שניות ב-{channels},
                ותוך דקה יש הצעת מחיר מעוצבת עם הלוגו שלך, מוכנה להעברה ללקוח. הלקוח פותח, מאשר וחותם.
              </p>
              <div className="anim-fade-up [animation-delay:240ms] space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <WhatsAppButton href={wa} big />
                  {tg && <TelegramButton href={tg} big />}
                </div>
                <div className="text-sm text-muted leading-snug space-y-0.5">
                  <div>5 הצעות ראשונות חינם.</div>
                  <div className="text-xs">
                    WhatsApp: <bdi dir="ltr">{formatPhone(phone)}</bdi>
                    {tg && (
                      <>
                        {" · "}טלגרם:{" "}
                        <a href={tg} target="_blank" rel="noopener" className="underline">
                          <bdi dir="ltr">@{tgUser}</bdi>
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <ul className="anim-fade-up [animation-delay:320ms] flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted pt-2">
                {["0 התקנות", "0 הרשמות", "0 טפסים", "דקה אחת להצעה"].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-brand" /> {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative anim-fade-up [animation-delay:200ms]">
              <div className="absolute inset-x-8 top-10 bottom-0 -z-10 rounded-[3rem] bg-brand/20 blur-3xl" />
              <div className="anim-float">
                <ChatMockup />
              </div>
              {/* floating notification */}
              <NotificationToast className="absolute hidden sm:flex" />
            </div>
          </div>
        </div>

        {/* trades */}
        <div className="max-w-6xl mx-auto px-5 pb-16 md:pb-20">
          <Reveal className="rounded-3xl border border-line/80 bg-white/70 backdrop-blur-sm px-6 py-6 md:px-10 md:py-7 flex flex-col md:flex-row md:items-center gap-5">
            <div className="md:w-56 shrink-0">
              <div className="font-bold">נבנה לבעלי מקצוע בשטח</div>
              <div className="text-sm text-muted">כל מי שנותן הצעת מחיר מהרכב או מהאתר</div>
            </div>
            <ul className="flex flex-wrap gap-2.5">
              {TRADES.map(({ label, icon: Icon }) => (
                <li key={label} className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-sm">
                  <Icon className="h-4 w-4 text-brand" />
                  {label}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------- how it works */}
      <section id="how" className="max-w-6xl mx-auto px-5 py-20 md:py-28 scroll-mt-16">
        <Reveal className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-semibold text-brand mb-3">איך זה עובד</p>
          <h2 className="text-3xl md:text-4xl font-bold">שלושה צעדים. הודעה קולית אחת.</h2>
          <p className="text-muted mt-4 text-lg">
            אין מה ללמוד. ההודעה הקולית היא כבר ההרגל שלך - אנחנו רק מחזירים אותה כהצעה.
          </p>
        </Reveal>
        <ol className="grid md:grid-cols-3 gap-5">
          <Step n="1" icon={Mic} title="מקליטים" delay={0}>
            &quot;הצעת מחיר לדני כהן - שלוש נקודות חשמל 180 שקל ליחידה, ביקור 200, לפני מע״מ&quot;
          </Step>
          <Step n="2" icon={ClipboardList} title="מקבלים הצעה מוכנה" delay={120}>
            הבוט מחזיר סיכום, קישור לעריכה, והודעה נקייה להעברה ללקוח - מהמספר שלך, באותו צ׳אט שבו שלחת.
          </Step>
          <Step n="3" icon={FileSignature} title="הלקוח מאשר וחותם" delay={240}>
            הלקוח פותח דף מעוצב מהטלפון, מאשר וחותם באצבע. אתה מקבל התראה ב-WhatsApp.
          </Step>
        </ol>
        <Reveal delay={300} className="mt-10 mx-auto max-w-2xl rounded-2xl border border-line bg-card p-5 flex gap-4 items-start">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand-soft text-brand shrink-0">
            <Pencil className="h-5 w-5" />
          </span>
          <p className="text-sm text-muted leading-relaxed">
            <span className="font-semibold text-ink">טעית?</span> כותבים או אומרים &quot;תשנה ביקור ל-250&quot; - וההצעה מתעדכנת.
            הקישור ללקוח תמיד מציג את הגרסה העדכנית, גם אם כבר העברת אותו.
          </p>
        </Reveal>
      </section>

      {/* -------------------------------------------------------------- benefits */}
      <section className="relative bg-card border-y border-line">
        <div className="max-w-6xl mx-auto px-5 py-20 md:py-28">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold text-brand mb-3">למה QuickOffer</p>
            <h2 className="text-3xl md:text-4xl font-bold">נבנה לידיים עסוקות</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Benefit icon={Zap} title="דקה אחת" delay={0}>
              מהודעה קולית להצעה מוכנה להעברה - פחות מ-60 שניות, כולל תמלול.
            </Benefit>
            <Benefit icon={Tag} title="נראה מקצועי" delay={100}>
              לוגו, פירוט סעיפים, כמויות, מע״מ מחושב, תנאי תשלום ותוקף. לא עוד &quot;3 נקודות 450 + ביקור&quot;.
            </Benefit>
            <Benefit icon={Eye} title="יודעים מה קורה" delay={200}>
              הלקוח פתח? אישר? דחה? שאל שאלה? - מקבלים הודעה ב-WhatsApp מיד.
            </Benefit>
            <Benefit icon={Ban} title="לא הנהלת חשבונות" delay={300}>
              רק הצעות מחיר. בלי חשבוניות, בלי CRM, בלי ללמוד מערכת. {channels} - זו האפליקציה.
            </Benefit>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-5 py-20 md:py-28 scroll-mt-16">
        <Reveal className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-semibold text-brand mb-3">תמחור</p>
          <h2 className="text-3xl md:text-4xl font-bold">מתחילים חינם. משדרגים כשזה משתלם.</h2>
          <p className="text-muted mt-4 text-lg">הצעה אחת שנסגרת בזכות זה - וכבר החזיר את עצמו.</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
          <Plan name="ניסיון" price="0" per="5 הצעות" items={["כל היכולות", "בלי כרטיס אשראי"]} delay={0} />
          <Plan name="Basic" price="49" per="20 הצעות בחודש" items={["לוגו על ההצעה", "אישור לקוח בקישור", "התראות ב-WhatsApp"]} highlight delay={100} />
          <Plan name="Pro" price="99" per="100 הצעות בחודש" items={["הכול ב-Basic", "חתימה דיגיטלית", "בלי מיתוג QuickOffer", "תזכורות ללקוח"]} delay={200} />
          <Plan name="Unlimited" price="149" per="ללא הגבלה" items={["הכול ב-Pro", "שליחה מהמספר שלך", "סליקת מקדמות"]} delay={300} />
        </div>
        <p className="text-center text-xs text-muted mt-6">המחירים בש״ח לחודש, לפני מע״מ. חלק מיכולות Pro/Unlimited בפיתוח.</p>
      </section>

      {/* -------------------------------------------------------------------- FAQ */}
      <section id="faq" className="bg-card border-y border-line scroll-mt-16">
        <div className="max-w-3xl mx-auto px-5 py-20 md:py-28">
          <Reveal className="text-center mb-12">
            <p className="text-sm font-semibold text-brand mb-3">שאלות נפוצות</p>
            <h2 className="text-3xl md:text-4xl font-bold">מה שבעלי מקצוע שואלים</h2>
          </Reveal>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <details className="group rounded-2xl border border-line bg-surface open:bg-white open:shadow-sm transition">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none p-5 font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown className="h-5 w-5 text-muted shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-5 pb-5 -mt-1 text-muted leading-relaxed">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- CTA */}
      <section className="relative overflow-hidden bg-brand text-brand-ink">
        <div className="anim-blob absolute -top-24 -start-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="anim-blob absolute -bottom-24 -end-24 h-96 w-96 rounded-full bg-[#25D366]/25 blur-3xl [animation-delay:-7s]" />
        <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-28 text-center space-y-6">
          <Reveal>
            <h2 className="text-3xl md:text-5xl font-bold leading-tight">ההצעה הבאה שלך -<br className="sm:hidden" /> בהודעה קולית אחת</h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="opacity-90 text-lg max-w-xl mx-auto">שלח &quot;{WELCOME}&quot; לבוט, ענה על שתי שאלות, ותשלח את ההצעה הראשונה תוך דקה.</p>
          </Reveal>
          <Reveal delay={200} className="flex flex-col sm:flex-row justify-center gap-3">
            <WhatsAppButton href={wa} big inverted />
            {tg && <TelegramButton href={tg} big inverted />}
          </Reveal>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-5 py-10 text-sm text-muted flex flex-wrap gap-x-6 gap-y-2 justify-between items-center">
        <span className="inline-flex items-center gap-2 font-semibold text-ink">
          <span className="grid place-items-center h-7 w-7 rounded-lg bg-brand text-brand-ink"><Mic className="h-3.5 w-3.5" /></span>
          QuickOffer
        </span>
        <span>© {new Date().getFullYear()} · הצעות מחיר בלבד - לא תוכנת הנהלת חשבונות.</span>
      </footer>
    </main>
  );
}

const TRADES: { label: string; icon: LucideIcon }[] = [
  { label: "חשמל", icon: Zap },
  { label: "אינסטלציה", icon: Droplets },
  { label: "מיזוג אוויר", icon: Snowflake },
  { label: "שיפוצים", icon: Hammer },
  { label: "אלומיניום", icon: PanelTop },
  { label: "גינון", icon: Leaf },
  { label: "התקנות", icon: Wrench },
  { label: "צבע", icon: PaintRoller },
  { label: "ריצוף", icon: Grid2x2 },
  { label: "גבס", icon: Layers },
  { label: "נגרות", icon: Ruler },
  { label: "מנעולנות", icon: KeyRound },
  { label: "דלתות", icon: DoorOpen },
  { label: "איטום וגגות", icon: House },
  { label: "מטבחים", icon: Refrigerator },
  { label: "תריסים", icon: Blinds },
  { label: "גדרות ופרגולות", icon: Fence },
  { label: "מצלמות ואזעקה", icon: Cctv },
  { label: "טכנאי מכשירים", icon: WashingMachine },
  { label: "הדברה", icon: Bug },
];

const FAQ = [
  {
    q: "איך הלקוח מקבל את ההצעה?",
    a: "הבוט מחזיר לך הודעה נקייה עם קישור. לחיצה ארוכה, Forward (ב-WhatsApp או בטלגרם), והלקוח מקבל אותה ממך - לא ממספר זר. הוא פותח דף מעוצב מהטלפון, בלי להתקין ובלי להירשם.",
  },
  {
    q: "מה אם הבוט לא הבין אותי נכון?",
    a: "כותבים או אומרים את התיקון (\"תשנה ביקור ל-250\", \"תוסיף שקע כפול 120\") וההצעה מתעדכנת. יש גם מסך עריכה מלא בקישור. מחיר שלא אמרת לעולם לא מומצא - הפריט מסומן לבדיקה.",
  },
  {
    q: "מע״מ?",
    a: "באונבורדינג אתה אומר אם אתה עוסק פטור או מורשה. מורשה - ההצעות מחושבות עם מע״מ 18% אוטומטית. אמרת \"כולל מע״מ\"? הבוט מבין גם את זה.",
  },
  {
    q: "איך אני יודע שהלקוח ראה?",
    a: "כשהלקוח פותח את הקישור בפעם הראשונה, כשהוא מאשר וחותם, כשהוא דוחה או שואל שאלה - אתה מקבל הודעה ב-WhatsApp באותו רגע.",
  },
  {
    q: "זה מוציא חשבוניות?",
    a: "לא, ובכוונה. QuickOffer עושה דבר אחד: הצעות מחיר מהודעה קולית. חיבור לתוכנת החשבוניות שלך - בהמשך.",
  },
  {
    q: "אני לא ב-WhatsApp, יש טלגרם?",
    a: "כן. אותו בוט, אותה שיחה - שולחים הודעה קולית בטלגרם ומקבלים את אותה הצעה עם אותם קישורים. ההודעה ללקוח עדיין נשלחת מהטלפון שלך, באיזה אפליקציה שתבחר.",
  },
  {
    q: "כמה זה עולה להתחיל?",
    a: "כלום. 5 ההצעות הראשונות חינם, בלי כרטיס אשראי. אחר כך 49 ₪ לחודש ל-20 הצעות.",
  },
];

// -------------------------------------------------------------- components

function WhatsAppButton({ href, big, inverted, compact }: { href: string; big?: boolean; inverted?: boolean; compact?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={`group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-semibold transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]
        ${big ? "px-7 py-4 text-lg shadow-lg shadow-[#25D366]/30 hover:shadow-xl hover:shadow-[#25D366]/40" : compact ? "px-3.5 py-2 text-sm shadow-sm" : "px-4 py-3 shadow-md"}
        ${inverted ? "bg-white text-brand shadow-black/20 hover:shadow-black/30" : "bg-[#25D366] text-white"}`}
    >
      <WhatsAppIcon />
      {compact ? "התחל" : "התחל ב-WhatsApp"}
    </a>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
    </svg>
  );
}

function TelegramButton({ href, big, inverted }: { href: string; big?: boolean; inverted?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-semibold transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]
        ${big ? "px-7 py-4 text-lg" : "px-4 py-3"}
        ${inverted ? "bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25" : "bg-card text-ink ring-1 ring-line shadow-sm hover:shadow-md"}`}
    >
      <TelegramIcon className={inverted ? "text-white" : "text-[#229ED9]"} />
      התחל בטלגרם
    </a>
  );
}

function TelegramIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-6 w-6 ${className}`} fill="currentColor" aria-hidden>
      <path d="M21.9 4.6c.3-1.2-.9-2.1-2-1.7L2.6 9.6c-1.3.5-1.2 2.3.1 2.7l4.4 1.4 1.7 5.4c.2.7 1.1 1 1.7.5l2.5-2.1 4.6 3.4c.8.6 2 .1 2.2-.9l2.1-15.4zM9.3 13.3l8.4-6.6c.2-.1.4.1.2.3l-6.9 6.5-.3 3.2-1.4-3.4z" />
    </svg>
  );
}

function Step({ n, icon: Icon, title, children, delay }: { n: string; icon: LucideIcon; title: string; children: React.ReactNode; delay: number }) {
  return (
    <Reveal as="li" delay={delay} className="card-hover rounded-3xl border border-line bg-card p-6 md:p-7 space-y-4 relative">
      <span className="absolute top-5 end-5 grid place-items-center h-8 w-8 rounded-full bg-surface text-xs font-semibold text-muted">{n}</span>
      <div className="grid place-items-center h-14 w-14 rounded-2xl bg-brand-soft text-brand">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="font-bold text-xl">{title}</h3>
      <p className="text-muted leading-relaxed">{children}</p>
    </Reveal>
  );
}

function Benefit({ icon: Icon, title, children, delay }: { icon: LucideIcon; title: string; children: React.ReactNode; delay: number }) {
  return (
    <Reveal delay={delay} className="card-hover rounded-3xl border border-line bg-surface p-6 space-y-3">
      <div className="grid place-items-center h-12 w-12 rounded-2xl bg-brand text-brand-ink shadow-md shadow-brand/25">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-muted leading-relaxed">{children}</p>
    </Reveal>
  );
}

function Plan({ name, price, per, items, highlight, delay }: { name: string; price: string; per: string; items: string[]; highlight?: boolean; delay: number }) {
  return (
    <Reveal
      delay={delay}
      className={`card-hover relative rounded-3xl border p-6 space-y-5 ${highlight ? "border-brand bg-white shadow-xl shadow-brand/10 ring-1 ring-brand/30" : "border-line bg-card"}`}
    >
      {highlight && (
        <span className="absolute -top-3 start-5 rounded-full bg-brand text-brand-ink text-xs font-semibold px-3 py-1 shadow">הכי פופולרי</span>
      )}
      <div>
        <div className="font-bold">{name}</div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-3xl font-bold">{price}</span>
          <span className="text-muted text-sm">₪ / חודש</span>
        </div>
        <div className="text-sm text-muted">{per}</div>
      </div>
      <ul className="text-sm space-y-1.5">
        {items.map((it) => (
          <li key={it} className="flex gap-2 items-start">
            <Check className="h-4 w-4 mt-0.5 shrink-0 text-brand" />
            {it}
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

/** Static illustration of the §6.3 conversation, framed as an iPhone running WhatsApp (Hebrew layout). */
function ChatMockup() {
  return (
    <div className="mx-auto w-[300px]" aria-hidden>
      {/* iPhone body */}
      <div className="relative rounded-[3rem] bg-[#1c1c1e] p-[10px] shadow-[0_30px_60px_-20px_rgba(15,23,42,0.45)] ring-1 ring-black/40">
        {/* side buttons */}
        <span className="absolute -start-[3px] top-[110px] h-8 w-[3px] rounded-s bg-[#2c2c2e]" />
        <span className="absolute -start-[3px] top-[160px] h-14 w-[3px] rounded-s bg-[#2c2c2e]" />
        <span className="absolute -start-[3px] top-[225px] h-14 w-[3px] rounded-s bg-[#2c2c2e]" />
        <span className="absolute -end-[3px] top-[180px] h-20 w-[3px] rounded-e bg-[#2c2c2e]" />

        {/* screen */}
        <div className="relative h-[610px] rounded-[2.4rem] overflow-hidden bg-[#efe7dd] flex flex-col">
          {/* dynamic island */}
          <div className="absolute top-2.5 inset-x-0 flex justify-center z-20">
            <div className="h-[30px] w-[100px] rounded-full bg-black" />
          </div>

          {/* status bar + WhatsApp header */}
          <div className="bg-[#f6f6f6] text-ink pt-3 pb-2 px-4 border-b border-black/10 shrink-0">
            <div className="flex items-center justify-between text-[12px] font-semibold px-1" dir="ltr">
              <span>9:41</span>
              <span className="inline-flex items-center gap-1">
                <Signal className="h-3 w-3" />
                <Wifi className="h-3 w-3" />
                <BatteryFull className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center text-[#007aff] text-[13px]">
                <ChevronRight className="h-5 w-5 -me-1" />
                12
              </span>
              <span className="h-9 w-9 rounded-full bg-brand grid place-items-center text-white shrink-0">
                <Mic className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="font-semibold text-[14px] truncate">QuickOffer</div>
                {/* status flips to "typing" while the bot prepares the quote (1.2s - 4s) */}
                <div className="relative h-[14px] text-[11px] text-muted">
                  <span className="anim-status-online absolute inset-0">מקוון</span>
                  <span className="anim-status-typing absolute inset-0">מקליד...</span>
                </div>
              </div>
              <Video className="h-5 w-5 text-[#007aff]" />
              <Phone className="h-[18px] w-[18px] text-[#007aff]" />
            </div>
          </div>

          {/* conversation */}
          <div
            className="flex-1 px-2.5 py-3 space-y-1.5 text-[12.5px] leading-[1.35] overflow-hidden"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(0,0,0,0.035) 1.5px, transparent 1.5px), radial-gradient(circle at 70% 60%, rgba(0,0,0,0.035) 1.5px, transparent 1.5px)",
              backgroundSize: "26px 26px, 34px 34px",
            }}
          >
            <div className="flex justify-center">
              <span className="text-[10px] bg-white/80 text-muted rounded-lg px-2 py-0.5 shadow-sm">היום</span>
            </div>

            <Bubble me time="10:02" delay={400}>
              <span className="inline-flex items-center gap-2">
                <span className="h-7 w-7 rounded-full bg-[#25D366] grid place-items-center text-white shrink-0">
                  <Play className="h-3 w-3 fill-current" />
                </span>
                <Waveform />
                <span className="text-[11px] text-muted">0:19</span>
              </span>
            </Bubble>

            {/* bot "heard, preparing" - shows between the voice note and the quote */}
            <div className="anim-typing flex justify-start">
              <div className="bg-white rounded-xl rounded-tr-sm px-3 py-2.5 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] inline-flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="anim-typing-dot h-1.5 w-1.5 rounded-full bg-ink/50"
                    style={{ animationDelay: `${i * 160}ms` }}
                  />
                ))}
              </div>
            </div>

            <Bubble time="10:02" delay={4000}>
              <span className="inline-flex items-center gap-1 font-semibold">
                <ClipboardList className="h-3.5 w-3.5" /> הצעה #1042 - דני כהן
              </span>
              <br />• התקנת גוף תאורה ×3 - 450 ₪
              <br />• ביקור ×1 - 200 ₪
              <br />
              סה״כ 650 ₪ + מע״מ = 767 ₪
              <br />
              <span className="inline-flex items-center gap-1 text-ink/60">
                <Pencil className="h-3 w-3" /> לתקן: כתוב או תגיד לי
              </span>
            </Bubble>

            <Bubble time="10:02" delay={4450}>
              <span className="inline-flex items-center gap-1">
                <Forward className="h-3.5 w-3.5" /> להעביר ללקוח - לחיצה ארוכה ← Forward
              </span>
            </Bubble>

            <Bubble time="10:02" delay={4900}>
              שלום דני, מצורפת הצעת מחיר מיוסי חשמל:
              <br />
              <span className="text-[#027eb5] underline">qo.app/q/a8Hd3kQ</span>
              <br />
              ההצעה תקפה ל-14 יום. לאישור - לחץ על הקישור.
            </Bubble>

            <Bubble time="10:47" delay={7200}>
              <span className="inline-flex items-center gap-1">
                <BadgeCheck className="h-4 w-4 text-ok" /> דני כהן אישר וחתם על הצעה #1042 (767 ₪)
              </span>
            </Bubble>
          </div>

          {/* composer */}
          <div className="bg-[#f6f6f6] border-t border-black/10 px-2.5 pt-2 pb-5 flex items-center gap-2 shrink-0">
            <Plus className="h-6 w-6 text-[#007aff]" />
            <div className="flex-1 h-8 rounded-full bg-white border border-black/10 px-3 flex items-center text-[12px] text-muted">
              הודעה
            </div>
            <Camera className="h-5 w-5 text-[#007aff]" />
            <Mic className="h-5 w-5 text-[#007aff]" />
          </div>
          {/* home indicator */}
          <div className="absolute bottom-1.5 inset-x-0 flex justify-center">
            <div className="h-1 w-24 rounded-full bg-black/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Waveform() {
  const bars = [3, 6, 10, 7, 12, 9, 5, 11, 8, 4, 9, 13, 6, 3, 8, 10, 5, 7, 4, 6];
  return (
    <span className="inline-flex items-center gap-[2px] h-4">
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-[2px] rounded-full ${i < 8 ? "bg-[#25D366] anim-wave" : "bg-ink/25"}`}
          style={{ height: h, animationDelay: `${i * 90}ms` }}
        />
      ))}
    </span>
  );
}

/** WhatsApp bubble. In the Hebrew (RTL) app, the user's own messages sit on the left. */
function Bubble({ me, time, delay = 0, children }: { me?: boolean; time: string; delay?: number; children: React.ReactNode }) {
  return (
    <div className={`flex anim-pop ${me ? "justify-end" : "justify-start"}`} style={{ animationDelay: `${delay}ms` }}>
      <div
        className={`relative max-w-[86%] px-2.5 pt-1.5 pb-4 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${
          me ? "bg-[#d9fdd3] rounded-xl rounded-tl-sm" : "bg-white rounded-xl rounded-tr-sm"
        }`}
      >
        {children}
        <span className="absolute bottom-1 left-2 inline-flex items-center gap-0.5 text-[9.5px] text-muted" dir="ltr">
          {time}
          {me && <CheckCheck className="h-3 w-3 text-[#53bdeb]" />}
        </span>
      </div>
    </div>
  );
}
