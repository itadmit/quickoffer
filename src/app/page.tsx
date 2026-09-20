import type { Metadata } from "next";
import { formatPhone } from "@/components/quote-document";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QuickVoice — הצעת מחיר מהודעה קולית ב-WhatsApp",
  description:
    "בעל מקצוע? שלח הודעה קולית ב-WhatsApp וקבל תוך דקה הצעת מחיר מעוצבת, מוכנה להעברה ללקוח. הלקוח מאשר וחותם בקישור. בלי אפליקציה, בלי הרשמה.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "QuickVoice — שלח הודעה קולית. קבל הצעת מחיר. סגור עסקה.",
    description: "הצעות מחיר מעוצבות מהודעה קולית ב-WhatsApp, תוך דקה.",
    locale: "he_IL",
    type: "website",
  },
};

const WELCOME = "היי";

export default async function LandingPage() {
  const phone = (await getSetting("bot.phone")).replace(/\D/g, "");
  const wa = `https://wa.me/${phone}?text=${encodeURIComponent(WELCOME)}`;

  return (
    <main className="flex-1">
      {/* ---------------------------------------------------------------- hero */}
      <section className="bg-gradient-to-b from-brand-soft/70 to-surface">
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-14 md:pt-10 md:pb-20">
          <nav className="flex items-center justify-between mb-10 md:mb-16">
            <div className="flex items-center gap-2 font-bold text-lg">
              <span className="grid place-items-center h-9 w-9 rounded-xl bg-brand text-brand-ink">🎤</span>
              QuickVoice
            </div>
            <a href="#pricing" className="text-sm text-muted hover:text-ink hidden sm:block">
              תמחור
            </a>
          </nav>

          <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl font-bold leading-[1.15]">
                שלח הודעה קולית.
                <br />
                קבל הצעת מחיר.
                <br />
                <span className="text-brand">סגור עסקה.</span>
              </h1>
              <p className="text-lg text-muted max-w-prose">
                לבעלי מקצוע בשטח — חשמלאים, אינסטלטורים, מזגנים, שיפוצים. מדברים 20 שניות ב-WhatsApp,
                ותוך דקה יש הצעת מחיר מעוצבת עם הלוגו שלך, מוכנה להעברה ללקוח. הלקוח פותח, מאשר וחותם.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <WhatsAppButton href={wa} big />
                <span className="text-sm text-muted">
                  בלי אפליקציה. בלי הרשמה. 5 הצעות ראשונות חינם.
                </span>
              </div>
              <p className="text-xs text-muted" dir="ltr">
                <span dir="rtl">או שמור את המספר:</span> {formatPhone(phone)}
              </p>
            </div>

            <ChatMockup />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- how it works */}
      <section className="max-w-5xl mx-auto px-4 py-14 md:py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">איך זה עובד</h2>
        <ol className="grid md:grid-cols-3 gap-4">
          <Step n="1" icon="🎤" title="מדברים">
            &quot;הצעת מחיר לדני כהן — שלוש נקודות חשמל 180 שקל ליחידה, ביקור 200, לפני מע״מ&quot;
          </Step>
          <Step n="2" icon="📋" title="מקבלים הצעה מוכנה">
            הבוט מחזיר סיכום, קישור לעריכה, והודעה נקייה להעברה ללקוח — מהמספר שלך.
          </Step>
          <Step n="3" icon="✅" title="הלקוח מאשר וחותם">
            הלקוח פותח דף מעוצב מהטלפון, מאשר וחותם באצבע. אתה מקבל התראה ב-WhatsApp.
          </Step>
        </ol>
        <p className="text-center text-sm text-muted mt-8">
          טעית? כותבים או אומרים &quot;תשנה ביקור ל-250&quot; — וההצעה מתעדכנת. הקישור ללקוח תמיד מציג את הגרסה
          העדכנית.
        </p>
      </section>

      {/* -------------------------------------------------------------- benefits */}
      <section className="bg-card border-y border-line">
        <div className="max-w-5xl mx-auto px-4 py-14 md:py-20 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Benefit icon="⚡" title="דקה אחת">
            מהודעה קולית להצעה מוכנה להעברה — פחות מ-60 שניות, כולל תמלול.
          </Benefit>
          <Benefit icon="🏷️" title="נראה מקצועי">
            לוגו, פירוט סעיפים, כמויות, מע״מ מחושב, תנאי תשלום ותוקף. לא עוד &quot;3 נקודות 450 + ביקור&quot;.
          </Benefit>
          <Benefit icon="👀" title="יודעים מה קורה">
            הלקוח פתח? אישר? דחה? שאל שאלה? — מקבלים הודעה ב-WhatsApp מיד.
          </Benefit>
          <Benefit icon="🚫" title="לא הנהלת חשבונות">
            רק הצעות מחיר. בלי חשבוניות, בלי CRM, בלי ללמוד מערכת. WhatsApp הוא האפליקציה.
          </Benefit>
        </div>
      </section>

      {/* ---------------------------------------------------------------- pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 py-14 md:py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">תמחור</h2>
        <p className="text-center text-muted mb-10">מתחילים חינם. משדרגים כשזה משתלם.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Plan name="ניסיון" price="0" per="5 הצעות" items={["כל היכולות", "בלי כרטיס אשראי"]} />
          <Plan name="Basic" price="49" per="20 הצעות בחודש" items={["לוגו על ההצעה", "אישור לקוח בקישור", "התראות ב-WhatsApp"]} highlight />
          <Plan name="Pro" price="99" per="100 הצעות בחודש" items={["הכול ב-Basic", "חתימה דיגיטלית", "בלי מיתוג QuickVoice", "תזכורות ללקוח"]} />
          <Plan name="Unlimited" price="149" per="ללא הגבלה" items={["הכול ב-Pro", "שליחה מהמספר שלך", "סליקת מקדמות"]} />
        </div>
        <p className="text-center text-xs text-muted mt-4">המחירים בש״ח לחודש, לפני מע״מ. חלק מיכולות Pro/Unlimited בפיתוח.</p>
      </section>

      {/* -------------------------------------------------------------------- CTA */}
      <section className="bg-brand text-brand-ink">
        <div className="max-w-5xl mx-auto px-4 py-14 md:py-16 text-center space-y-5">
          <h2 className="text-2xl md:text-3xl font-bold">ההצעה הבאה שלך — בהודעה קולית אחת</h2>
          <p className="opacity-90">שלח &quot;{WELCOME}&quot; לבוט, ענה על שתי שאלות, ותשלח את ההצעה הראשונה תוך דקה.</p>
          <div className="flex justify-center">
            <WhatsAppButton href={wa} big inverted />
          </div>
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-4 py-8 text-xs text-muted flex flex-wrap gap-x-6 gap-y-2 justify-between">
        <span>© {new Date().getFullYear()} QuickVoice</span>
        <span>הצעות מחיר בלבד — לא תוכנת הנהלת חשבונות.</span>
      </footer>
    </main>
  );
}

// -------------------------------------------------------------- components

function WhatsAppButton({ href, big, inverted }: { href: string; big?: boolean; inverted?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-semibold shadow-md active:scale-[0.99] transition
        ${big ? "px-6 py-4 text-lg" : "px-4 py-3"}
        ${inverted ? "bg-white text-brand" : "bg-[#25D366] text-white"}`}
    >
      <WhatsAppIcon />
      התחל ב-WhatsApp
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

function Step({ n, icon, title, children }: { n: string; icon: string; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border border-line bg-card p-5 space-y-2 relative">
      <span className="absolute top-4 end-4 text-xs text-muted font-mono">{n}/3</span>
      <div className="text-3xl">{icon}</div>
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{children}</p>
    </li>
  );
}

function Benefit({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-2xl">{icon}</div>
      <h3 className="font-bold">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{children}</p>
    </div>
  );
}

function Plan({ name, price, per, items, highlight }: { name: string; price: string; per: string; items: string[]; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${highlight ? "border-brand bg-brand-soft/40 shadow-sm" : "border-line bg-card"}`}>
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
          <li key={it} className="flex gap-2">
            <span className="text-brand">✓</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Static illustration of the §6.3 conversation. */
function ChatMockup() {
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[2rem] border-8 border-ink/90 bg-[#efeae2] shadow-2xl overflow-hidden" aria-hidden>
      <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3 text-sm">
        <span className="h-8 w-8 rounded-full bg-white/20 grid place-items-center">🎤</span>
        <div>
          <div className="font-semibold">QuickVoice</div>
          <div className="text-[11px] opacity-80">מחובר</div>
        </div>
      </div>
      <div className="p-3 space-y-2 text-[13px] leading-snug">
        <Bubble me>
          <span className="inline-flex items-center gap-2 text-ink/80">
            <span className="h-6 w-6 rounded-full bg-[#25D366] grid place-items-center text-white text-[10px]">▶</span>
            <span className="inline-block h-1 w-28 rounded bg-ink/30" />
            0:19
          </span>
        </Bubble>
        <Bubble>
          📋 הצעה #1042 — דני כהן
          <br />• התקנת גוף תאורה ×3 — 450 ₪
          <br />• ביקור ×1 — 200 ₪
          <br />
          סה״כ 650 ₪ + מע״מ = 767 ₪
          <br />
          <span className="text-ink/60">✏️ לתקן: כתוב או תגיד לי</span>
        </Bubble>
        <Bubble>👇 להעביר ללקוח — לחיצה ארוכה ← Forward</Bubble>
        <Bubble>
          שלום דני, מצורפת הצעת מחיר מיוסי חשמל:
          <br />
          <span className="text-[#027eb5] underline">qv.app/q/a8Hd3kQ</span>
          <br />
          ההצעה תקפה ל-14 יום. לאישור — לחץ על הקישור.
        </Bubble>
        <Bubble>✅ דני כהן אישר וחתם על הצעה #1042 (767 ₪)</Bubble>
      </div>
    </div>
  );
}

function Bubble({ me, children }: { me?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex ${me ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-xl px-3 py-2 shadow-sm ${me ? "bg-[#d9fdd3]" : "bg-white"}`}>{children}</div>
    </div>
  );
}
