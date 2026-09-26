# QuickOffer — הקשר לפיתוח (CLAUDE.md)

קובץ זה נטען אוטומטית בכל session. הוא מסכם **מה נלמד ומה הוחלט** עד 25.9.2026, כדי שאפשר יהיה להמשיך בלי לשחזר את השיחה.

## מה זה הפרויקט

**QuickOffer** — בעל מקצוע (חשמלאי, אינסטלטור, שיפוצניק…) שולח **הודעה קולית ב-WhatsApp**, ומקבל בחזרה הצעת מחיר מעוצבת, מוכנה להעברה ללקוח, תוך דקה. הלקוח פותח קישור, מאשר וחותם. בעל המקצוע מקבל התראה ב-WhatsApp.

**המסר:** שלח הודעה קולית. קבל הצעת מחיר. סגור עסקה.

## קבצים

| קובץ | תפקיד |
|---|---|
| `PRODUCT.md` | **מקור האמת.** אפיון מלא (v0.4): פרסונות, זרימות שיחה מילה-במילה, חוזה iBot, צינור AI, מסכים, מודל נתונים, סטטוסים, תמחור, תיחום, סיכונים, טכנולוגיה. לקרוא לפני כל עבודה |
| `start.md` | הרעיון המקורי (עדיין בשם הישן VoiceQuote). היסטורי בלבד — לא לעדכן |
| `CLAUDE.md` | הקובץ הזה |

## מצב הפרויקט

- **MVP בנוי ו-חי בפרודקשן מקצה לקצה (25.9.2026).** כל 11 סעיפי ה-MVP ב-PRODUCT.md §12 קיימים חוץ מ-PDF (נדחה במכוון). **החיבור האמיתי הושלם ופועל:** iBot מחובר (`ibot.instance_status=connected`), webhook אמיתי מגיע (`ibot.last_webhook_at` מתעדכן, נראה 25.9 בבוקר), 12 מיגרציות רצו על Neon (כולל `price_book`+עמודות התזכורות), והמפתחות מוזנים ב-`app_settings` מוצפנים. **תנועה אמיתית נמדדה 25.9.2026:** 7 משתמשים, 11 הצעות (8 לא-טיוטה), 68 הודעות נכנסות. השלב הבא הוא כוונון מול השימוש האמיתי, לא חיבור.
- **Git:** `origin` = https://github.com/itadmit/quickoffer.git (ריפו חדש שנוצר עם השינוי ל-QuickOffer; הריפו quickvoice נמחק), ענף `main`. לא לדחוף בלי שהמשתמש מבקש.
- **סביבה מקומית:** Postgres 15 מקומי (`quickoffer_dev`), `.env.local` קיים (gitignored). `npm run dev` / `npm run mock` / `npm run seed:local`.
- **התיקייה המקומית נקראת `VoiceQuote`** (השם הישן). השם הנכון הוא QuickOffer. המשתמש ישנה כשנוח לו.
- **היסטוריית שמות:** VoiceQuote (start.md) → QuickVoice (20.9.2026 בבוקר) → **QuickOffer** (20.9.2026 אחה"צ, החלטת המשתמש: השם צריך להגיד "הצעה"; QuickQuote קשה לאיות ותפוס, QuickPay מטעה). אם מופיע VoiceQuote/QuickVoice במקום כלשהו חוץ מ-start.md — זה שריד.

## החלטות ארכיטקטורה (סגורות)

1. **WhatsApp הוא הממשק, לא אפליקציה/PWA.** אין הרשמה, אין OTP — מספר הטלפון ב-WhatsApp הוא הזהות. Web רק לשני דברים: מסך עריכה (magic link) ודף לקוח ציבורי. טלגרם נפסל (הקהל לא שם).
2. **שכבת WhatsApp = iBot Chat** (ibot-chat.com). **המשתמש הוא הבעלים של iBot** — לכן זה חינם, ואפשר לבקש ממנו שינויים בצד iBot. חיבור לא-רשמי (סריקת QR), לא Meta Cloud API. לעטוף ב-`lib/whatsapp/` עם ממשק אחד (`sendText`, `sendDoc`, `parseInbound`) כדי שאפשר יהיה להחליף.
3. **Vercel + Neon** — הסטאק הקבוע של המשתמש. הכול serverless. Next.js 16, Drizzle, `@neondatabase/serverless`.
4. **AI: OpenAI בלבד להתחלה** — Whisper לתמלול, GPT ל-JSON. **אבל** ספק/מודל/מפתח נקראים מ-`app_settings` ב-DB דרך דשבורד סופר-אדמין (`/admin`), לא מהקוד. שני מפתחות נפרדים: תמלול ו-LLM. Groq / ivrit.ai / Anthropic / Gemini הם מימושים עתידיים של אותו ממשק (PRODUCT.md §7.6–7.7).
5. **Webhook מחזיר 200 מיד** ומעבד ברקע עם `waitUntil` מ-`@vercel/functions`. כתיבה ל-`inbound_messages` **לפני** ה-200. Cron מרים תקועים. Inngest/QStash רק כשיש משתמשים אמיתיים.
6. **PDF נדחה מהדמו.** הקישור הציבורי הוא המוצר.
7. **הלוגו ב-Basic** (לא ב-Pro כמו ב-start.md). מע״מ 18%. תוקף הצעה 14 יום.
8. **ההודעה להעברה ללקוח היא הודעה נפרדת ונקייה** — בעל המקצוע עושה Forward, והלקוח מקבל מהמספר שלו (אמון). PDF לא נשלח אוטומטית (יהיה לא מעודכן אחרי תיקון) — רק לפי בקשה.
9. **הקישור הציבורי חי** (מציג את הגרסה העדכנית) עד אישור, ואז מוקפא (snapshot).

## חוזה iBot — עובדות מאומתות (לא מהדוקומנטציה)

דף ה-API הרשמי (https://ibot-chat.com/api-docs.html) מתעד **שליחה בלבד**: `GET /send-text`, `/send-image`, `/send-video`, `/send-audio`, `/send-doc` עם `token`, `instance_id`, `jid` (`972501234567@s.whatsapp.net`). קליטה = webhook שמוגדר בדשבורד iBot ("Webhook URL — נשלח לכאן POST עם כל הודעה נכנסת").

### פיילוד אמיתי (נתפס ב-webhook.site, 20.9.2026, אחרי התיקון)

```json
{
  "uid": "…", "sessionId": "…", "instanceId": "…", "chatId": "…",
  "remoteJid": "972542284283@s.whatsapp.net",
  "msgFromMe": false,
  "actualObj": {
    "group": false,
    "type": "aud",                      // ← עדיין "aud", לא "audio". טקסט="text", תמונה="image"
    "msgId": "2A37D5ACC3189288D882",
    "remoteJid": "972542284283@s.whatsapp.net",
    "msgContext": {
      "caption": "",
      "fileName": "EgrnRi_inbox.oga",
      "mimetype": "audio/ogg; codecs=opus",
      "mediaUrl": "https://ibot-chat.com/media/EgrnRi_inbox.oga"   // null בטקסט
    },
    "reaction": "", "status": "sent", "star": false,
    "timestamp": 1789897973,            // Unix seconds
    "senderName": "יוגב אביטן תדמית אינטראקטיב",   // push name
    "route": "incoming",
    "context": null                     // ⚠️ בתמונה עדיין מגיע {"jid":null,"id":null} — לטפל בשניהם
  }
}
```

בטקסט: `msgContext: { "text": "בדיקה חוזרת", "mediaUrl": null }`.

### מה תוקן ב-iBot ב-20.9 (ע"י המשתמש, בקובץ functions/x.js)
- `userData` (שכלל password hash, JWT, email, mobile) **הוסר** — היה דליפת אבטחה.
- `mediaUrl` נוסף.
- `webhook_token` נשלח כ-header `X-Webhook-Token` — **רק אם המשתמש יצר טוקן בעמוד ה-webhook ב-iBot.** ⚠️ **טרם אומת שה-header באמת מגיע** — לבדוק בלשונית Headers ב-webhook.site לפני שמסתמכים.
- הודעות ללא `actualObj` לא מפעילות webhook.

### מדיה — מאומת ב-curl מהמחשב של המשתמש
- `https://ibot-chat.com/media/<fileName>` → 200, `Content-Type: audio/ogg`, Ogg/Opus mono 48kHz, 5.8KB ל-5 שניות, 0.24 שנ׳. nginx + Express, `Access-Control-Allow-Origin: *`.
- **ציבורי לחלוטין, ללא אימות. נמחק אחרי 30 יום** (סטיקרים אחרי 24 שעות). לכן: למשוך מיד אחרי ה-200, להעלות ל-Blob/R2, לא לשמור את ה-URL לטווח ארוך.

### עדיין חסר ב-iBot (לא חוסם דמו, חוסם production)
- endpoint סטטוס instance / webhook על ניתוק (PRODUCT.md §5.5). בינתיים: Vercel Cron כל 5 דק׳ + התראה כש-`send-text` מחזיר `Instance not connected`.

### כללי שליחה
- לא במקביל — תור יוצא, הודעה אחת בכל פעם, 300–500ms ריווח, retry ×3.
- `msg`/`caption` ב-URL encoding. `docurl` חייב להיות ציבורי.
- `token` ו-`instance_id` רק בשרת.

## סינון הודעות נכנסות (לזרוק בשקט עם 200)
`group === true` · `msgFromMe === true` · `route !== "incoming"` · `msgId` שכבר נראה · `type` לא נתמך (סטיקר, מיקום, איש קשר) — לזה כן לענות "אני מבין הודעות קוליות, טקסט ותמונות".

## צינור עיבוד (זמנים צפויים)
הורדת OGG 0.5 שנ׳ → Whisper 3–8 שנ׳ → GPT structured output 2–5 שנ׳ → DB → 2× `send-text` ~1 שנ׳. **סה"כ 7–15 שניות.**

**עלות (נמדדה 24.9.2026 מול המחירון של Groq, לא הערכה):** הצעה קולית = סיווג 1,737→206 + מבנה 2,336→984 טוקנים = **5,263 טוקנים**, ועוד תמלול. ב-120b + whisper-large-v3 זה **0.83 אגורות להצעה** - 8 ₪ ל-1,000 הצעות, 83 ₪ ל-10,000. מול ההכנסה: Basic 29 ₪ ל-20 הצעות ⇒ עלות AI 17 אגורות, **0.6% מההכנסה**. (ה-7 אגורות שהופיעו כאן קודם היו תמחור OpenAI.) המשמעות: **תקרת הקצב של Groq Free לא שווה הנדסה מסביבה** - Dev tier מוחק את הבעיה בכמה שקלים לחודש, ומגבלת הניסיון נשארת החלטת מוצר ב-`quota.ts`.

## מוסכמות
- **שפה:** המשתמש כותב עברית. מסמכים, הודעות הבוט, וממשק - עברית, RTL. קוד, שמות שדות, commits - אנגלית.
- **טיפוגרפיה/UI:** אין קו מפריד ארוך (—) בטקסט של הממשק, הודעות הבוט או דוגמאות בפרומפטים - מקף רגיל (-) בלבד. אין אימוג׳ים בממשק ה-web - איקונים מ-`lucide-react`. (הודעות הבוט ב-WhatsApp כן משתמשות באימוג׳ים, לפי PRODUCT.md §6.) פונטים: Ping לכותרות, Ploni לטקסט (`public/fonts/`, כמו באתרי Quick Shop).
- **הודעות הבוט** מנוסחות מילה-במילה ב-PRODUCT.md §6 — להשתמש בהן, לא להמציא מחדש.
- **LLM מפרש כוונות** (פקודות, תשובות אונבורדינג), לא string matching. exact match רק כ-fallback.
- **מחיר שלא נאמר = 0 + `needsReview`.** לעולם לא לנחש מחיר.
- **סודות** (מפתחות API, iBot token) — ב-`app_settings` מוצפנים AES-256-GCM, env כ-fallback. לא בלוגים, לא ללקוח.
- כשפרטי הפיילוד של iBot חשובים — לאמת מול capture אמיתי, לא מול דף ה-docs (שהוא שליחה בלבד).
- **Next.js 16:** `params`/`searchParams` הם Promise; `proxy.ts` במקום middleware; `after()` מ-`next/server`. הדוקומנטציה ב-`node_modules/next/dist/docs/`.
- **קובץ `"use server"` מייצא רק פונקציות async.** סכמות Zod וקבועים - ב-`schema.ts` לצד ה-`actions.ts` (ייצוא של אובייקט מפיל את כל ה-actions בקובץ ב-500, וזה נראה כמו "שמירה לא עובדת"). `export type` מותר.
- **`sql\`\`` של Drizzle לא מכשיר שמות עמודות בתת-שאילתה** - `${quotes.userId} = ${users.id}` הופך ל-`"user_id" = "id"`. בתת-שאילתות מתואמות לכתוב SQL גולמי עם aliases.
- לפני סיום: `npm run typecheck && npx eslint . && npm test`. לבדיקת זרימה מלאה: README → "בדיקה מקומית".

## מפת הקוד (`src/`)

| נתיב | תפקיד |
|---|---|
| `lib/db/schema.ts` | סכמה Drizzle = PRODUCT.md §9 (+ `users.blocked`, `inbound_messages.attempts`, `processing_runs.kind/total_ms`). מיגרציות ב-`drizzle/` |
| `lib/db/index.ts` | `db` — Neon HTTP בפרודקשן, `pg` כשה-host הוא localhost |
| `lib/settings.ts` | `app_settings` — `getSetting/setSetting`, cache 60ש׳, env fallback, סודות `enc:` |
| `lib/crypto.ts` | AES-256-GCM לסודות; HMAC tokens - היום רק ל-cookie של האדמין (`p: a`) ולתאימות אחורה של קישורים ישנים |
| `lib/quotes/links.ts` | **קישורים קצרים (20.9.2026):** `/e/{code}`, `/s/{code}`, `/w/{code}` = קוד 6 תווים בטבלת `magic_links` (purpose, subject, expires_at). `/u/{code}` משתמש בקוד של `s`. `editLink()` משתמש שוב באותו קוד כל עוד נשארו >24 שעות. `resolveLink(code, purpose)`; קוד עם "." = טוקן HMAC ישן. cron מוחק פגי תוקף. `public_id` גם 6 תווים (היה 10) |
| `lib/whatsapp/` | `types.ts` (ממשק), `ibot.ts` (פרסר + send-*), `telegram.ts` (Bot API, כתובות `tg:<chatId>`, מדיה `tg-file:<id>` שנפתרת רק בזמן הורדה), `index.ts` (`gatewayFor(address)` בוחר ערוץ; תור סדרתי 400ms, retry ×3, לוג `outbound_messages`, פיצול >3900 תווים) |
| `lib/ai/` | `types.ts` (Zod schemas), `prompts.ts` (4 system prompts), `openai.ts` (Whisper + `chat.completions.parse`; משמש גם Groq/custom דרך baseURL), `index.ts` (factory מהגדרות) |
| `lib/quotes/contacts.ts` · `contacts-store.ts` | **ספר הלקוחות (24.9.2026)** - אותו דפוס של קטלוג המחירים: `contactKey` ממזג איות אחד של אדם ולעולם לא שני אנשים, `findPhoneFor` מחזיר null ולא ניחוש. נלמד מכל הצעה עם שם, והטלפון ממלא את עצמו בהצעה הבאה לאותו לקוח (`phoneFromContacts` → `cmd.phoneRemembered`). נערך ב-`/s` |
| `lib/conversation/activation.ts` | **תזכורת הפעלה (25.9.2026)** - מי שסיים אונבורדינג ואף פעם לא כתב הצעה. שעה אחרי `last_active_at` הודעה ראשונה, יממה אחרי השנייה, ואין שלישית (`activation_nudges` ב-`users`, אינדקס חלקי `users_activation_idx` עם `< 2` - להעלות את הקבוע בלי האינדקס = להפיל את הסריקה). שעות שקט של `follow-up.ts`. הדוגמה במסר נבחרת לפי המקצוע שבשם העסק (`tradeExample` ב-`messages.ts`), כי מוביל שקורא דוגמה של חשמלאי לא לומד כלום על עצמו |
| `lib/conversation/admin-notify.ts` | התראת "נרשם חדש" ליוגב ולמריה. נמענים ב-`app_settings["admin.notify"]` (מופרד בפסיק, מקבל גם `tg:<chatId>`), עריכה ב-`/admin → iBot`. כישלון נבלע - לדעת על נרשם לא שווה לאבד את התשובה |
| `lib/quotes/` | `calc.ts` (מע״מ, עיגול), `service.ts` (CRUD, טיוטה פעילה, snapshot), `links.ts`, `customer-actions.ts` (צפייה/אישור/דחייה/שאלה + התראות), `template-spec.ts` (טיפוס תבנית, pure), `templates.ts` (DB: `getTemplateForUser`), `sample.ts` (הצעת הדוגמה), `price-book.ts` (**קטלוג מחירים - pure**: `priceKey`, `applyPriceBook`, `catalogNames`), `price-book-store.ts` (DB: `loadPriceBook`, `learnFromItems`), `customer-message.ts` (ההודעה ללקוח - pure, כדי שמסך העריכה יבנה אותה מחדש חי), `follow-up.ts` (תזכורות על הצעות שנתקעו) |
| `lib/phone.ts` | `normalizePhone` / `formatPhone` / `isMobile` / `waLink` - מקור אמת אחד למספרים. `formatPhone` מיוצא מחדש מ-`quote-layouts/shared` לתאימות |
| `lib/billing/plans.ts` | `PLAN_OFFERS` - **מקור האמת לתמחור**. דף הנחיתה, `/u`, הודעות המכסה והתוכניות שנרשמו בהאב קוראים ממנו. מזהה התוכנית = `plan_code` בהאב |
| `lib/billing/hub.ts` | קליינט ל-Billing Hub: Bearer + HMAC על `${timestamp}.${body}` + idempotency. **שני סודות נפרדים** - `api_secret` חותם את מה שאנחנו שולחים, `endpoint_secret` מאמת את מה שמגיע |
| `lib/billing/subscription.ts` | מה שאירועי ההאב אומרים על המכסה: `completeCheckout`, `markPastDue`, `clearPastDue`, `downgradeToTrial`. הכול בטוח להרצה כפולה |
| `app/u/[token]` | בחירת חבילה → אימייל + ח.פ. + צ׳קבוקס הסכמה → דף סליקה מתארח. `done/` = דף החזרה. **לא משנה תוכנית** - רק ה-webhook עושה את זה |
| `app/api/webhooks/billing` | אירועי ההאב. מאמת חתימה, תופס את ה-delivery id (אידמפוטנטיות), ומחזיר 500 בכישלון אמיתי כדי שההאב ינסה שוב |
| `lib/og-bidi.ts` | `toVisual` - סידור לוגי→ויזואלי ל-OG image. **Satori לא מיישם bidi** ומהפך עברית; מאומת מול הרנדרר האמיתי, לא מהדוקומנטציה |
| `lib/conversation/` | `handler.ts` (מכונת המצבים §6 — `handleInbound`), `messages.ts` (כל הודעות הבוט מילה-במילה), `quota.ts` (§11) |
| `app/api/webhooks/ibot` | הקליטה. `app/api/cron/tick` — תקועים + פקיעה |
| `app/q/[publicId]` · `app/e/[token]` · `app/s/[token]` | דף לקוח · עריכה · הגדרות (server actions ב-`actions.ts` לצד כל דף) |
| `app/q/[publicId]/opengraph-image.tsx` | כרטיס התצוגה המקדימה ב-WhatsApp: לוגו + שם העסק + סכום. פונטים מסובסתים ב-`src/assets/og/` (13KB; ImageResponse מוגבל ל-500KB ומקבל רק ttf/otf/woff) |
| `app/w/[code]` | שליחה בלחיצה אחת: redirect ל-`wa.me` עם הצ׳אט של הלקוח וההודעה מוכנה. ההודעה נבנית מחדש בכל לחיצה, ומסמן `sent` |
| `app/r/[code]` | **תשובה לשאלת הלקוח בלחיצה אחת** (24.9.2026): redirect ל-`wa.me` עם הצ׳אט של הלקוח והטיוטה `*בקשר לשאלתך:* "…"` + שורה ריקה לתשובה. השאלה נשלפת מ-`quote_events` בכל לחיצה (שאלה שנייה מצוטטת נכון באותו קוד). redirect ולא `wa.me` גולמי - אותו נימוק כמו `/w`: השאלה בתוך ה-URL מפוצצת את בועת הצ׳אט |
| `lib/pro-device.ts` | **cookie `qo_pro`** - טוקן HMAC עם ה-`userId`, נשתל ב-`/w` וב-`/r` ובטעינת מסך העריכה (`claimDeviceAction`). `/q` בודק אותו ולא רושם צפייה כשזה הדפדפן של בעל המקצוע |
| `app/u/[token]` | מסך השדרוג. `app/admin/(dashboard)/billing` - קישורי הסליקה + מי בכל חבילה |
| `components/signature-pad.tsx` | חתימה עם עובי דיו לפי מהירות/לחץ, undo, שמירת נקודות (לא פיקסלים) כדי לצייר מחדש אחרי סיבוב מסך |
| `components/how-it-works.tsx` | **"איך זה עובד" בדף הבית - סרט מונע גלילה** (24.9.2026). במה sticky אחת, שלוש מערכות: הקלטה + תמלול אות-אחרי-אות, המשפט מתפרק להצעה מתומחרת (הביטוי שממנו נולדה כל שורה נדלק ב-recap), הלקוח מאשר וחותם. תנועה רציפה = CSS custom properties שלולאת rAF כותבת על `.hiw-track` (React לא מרנדר מחדש); אבני דרך בדידות (איזו אות, איזו שורה, איזו מערכה) = state. ברירות המחדל של המשתנים הן המצב **הסופי**, ולכן SSR/בלי JS/reduced-motion מציגים storyboard אנכי מלא. ה-CSS ב-`globals.css` תחת `.hiw-*` |
| `app/admin/(dashboard)` | סופר-אדמין; `login/` מחוץ ל-route group. `lib/admin/auth.ts` — cookie `qo_admin` |
| `components/quote-document.tsx` | רינדור ההצעה - משותף לדף לקוח, תצוגה מקדימה ואדמין. בוחר layout לפי `q.template` |
| `components/quote-layouts/` | `shared.tsx` (QuoteView + אבני בניין), `classic.tsx`, `modern.tsx`, `minimal.tsx`. `template-thumb.tsx` = תמונה ממוזערת (scale) |
| `app/admin/(dashboard)/templates` | CRUD תבניות (`quote_templates`: layout + צבע + טקסט תחתית + פעילה/ברירת מחדל + `min_plan`) עם preview חי. המשתמש בוחר ב-`/s` או בצ'אט ("עיצוב" / "תבנית מודרני" - פקודת `template`, `templateName` ב-IntentSchema); `users.template_id` null = ברירת מחדל. תבנית מעל התוכנית = 🔒. ה-snapshot באישור מקפיא גם את התבנית |
| `tests/` | `pure.test.ts` (ללא DB - כולל טלפונים, קטלוג מחירים, ההודעה ללקוח, קצב התזכורות, חבילות, bidi), `mock-server.mjs` (התעבורה) + `mock-llm.js` (התשובות המוכנות, CJS כדי ששני הצדדים יוכלו לייבא), `seed-local.ts`, `send.sh`, `sent.py`, `approve-flow.ts` |
| | ⚠️ **המוק חייב להחזיר את כל שדות הסכימה, כולל null.** כל קריאה אמיתית עוברת דרך `zodResponseFormat` שמסמן כל שדה כ-`required`, ולכן ספק אמיתי לעולם לא מחזיר תת-קבוצה. `templateName` שרד במוק את השינוי ל-`designName`, ו-`reference`/`customerName` נוספו ל-`IntentSchema` בלעדיו - כך שכל הצעה בזרימה המקומית מתה ב-ZodError שנראה כמו באג במוצר. יש על זה טסט ב-`pure.test.ts` שמריץ את המוק עם הפרומפטים **האמיתיים** |

## החלטות שנלקחו תוך כדי בנייה (20.9.2026)

- **iBot API base = `https://ibot-chat.com/api/v1/`** (לא השורש). פרמטר תמונה `imageurl`, מסמך `docurl`. מאומת מדף ה-docs.
- ברירות מחדל בקוד: תמלול `gpt-4o-transcribe`, LLM `gpt-5.4-mini` (`chat.completions.parse` + `zodResponseFormat`). ניתנים לשינוי ב-`/admin`.
- **Groq מאומת (20.9.2026):** המשתמש פתח חשבון Free ב-console.groq.com. `whisper-large-v3` ו-`whisper-large-v3-turbo` תמללו עברית סינתטית (Carmit) מושלם ב-0.3–0.8 שנ׳; `openai/gpt-oss-120b` החזיר JSON נכון ב-2 שנ׳. **אין ב-Groq מודלי Llama 3.x יותר** - הרשימה: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `groq/compound`, `qwen/qwen3.8-27b`. `app_settings` ב-Neon מכוונים ל-groq בשני השלבים **והמפתח שמור שם מוצפן** (הוצפן עם ה-`SETTINGS_ENCRYPTION_KEY` מ-`.env.local` - חייב להיות זהה ב-Vercel, אחרת הפענוח נכשל בשקט ונופלים ל-env `GROQ_API_KEY`). `tests/groq-live.ts <wav>` = בדיקה חיה, `tests/groq-eval.ts` = 15 מקרי eval (5 תמלולים מבולגנים + 10 סיווגים), כולם עוברים.
- **מגבלת Free tier ב-Groq: 8,000 tokens/דקה לכל מודל צ׳אט** (נמדד מה-headers). פרומפט המבנה ≈ 2,200 in + ~700 out ⇒ ~2 הצעות/דקה לכל המשתמשים יחד. מספיק לבדיקות ולדמו קטן; **לפרודקשן צריך Dev tier** (pay-as-you-go, אגורות) - או OpenAI ל-LLM. Whisper: 7,200 שניות אודיו/שעה, לא מגבלה בפועל. הפרומפט נדחס בכוונה בגלל זה - לא להאריך אותו בלי לבדוק tokens.
- **הבנת עברית:** `prompts.ts` כולל כללי תמלול-מדובר (מספרים כמילים, "שח", "מעם", "מקדימה", תיקון עצמי), אוצר מילים לפי מקצוע ל-Whisper (`TRADE_VOCAB`, לפי שם העסק), דוגמאות few-shot, ו-intent `greeting` ("היי"/"תודה" → תשובה ידידותית, לא "לא זיהיתי פריטים"). ברכות נפוצות נתפסות ב-exact match לפני ה-LLM.
- Groq / custom = אותו אדפטר OpenAI עם `baseURL`. Anthropic/Gemini עדיין לא ממומשים (`getLLMProvider` זורק).
- `vatIncluded=true` → המחירים שהוזנו כוללים מע״מ ומחלצים אותו (`net = total/1.18`).
- טיוטה פעילה = ההצעה **האחרונה** של המשתמש, `draft`, `updated_at` < 30 דק׳. "חדש" מזיז את `updated_at` אחורה ב-31 דק׳.
- מסך העריכה: auto-save 800ms, נעול אחרי approved/rejected. NumberInput שומר טקסט מקומי (מאפשר להקליד "1500").
- `/q` רושם צפייה ב-`after()` (לא חוסם); צפייה ראשונה → `viewed` + התראה; דדופ שעה. **שלושה מסננים לפני שזה נחשב לקוח** (24.9.2026): קראולר (`lib/bots.ts`), הדפדפן של בעל המקצוע (cookie `qo_pro`), ו**הצעה שטרם נשלחה** - `draft` בלי `sent_at` לא יכולה להיפתח ע"י הלקוח, כי הקישור עוד לא יצא מהצ׳אט של בעל המקצוע. בלי המסנן השלישי, לחיצה שלו על הקישור בהודעה להעברה סימנה "הלקוח צפה" לפני השליחה, **וגם הרגה את הטיוטה הפעילה** (כבר לא `draft` ⇒ "תשנה ביקור ל-250" לא מצא מה לתקן). מי שמעביר ידנית בלי `/w` - "שלחתי" פותח את חלון הצפיות.
- **יחידות בעמודת הכמות** (`qtyLabel` ב-`calc.ts`): "קומפלט" ו"יח׳" לא מודדות כלום ולכן לא מודפסות ("1 קומפלט" נראה כמו באג); מ״ר / מ״א / שעה / יום / נקודה כן - שם היחידה היא מה שהמחיר לפיו.
- **אורך מזהים = 6 תווים** (בקשת המשתמש: קישורים קצרים ונעימים בהודעות). אלפבית 55 תווים בלי דומים ⇒ 2.8×10¹⁰ צירופים. אין rate limit על `/q` ו-`/e` כרגע - אם יהיה חשש לניחוש, להוסיף לפני שמקצרים עוד.
- מקומית `waitUntil` הוא no-op — ה-Promise רץ ממילא. בפרודקשן חובה `maxDuration=60` על ה-route (קיים).
- ~~אין OPENAI_API_KEY בסביבת המשתמש~~ — **כבר לא נכון (25.9.2026):** `.env.local` מחזיק גם `OPENAI_API_KEY` וגם `GROQ_API_KEY`, והמפתחות גם מוזנים ב-`app_settings` מוצפנים (`ai.key_openai` 266 תווים, `ai.key_groq` 122 תווים). `llm.api_key`/`transcription.api_key` ריקים בכוונה (§"מצב הספקים").
- **דף הבית = דף נחיתה** עם CTA ל-`wa.me/<bot.phone>?text=היי`. המספר ב-`app_settings["bot.phone"]` (עריכה ב-`/admin → iBot`). **המספר הרשמי של QuickOffer: 053-370-7533 = `972533707533`** (24.9.2026, החליף את המספר הזמני של Quick Shop). מקור אמת אחד - הוא מזין את ה-CTA, את השבב בהירו, את הפוטר ואת קישור השדרוג הידני ב-`/u`.

## סבב "מספר אחד בתחום" (22.9.2026)

חמישה פערים שסגרנו, לפי סדר החשיבות שנקבע בסקירה:

1. **שליחה בלחיצה אחת.** `customerPhone` חולץ ע"י ה-LLM ונשמר בסכימה מההתחלה, ואף אחד לא השתמש בו. עכשיו: `/w/{code}` → redirect ל-`wa.me/<לקוח>?text=<ההודעה>`. הקישור **קצר** (redirect, לא URL באורך 300 תווים בבועת צ׳אט) וההודעה **נבנית מחדש בכל לחיצה**, כך שתיקון אחרי שליחת הקישור עדיין שולח את הגרסה המתוקנת. ההודעה יוצאת מהמספר של בעל המקצוע - §15 החלטה 7 נשמרת. בלי מספר: רמז ה-Forward + בקשה למספר. הלחיצה מסמנת `sent`.
2. **קטלוג מחירים (`price_book`).** היה "שלב 2" ב-PRODUCT.md §12; זו ההגנה היחידה של המוצר. נלמד פסיבית מהצעות שנוצרו ומכל שמירה במסך העריכה (מחיר שהוקלד ביד = האות החזק ביותר). מחיר שלא נאמר מתמלא **בקוד** (`applyPriceBook`, דטרמיניסטי וניתן לבדיקה), ולא ע"י ה-LLM - כי מגבלת Groq היא 8k tokens/דקה. לפרומפט נכנסים **רק התיאורים** (עד 25), כדי שהניסוח יישאר עקבי והמפתחות יתאימו. פריט שאין בקטלוג נשאר 0 + `needsReview` - **לעולם לא ניחוש**. הצ׳אט תמיד מדווח מה הושלם.
3. **תזכורות על הצעות שנתקעו** (`lib/quotes/follow-up.ts`, מה-cron). `sent`/`viewed` שלא זזו 3 ימים → הודעה לבעל המקצוע עם קישור תזכורת מוכן; תזכורת שנייה אחרי 4 ימים; **אין שלישית**. רק בין 08:00–21:00 שעון ישראל. `reminders_sent` + `last_reminder_at` הופכים את זה לאידמפוטנטי. **לעולם לא שולחים ללקוח** - רק לבעל המקצוע.
4. **כרטיס תצוגה מקדימה ב-WhatsApp** (`opengraph-image.tsx`). זה מה שהלקוח רואה **לפני** הלחיצה. ⚠️ **Satori לא מיישם bidi** - עברית יוצאת הפוכה. `lib/og-bidi.ts` מסדר לוגי→ויזואלי (רצפי ספרות נשארים במקומם). אומת מול הרנדרר האמיתי, לא מהדוקומנטציה.
5. **מסלול שדרוג.** קודם `settingsLink` שימש כ"קישור לשדרוג" והוביל לדף בלי כפתור קנייה. עכשיו `/u/{code}` (משתמש בקוד של `s`), וקישורי הסליקה לכל חבילה ב-`app_settings` דרך `/admin → תשלומים`. שדה ריק = הודעת WhatsApp למספר הבוט (המצב הידני של §11) - עדיין מסלול, לא קיר.

**קרפט:** מצב כהה מלא (ההצעה עצמה נשארת על "נייר" דרך `.doc-surface` - מסמך, והצבע של בעל המקצוע נשאר נאמן); Ploni הומר ל-woff2 (576KB → 233KB); פס החלטה דביק בדף הלקוח שנושא את הסכום (התשובה ל"כמה זה עולה" בלי לגלול); חתימה עם עובי דיו משתנה + undo; favicon/apple-icon/manifest; focus ring אחיד; הדפסה תמיד בפלטת נייר.

**לא נעשה (מכוון):** אינטגרציית סליקה אמיתית - צריכה חשבון ומפתחות של ספק. התשתית מוכנה: להדביק URL ב-`/admin → תשלומים`.

## סליקה - חיבור ל-Billing Hub (22.9.2026)

QuickOffer מחובר ל-**Quick Commerce Billing Hub** (`~/Desktop/Projeccts/quick-payments-billing`), אותה מערכת שמשרתת את QuickShop. ההאב מחזיק כרטיסים, חשבוניות, מע״מ ו-dunning; QuickOffer מחזיק רק את המכסה.

- **כתובת ההאב: `https://billing.my-quickshop.com`.** ⚠️ `quick-billing.vercel.app` הוא אפליקציית Express אחרת לגמרי שמחזירה 200 על כל נתיב - לא לבלבל. הפרויקט ב-Vercel נקרא `quickbilling`.
- **רשום כ-product `quickoffer`** (קידומת חשבונית `QO`, `default_trial_days: 0`), עם 3 תוכניות שקודיהן `basic` / `pro` / `unlimited` - **זהים למזהי התוכנית אצלנו**, כי זה מה שנשלח כ-`plan_code`. שינוי שם של אחד מהם שובר סליקה; יש על זה טסט.
- **שני סודות נפרדים** (כך זה בסכימת ההאב): `products.webhook_secret` חותם את הבקשות שאנחנו שולחים, `webhook_endpoints.secret` מאמת את האירועים שמגיעים. שמורים מוצפנים ב-`app_settings` (`billing.api_secret`, `billing.endpoint_secret`).
- **הזרימה:** `/u` אוסף אימייל (חובה לחשבונית ולהאב) + ח.פ. + הסכמה לשמירת כרטיס (דרישה רגולטורית של Grow, נשלחת כ-`accept: true`) → `POST /v1/customers` → `POST /v1/payment-methods/setup` עם `amount` = מחיר החבילה, מה שגם מחייב בפעם הראשונה → דף Grow מתארח → ההאב שולח `payment_method.created` → **רק אז** אנחנו יוצרים מנוי ומשדרגים.
- **התוכנית משתנה רק ב-webhook, אף פעם לא ב-redirect.** דף החזרה שמראה "מאשרים" ולא "שודרגת" הוא בכוונה - redirect הוא לא הוכחת תשלום.
- **כישלון חיוב לא מוריד תוכנית.** ההאב מריץ dunning (1, 3, 7 ימים), אנחנו מסמנים `billing_past_due_at` ושולחים הודעה אחת. הורדה ל-trial קורית רק ב-`subscription.cancelled`.
- **אידמפוטנטיות:** `billing_events` עם `X-Quickcommerce-Delivery-Id` כ-PK. ההאב מנסה 5 פעמים עם backoff, אז ה-handler מחזיר 500 בכישלון אמיתי (כדי שינסה שוב) ו-200 עם `duplicate` על חזרה.
- **מה אומת חי מול ההאב:** ping חתום, יצירת לקוח, יצירת דף סליקה של Grow, יצירת מנוי עם `plan_code: pro`. בצד שלנו: דחיית webhook לא חתום ובעל חתימה שגויה, אידמפוטנטיות, past-due, recovered, cancelled. נתוני הבדיקה נמחקו מההאב.
- **בלי חיבור** (`billing.api_key` ריק) כפתור השדרוג מוביל להודעת WhatsApp למספר הבוט - הפעלה ידנית, כמו קודם.

## דומיין: quickoffer.co.il — חי (24.9.2026)

**הדומיין באוויר ומחובר.** אומת 24.9: `A → 216.150.1.1`, `www → …vercel-dns-016.com`, NS = `ns1/ns2.mynames.co.il`, תעודת ZeroSSL ל-`quickoffer.co.il` בתוקף עד 22.12.2026, `/` מחזיר 200 עם האתר שלנו, `/q/<לא קיים>` מחזיר 404, `www` מפנה ב-308 ל-apex.

**הוחלף בפועל:**
- `app.url` = `https://quickoffer.co.il` (היה `https://quickoffer.vercel.app`). `appUrl()` ב-`lib/quotes/links.ts` נקרא בזמן ריצה → כל הקישורים החדשים (`/q`, `/e`, `/s`, `/w`) על הדומיין החדש **מיידית**. קישורים שכבר נשלחו ללקוחות ממשיכים לעבוד — `quickoffer.vercel.app` נשאר חי.
- webhook טלגרם נרשם מחדש על `https://quickoffer.co.il/api/webhooks/telegram` עם **סוד חדש** (רוטציה, כדי שהרישום הישן לא יוכל להמשיך למסור). 0 pending, בלי שגיאות.
- `APP_URL` בפרודקשן ב-Vercel = הדומיין החדש (היה מחרוזת ריקה — מוקש: fallback ל-`http://localhost:3000`).
- redirect `www` → apex ב-`next.config.ts` (בקוד ולא בדשבורד, כדי שישרוד יצירה מחדש של הפרויקט).
- `metadataBase` ב-`/q/[publicId]` נגזר מ-`app.url` בזמן ריצה — כרטיס התצוגה ב-WhatsApp עוקב אחרי הקישורים ולא מפגר.

**סטטוס ה-endpoints על הדומיין החדש (עודכן 25.9.2026):** `/api/webhooks/telegram` → 401 בלי סוד תקין (חי) · `/api/cron/tick` → 401 בלי secret (חי) · `/api/webhooks/ibot` → **401** בלי טוקן תקין - כלומר `ibot.webhook_token` **הוזן** וה-webhook חי (היה 503 כשהיה ריק). `ibot.token` מוזן גם הוא, ו-`ibot.instance_status=connected`.

**נותר ידנית:**
1. ~~ה-pinger החיצוני (cron-job.org)~~ — **הוחלף ב-Vercel Cron** (24.9). `vercel.json` → `/api/cron/tick` כל 5 דק׳. ה-team `itadmit-gmailcoms-projects` בתוכנית **Pro** (חשבון המשתמש עצמו hobby, אבל הבעלים הוא ה-team) ולכן תדירות של עד פעם בדקה מותרת. **אפשר לכבות את ה-pinger ב-cron-job.org.**
2. ~~טוקן iBot — טרם הוזן~~ — **הוזן (24.9.2026 14:46-14:52).** `ibot.token` + `ibot.webhook_token` מוצפנים ב-`app_settings`, `/api/webhooks/ibot` מחזיר 401 (חי), וה-instance מחובר. ⚠️ עדיין לאמת ב-webhook.site שה-`X-Webhook-Token` באמת מגיע ב-header (החלטה פתוחה §15).
3. ~~`APP_URL` ל-Preview~~ — **לא צריך.** Preview חולק את אותו `DATABASE_URL` (ולכן אותו `app_settings`), אז `app.url` מה-DB גובר ממילא וה-env הזה לעולם לא נקרא שם. ה-CLI גם מסרב להוסיף אותו ללא prompt.

## סבב הקשחה לפרודקשן וקמפיין (24.9.2026)

שבעה שינויים לפני העלייה לאוויר. אין זליגות זיכרון (כל observer/listener בקליינט מנוקה; אין צבירה ברמת המודול בשרת) ואין לוגים בנתיב החם - 17 `console.error` בלבד, כולם על כשל אמיתי.

1. **קראולר של תצוגה מקדימה אינו לקוח** (`lib/bots.ts`). כשמעבירים את `/q/{id}` ב-WhatsApp, הקראולר מושך את הדף והפעיל `recordView`: בעל המקצוע קיבל "הלקוח פתח את ההצעה" ברגע ההעברה, `first_viewed_at` נתקע שם, והתזכורת אחרי 3 ימים טענה שהלקוח יושב על זה. מוטה לכיוון "זה בוט" - צפייה אמיתית שהוחמצה עולה התראה אחת, התראת שווא עולה את האמון בכל ההתראות הבאות.
2. **429 מהספק = ניסיון חוזר, לא תקלה.** `processed_at` נשאר null וה-cron מרים את ההודעה תוך 5 דקות, חסום ע"י `attempts < 3`. המשתמש מקבל `errors.busy()` פעם אחת ("ההודעה שלך אצלי"), שתיקה בניסיונות שבאמצע, והתנצלות רק אם באמת נגמרו הניסיונות. **rate limit בתמלול חייב לברוח מה-catch של `transcribeInbound`** אחרת הוא נקרא "לא הצלחתי לשמוע".
3. **`app_settings` כבר לא נכתב בכל הודעה.** `setSetting` מדלג כשהערך לא השתנה (השוואה על הטקסט הגלוי - סוד מוצפן מחדש לבייטים אחרים) ו**מעדכן את ה-cache במקום לאפס אותו**. `touchSetting` לחותמות זמן - כתיבה פעם בדקה לכל היותר.
4. **אינדקסים חלקיים לארבע השאילתות של ה-cron** (מיגרציות 0008, 0009). ⚠️ **Postgres לא מוכיח ש-`not in (approved, rejected, expired)` גורר `in (draft, sent, viewed)` על enum** - הצורה השלילית דילגה על האינדקס לגמרי (אומת עם `enable_seqscan=off`). לכן `OPEN_QUOTE_STATUSES` נגזר מה-enum ויש עליו טסט: הוספת סטטוס חדש מפילה את הטסט לפני שה-cron חוזר בשקט לסריקה מלאה.
5. **Retention של 90 יום** (`lib/retention.ts`) ל-`inbound_messages`, `outbound_messages`, `processing_runs` - באצוות מוגבלות מה-cron. הצעות, פריטים ואירועים לא נוגעים. `processing_runs.transcript` הוא גם תיאור של בית הלקוח, לא משהו לשמור לנצח בהיסח הדעת.
6. **דף הנחיתה הוא ISR** (`revalidate = 300`), לא `force-dynamic` - הוא לא קרא שום דבר שתלוי במבקר. כל קליק ממומן היה invocation + שאילתה. שינוי מספר הבוט ב-`/admin` נכנס תוך 5 דקות. דף הסקירה באדמין מוגבל ל-30 יום (היה `sum` ו-`percentile_cont` על כל הטבלה בכל טעינה).
7. **התור היוצא** (`lib/whatsapp/queue.ts`) מפריד סדר מקצב: **סדר לפי נמען** (נכונות, תמיד דלוק) מול **קצב גלובלי** (החלטת סיכון). ברירות המחדל `maxConcurrent: 1, gapMs: 400` **משחזרות בדיוק את ההתנהגות הקודמת** - העלאת `maxConcurrent` ל-2/3 היא מה שמסיר את ההמתנה בין נמענים שונים על instance חם, וזו החלטה של בעל חשבון ה-WhatsApp. יש טסטים (`tests/queue.test.ts`) על סדר, ריווח, תקרה, בידוד כשלים, ושאין דליפת lanes.

### טיפול במגבלת קצב (429)

**`maxRetries: 0` ב-SDK בכוונה.** ה-SDK מכבד `retry-after` עד 60 שניות, אז 429 מ-Groq עם `retry-after: 30` גרם לו לישון 30 שניות, לנסות, ולישון שוב - מעבר ל-`maxDuration` של הראוט. הפונקציה נהרגת באמצע וההמתנה לא קונה כלום. `withRetry` ב-`openai.ts` מחליף אותו ומודע לתקציב: מילוי קצר מ-20 שניות מחכים לו במקום, ארוך מזה נזרק מיד ו-`handleInbound` מעביר ל-cron. ⚠️ `Number(null) === 0` - חובה לפסול header חסר לפני הפרסור, אחרת 429 בלי `retry-after-ms` נקרא "נסה מיד".

אומת חי: 8 קריאות מקבילות מול באקט של 8k/דקה ⇒ 5 חזרו (חלקן אחרי המתנה), 3 נפלו ל-cron. זו החלוקה המתוכננת.

### פיצול מודלים (`llm.classify_model`, כבוי כברירת מחדל)

**באקטי הקצב של Groq הם לכל מודל בנפרד** - אומת: שתי קריאות ל-120b הורידו אותו מ-6727 ל-5541 בזמן ש-20b עמד על 6727 טרי. פיצול הסיווג למודל אחר מכפיל את התקרה היומית, כי שלב המבנה מפסיק לחלוק מכסה עם הסיווג.

**eval (24.9.2026, 16 מקרי הסיווג מ-`groq-eval.ts`):** `gpt-oss-20b` = `gpt-oss-120b` בדיוק - 15/16 שניהם, אותו כשל יחיד (`"התקנת מזגן לדני כהן"` → new_quote במקום job_use, כשל קיים בשני המודלים) - ו-20b מהיר ב-28% (817ms מול 1133ms).

שדה ריק = מודל אחד לשני השלבים, כמו היום. זה **ביטוח** למקרה שהקמפיין ייצא לפני שה-Dev tier מחובר, לא ברירת מחדל חדשה. ⚠️ כשמפצלים, החוסם הוא שלב המבנה לבדו (3,320 טוקנים) - `processing_runs` סוכם את שני השלבים לשורה אחת ולא יודע להפריד, ולכן הכרטיס עובר לקבוע `STRUCTURE_TOKENS_PER_QUOTE`.

**אין caching אצל Groq שמוריד מהמכסה** - נבדק: שלוש קריאות עם אותו system prompt צרכו כל אחת 2,200 טוקנים מלאים (5722→3520→1294), ו-`cached_tokens` לא מדווח בכלל.

### OpenAI מול Groq - נמדד מול שני החשבונות (24.9.2026)

החשבון ב-**OpenAI Tier 1** ($10 קרדיט, auto-reload כבוי). מגבלות שנקראו מהכותרות, לא מהדוקס:

| מודל | RPM | TPM | הצעות/דקה |
|---|---|---|---|
| `gpt-4o-mini` | 10,000 | 200,000 | **50** |
| `gpt-5-mini` | 500 | 500,000 | 126 |
| Groq Free `gpt-oss-120b` | 30 | 8,000 | 1.5 |

**`gpt-4o-mini` יצא זול ומהיר יותר מ-Groq, וזהה באיכות:**
- **3,963 טוקנים להצעה** מול 5,263 ב-Groq. הסיבה: מודלי `gpt-oss` פולטים טוקני reasoning - פלט המבנה הוא 119 טוקנים מול 984.
- **eval מלא: 20/21**, בדיוק כמו Groq, כולל אותו כשל יחיד (`"התקנת מזגן לדני כהן"` → new_quote).
- `tests/groq-eval.ts` מקבל עכשיו `EVAL_PROVIDER` / `EVAL_MODEL` / `PACE_MS`, כך שאותם מקרים מכריעים החלפת ספק.

**הקונפיגורציה הזולה ביותר: תמלול ב-Groq + LLM ב-OpenAI** = **0.59 אגורות להצעה** (מול 0.83 בהכל-Groq). $10 מספיקים ל-**15,143 הצעות**. התמלול נשאר ב-Groq כי הוא חינם ועברית שלו מאומתת; המגבלה שנשארת היא **2,000 תמלולים ליום** בחינמי.

⚠️ `insufficient_quota` מוחזר עם status 429, כמו rate limit, וצריך טיפול הפוך - ראה `isOutOfCredit`. עם auto-reload כבוי זה הסוף הוודאי של יתרה משולמת מראש. יש נורה על זה בסקירה באדמין.

### מצב הספקים בפרודקשן (הוחלף 24.9.2026)

`app_settings` ב-Neon: **`llm.provider=openai`, `llm.model=gpt-4o-mini`; `transcription.provider=groq`, `transcription.model=whisper-large-v3-turbo`.** אומת קצה-לקצה דרך ההגדרות עצמן. הנימוק: OpenAI Tier 1 נותן 200,000 TPM מול 8,000, האיכות זהה (20/21), והעלות נמוכה יותר כי אין טוקני reasoning. התמלול נשאר ב-Groq כי הוא חינם ועברית שלו מאומתת.

**מפתחות לפי ספק, לא לפי שלב.** `ai.key_openai` / `ai.key_groq` הם מה ששני השלבים נופלים אליהם (`resolveKey` ב-`lib/ai/index.ts`: מפתח-שלב ← מפתח-ספק ← env). ⚠️ **`transcription.api_key` ו-`llm.api_key` ריקים בכוונה** - מפתח שמור ברמת השלב **גובר** על מפתח הספק, ולכן מפתח ישן שנשאר שם היה שולח לספק החדש את הקרדנשיאלס הלא נכונים. בלי זה כפתור ההחלפה שובר את התמלול.

**כפתור החלפת מנוע תמלול** ב-`/admin → ספקי AI`, עם ניצול יומי מול התקרה (נקרא מ-`processing_runs`, חינם). `TRANSCRIPTION_CHOICES` ב-`lib/ai/transcription-choices.ts` - ⚠️ **קובץ טהור בלי imports בכוונה**, כי הכרטיס הוא `"use client"` וייבוא ערך מ-`limits.ts` גורר את `settings → db → pg` לבאנדל של הדפדפן ומפיל את הבילד על `dns`/`fs`.

**Groq turbo = 0.082 אגורות להקלטה של 20 שניות ו-267ms; whisper-1 = 0.74 ו-1,867ms.** פי 9 במחיר, פי 7 במהירות, תמורת תקרה של 2,000 ליום. מתחת ל-1,500 ביום Groq פשוט עדיף.

**למה `whisper-1` ולא `gpt-4o-mini-transcribe`** (חצי מחיר, פי 20 RPM): בהשוואה מקצה-לקצה על 5 דגימות Carmit + ההקלטה האמיתית מה-Blob, `gpt-4o-mini-transcribe` שמע `"אצל אבי בהרצליה"` כ-**`"אביב"`** - טעות בשם הלקוח, שהוא השדה שמופיע על המסמך שהלקוח רואה. `whisper-1` היה מדויק בשני המקרים והיחיד שתפס `ש״ח` (Groq החזיר `ש״ק`). כולם קלעו 5/6 בהצעה הסופית; ההבדל הוא באיזה שדה הם טועים.

⚠️ **`DATABASE_URL` ב-`.env.local` מצביע על Neon בפרודקשן, לא על מסד מקומי.** כל סקריפט שרץ מכאן נוגע בנתונים האמיתיים - מיגרציות, `setSetting`, ומחיקות. לוודא לפני שמריצים משהו הרסני.

### אורך הקלטה - נמדד, לא מוערך

⚠️ **`estimateAudioSeconds` (bytes/1200) טעה פי 2 ויותר.** Opus הוא VBR; הקבוע כויל פעם אחת מהקלטת WhatsApp. הקלטה אמיתית של 10.3 שניות נמדדה כ-20.7, ו-WAV נמדד פי 18. זה גרם לשני דברים: **הסף של 3 דקות פסל בפועל ב-~90 שניות** בזמן שהבוט הבטיח 3 דקות, וכל דיווחי עלות התמלול היו כפולים.

`lib/audio.ts` קורא את המשך האמיתי מה-**granule position** של העמוד האחרון ב-Ogg (ספירת דגימות ב-48kHz), ומ-`byteRate` ב-WAV. ⚠️ `byteRate` יושב ב-`+16` בצ׳אנק `fmt `, לא ב-`+12` (שם יושב `sampleRate`) - טסט תפס את זה אחרי שכתבתי את זה לא נכון.

**אומת מול החיוב בפועל של Groq** (הפרש `x-ratelimit-remaining-audio-seconds` בין שתי בקשות רצופות - `limit - remaining` הוא צריכה מצטברת בחלון ולא של בקשה בודדת): 10.3→10, 7.7→7, 5.5→5. Groq מעגל כלפי מטה.

**המגבלה מוצהרת ולא מתגלה:** `MAX_AUDIO_MINUTES` ב-`messages.ts` מופיע בהודעת הסיום של האונבורדינג, ו-`errors.tooLong` אומר כמה ההקלטה ארכה וכמה מותר.

### חשבון הניסיונות החוזרים

**`attempts` ו-RETRY_WINDOW הם שני תקציבים נפרדים.** `attempts` (3) הוא לכשלים אמיתיים; **מגבלת קצב מחזירה את הניסיון** (`greatest(attempts - 1, 0)` ב-handler) כי היא לא אשמת ההודעה. מה שחוסם את הלולאה הוא **זמן** - `RETRY_WINDOW_MS` = שעתיים, ואחריו ה-cron מסמן `abandoned` ומפסיק.

הסיבה: ה-cron מנקז 5 לטיק = 60/שעה, ובתקרה היומית הישנה של Groq המילוי היה 83/שעה. הודעות היו ממצות 3 ניסיונות ונכשלות **בזמן שהייתה מכסה פנויה אצל הספק**. "יש עומס רגעי" נשלח פעם אחת בלבד - לפי `error` הקודם, לא לפי מונה.

### מכסת AI בסופר-אדמין
`/admin → ספקי AI` מציג מה נשאר, מכותרות `x-ratelimit-*` (`lib/ai/limits.ts`). **לא קיים API ליתרה כספית ב-Groq או ב-OpenAI**, ובתוכנית החינמית אין יתרה בכלל - יש תקרות. נמדד חי 24.9.2026: LLM 1,000 בקשות/יום + **8,000 טוקנים/דקה**, תמלול 2,000 בקשות/יום. הצעה = תמלול + 2 קריאות LLM ≈ 2,900 טוקנים ⇒ 499 הצעות ליום אבל **2.7 בדקה לכל המשתמשים יחד**. המכסות מתמלאות בזליגה (86.4 שניות לבקשה), לא באיפוס בשעה קבועה. הבדיקה בלחיצה כי היא עולה בקשה אחת מכל מכסה; הצריכה היומית מגיעה מ-`processing_runs` וחינמית.

⚠️ **2.7 הצעות בדקה הוא הקיר של הקמפיין.** הקוד כבר לא שובר את המשתמש כשזה קורה (סעיף 2), אבל התור מתארך. Groq Dev tier או OpenAI ל-LLM לפני תנועה ממומנת רצינית.

## מעקב פאנל Meta - Pixel + CAPI (25.9.2026)

מדידת הפאנל של הקמפיין מקצה לקצה, בגלל שהבעיה שנצפתה היא "מודעות מביאות נרשמים אבל אף אחד לא כותב הצעה ראשונה" - צריך לראות איפה בפאנל זה נשבר.

- **Client pixel** (`components/meta-pixel.tsx`) - **רק בדף הנחיתה**, לא בדפי ההצעה (הם שייכים ללקוחות של בעל המקצוע, לא הגיעו מהמודעות שלנו). מאזין פעם אחת לקליקים על קישורי `wa.me`/`t.me`/`api.whatsapp.com` ומדווח `Contact`. מחכה עד 2 שניות ל-`fbq` (next/script afterInteractive עלול לאחר, וה-CTA הדביק במובייל הוא הקליק המהיר ביותר).
- **Server CAPI** (`lib/meta/capi.ts`) - האירועים שה-pixel לא רואה כי הם קורים מחוץ לאתר (בצ׳אט ובשדרוג): `Lead` (התחיל לדבר עם הבוט, `handler.ts:100`), `CompleteRegistration` (סיים אונבורדינג, `handler.ts:241/317/332`), `Subscribe` (השלים סליקה עם `value`+`plan`, `subscription.ts:64`).
- **התאמה:** phone מוצפן SHA-256 ל-WhatsApp (WhatsApp נותן אותו בחינם), `external_id` = hash של `user.id` לטלגרם (אין טלפון). `event_id` יציב לכל משתמש+אירוע ⇒ retry של webhook לא נספר פעמיים. `action_source: "chat"`.
- **מעולם לא עולה הודעה:** כל כשל נבלע (timeout 4 שניות, `console.error` בלבד). מעקב לא שווה תשובה שלא יצאה.
- **הגדרות:** `meta.pixel_id` (=`1071647615854904`), `meta.capi_token`, אופציונלי `meta.test_event_code`. עריכה ב-`/admin/meta`. אם אחד מהם ריק - CAPI לא שולח (fail-open).

## מה הלאה (לפי סדר)
1. ~~**חיבור אמיתי**~~ — **הושלם (25.9.2026).** Neon + Vercel + מפתחות ב-`app_settings` + iBot token + webhook - הכול חי, 12 מיגרציות רצו (כולל 0005 price_book), ותנועה אמיתית מגיעה (68 הודעות נכנסות, 7 משתמשים). נותר רק לאמת ב-webhook.site שה-`X-Webhook-Token` באמת מגיע ב-header.
2. eval של 20–30 הקלטות אמיתיות (PRODUCT.md §7.5) — לבחור מנוע תמלול, לכוונן `STRUCTURE_RULES`. **עכשיו יש חומר גלם אמיתי:** ההקלטות ב-`inbound_messages`/`processing_runs` בפרודקשן (עד retention של 90 יום).
3. Vercel Blob (`BLOB_READ_WRITE_TOKEN`) — בלעדיו לוגו/חתימה/אודיו לא נשמרים (הקוד מחזיר null ולא נופל).
4. סליקה אמיתית: חשבון Grow/PayPlus → URL לכל חבילה ב-`/admin → תשלומים`.
5. תמונת ההצעה בצ׳אט (`send-image`) - בעל המקצוע עדיין לא רואה את המסמך שלו. PDF (§8.3).

## סבב תיקוני שיחה (24.9.2026, מתוך לוג אמיתי)

ארבעה כשלים שנצפו בשיחה אחת של המשתמש, כולם בסיווג ולא במכניקה:

1. **`"הטלפון של מריה 0542284283"` סווג `unclear`.** הבוט עצמו מכתיב את הניסוח הזה ב-`sendHint`, ואז לא הבין אותו - `applyCorrection` כבר ידע לקלוט מספר ולהחזיר קישור שליחה, אף אחד לא הגיע לשם. הפרומפט אומר עכשיו במפורש שמסירת פרט על הלקוח היא `correction`.
2. **`"תקן"` סווג `unclear` → לולאה אינסופית.** `unclearCorrectionOrNew` מבקש לכתוב "תקן", ו"תקן" לא היה באוצר המילים. נוספה פקודה `correct` שמחזירה "מה לתקן?" עם דוגמאות וקישור עריכה - תשובה שמקדמת, במקום לחזור על השאלה.
3. **`"שלח למריה את ההצעה הקודמת"` סווג `mark_sent`.** "שלח" ישב ברשימת `mark_sent` לצד "שלחתי". נוספה `send_to` (ציווי) והופרדה מ-`mark_sent` (עבר). בקשה לשלוח נענתה ב"סומנה כנשלחה" ואז שום דבר לא נשלח.
4. **הקופי מכר רק הקלטה.** כל הודעות הפתיחה אמרו "אפשר לשלוח הודעה קולית" בזמן שהמשתמש הקליד כל הזמן והכל עבד. עודכן לשקף את שתי הדרכים.

⚠️ **המודל סותר את עצמו לפעמים** - `"כמו ההצעה של דני אבל לשרון"` חזר עם `intent=new_quote` ו-`command=repeat`, והקוד זרק את ה-command בשקט. יש עכשיו guard ב-`handleReady`: פקודה נושאת-`reference` (`repeat`/`job_use`) בהודעה בלי מחירים גוברת על ה-intent. לא לסמוך על כך שה-LLM יהיה עקבי עם עצמו.

**eval: 22/23** (`EVAL_PROVIDER=openai EVAL_MODEL=gpt-4o-mini npx tsx tests/groq-eval.ts`). שבעת המקרים מהלוג נוספו לקובץ. הכשל היחיד שנותר הוא `"התקנת מזגן לדני כהן"` → new_quote במקום job_use, הכשל הידוע שקיים בכל המודלים שנבדקו.

## החלטות פתוחות (PRODUCT.md §15)
- דומיין קצר לקישורים (טרם נבחר; בדוגמאות `qv.app`)
- בחירת מנוע תמלול סופית — אחרי eval של 30 הקלטות אמיתיות (OpenAI vs Groq vs ivrit.ai)
- אימות שה-`X-Webhook-Token` מגיע
