# QuickOffer — הקשר לפיתוח (CLAUDE.md)

קובץ זה נטען אוטומטית בכל session. הוא מסכם **מה נלמד ומה הוחלט** עד 20.9.2026, כדי שאפשר יהיה להמשיך בלי לשחזר את השיחה.

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

- **MVP בנוי ועובד מקצה לקצה מקומית (20.9.2026).** כל 11 סעיפי ה-MVP ב-PRODUCT.md §12 קיימים חוץ מ-PDF (נדחה במכוון). נבדק נגד מוק של iBot + LLM (ראה README) — **עדיין לא נבדק מול iBot אמיתי ו-OpenAI אמיתי.** זה השלב הבא.
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
- endpoint סטטוס instance / webhook על ניתוק (PRODUCT.md §5.5). בינתיים: pinger חיצוני (cron-job.org) + התראה כש-`send-text` מחזיר `Instance not connected`.

### כללי שליחה
- לא במקביל — תור יוצא, הודעה אחת בכל פעם, 300–500ms ריווח, retry ×3.
- `msg`/`caption` ב-URL encoding. `docurl` חייב להיות ציבורי.
- `token` ו-`instance_id` רק בשרת.

## סינון הודעות נכנסות (לזרוק בשקט עם 200)
`group === true` · `msgFromMe === true` · `route !== "incoming"` · `msgId` שכבר נראה · `type` לא נתמך (סטיקר, מיקום, איש קשר) — לזה כן לענות "אני מבין הודעות קוליות, טקסט ותמונות".

## צינור עיבוד (זמנים צפויים)
הורדת OGG 0.5 שנ׳ → Whisper 3–8 שנ׳ → GPT structured output 2–5 שנ׳ → DB → 2× `send-text` ~1 שנ׳. **סה"כ 7–15 שניות.** עלות ~7 אגורות להצעה.

## מוסכמות
- **שפה:** המשתמש כותב עברית. מסמכים, הודעות הבוט, וממשק - עברית, RTL. קוד, שמות שדות, commits - אנגלית.
- **טיפוגרפיה/UI:** אין קו מפריד ארוך (—) בטקסט של הממשק, הודעות הבוט או דוגמאות בפרומפטים - מקף רגיל (-) בלבד. אין אימוג׳ים בממשק ה-web - איקונים מ-`lucide-react`. (הודעות הבוט ב-WhatsApp כן משתמשות באימוג׳ים, לפי PRODUCT.md §6.) פונטים: Ping לכותרות, Ploni לטקסט (`public/fonts/`, כמו באתרי Quick Shop).
- **הודעות הבוט** מנוסחות מילה-במילה ב-PRODUCT.md §6 — להשתמש בהן, לא להמציא מחדש.
- **LLM מפרש כוונות** (פקודות, תשובות אונבורדינג), לא string matching. exact match רק כ-fallback.
- **מחיר שלא נאמר = 0 + `needsReview`.** לעולם לא לנחש מחיר.
- **סודות** (מפתחות API, iBot token) — ב-`app_settings` מוצפנים AES-256-GCM, env כ-fallback. לא בלוגים, לא ללקוח.
- כשפרטי הפיילוד של iBot חשובים — לאמת מול capture אמיתי, לא מול דף ה-docs (שהוא שליחה בלבד).
- **Next.js 16:** `params`/`searchParams` הם Promise; `proxy.ts` במקום middleware; `after()` מ-`next/server`. הדוקומנטציה ב-`node_modules/next/dist/docs/`.
- לפני סיום: `npm run typecheck && npx eslint . && npm test`. לבדיקת זרימה מלאה: README → "בדיקה מקומית".

## מפת הקוד (`src/`)

| נתיב | תפקיד |
|---|---|
| `lib/db/schema.ts` | סכמה Drizzle = PRODUCT.md §9 (+ `users.blocked`, `inbound_messages.attempts`, `processing_runs.kind/total_ms`). מיגרציות ב-`drizzle/` |
| `lib/db/index.ts` | `db` — Neon HTTP בפרודקשן, `pg` כשה-host הוא localhost |
| `lib/settings.ts` | `app_settings` — `getSetting/setSetting`, cache 60ש׳, env fallback, סודות `enc:` |
| `lib/crypto.ts` | AES-256-GCM לסודות; HMAC tokens - היום רק ל-cookie של האדמין (`p: a`) ולתאימות אחורה של קישורים ישנים |
| `lib/quotes/links.ts` | **קישורים קצרים (20.9.2026):** `/e/{code}`, `/s/{code}` = קוד 6 תווים בטבלת `magic_links` (purpose, subject, expires_at). `editLink()` משתמש שוב באותו קוד כל עוד נשארו >24 שעות. `resolveLink(code, purpose)`; קוד עם "." = טוקן HMAC ישן. cron מוחק פגי תוקף. `public_id` גם 6 תווים (היה 10) |
| `lib/whatsapp/` | `types.ts` (ממשק), `ibot.ts` (פרסר + send-*), `telegram.ts` (Bot API, כתובות `tg:<chatId>`, מדיה `tg-file:<id>` שנפתרת רק בזמן הורדה), `index.ts` (`gatewayFor(address)` בוחר ערוץ; תור סדרתי 400ms, retry ×3, לוג `outbound_messages`, פיצול >3900 תווים) |
| `lib/ai/` | `types.ts` (Zod schemas), `prompts.ts` (4 system prompts), `openai.ts` (Whisper + `chat.completions.parse`; משמש גם Groq/custom דרך baseURL), `index.ts` (factory מהגדרות) |
| `lib/quotes/` | `calc.ts` (מע״מ, עיגול), `service.ts` (CRUD, טיוטה פעילה, snapshot), `links.ts`, `customer-actions.ts` (צפייה/אישור/דחייה/שאלה + התראות), `template-spec.ts` (טיפוס תבנית, pure), `templates.ts` (DB: `getTemplateForUser` - בחירת המשתמש אם פעילה, אחרת ברירת המחדל), `sample.ts` (הצעת הדוגמה לתצוגות מקדימות) |
| `lib/conversation/` | `handler.ts` (מכונת המצבים §6 — `handleInbound`), `messages.ts` (כל הודעות הבוט מילה-במילה), `quota.ts` (§11) |
| `app/api/webhooks/ibot` | הקליטה. `app/api/cron/tick` — תקועים + פקיעה |
| `app/q/[publicId]` · `app/e/[token]` · `app/s/[token]` | דף לקוח · עריכה · הגדרות (server actions ב-`actions.ts` לצד כל דף) |
| `app/admin/(dashboard)` | סופר-אדמין; `login/` מחוץ ל-route group. `lib/admin/auth.ts` — cookie `qo_admin` |
| `components/quote-document.tsx` | רינדור ההצעה - משותף לדף לקוח, תצוגה מקדימה ואדמין. בוחר layout לפי `q.template` |
| `components/quote-layouts/` | `shared.tsx` (QuoteView + אבני בניין), `classic.tsx`, `modern.tsx`, `minimal.tsx`. `template-thumb.tsx` = תמונה ממוזערת (scale) |
| `app/admin/(dashboard)/templates` | CRUD תבניות (`quote_templates`: layout + צבע + טקסט תחתית + פעילה/ברירת מחדל) עם preview חי. המשתמש בוחר ב-`/s`; `users.template_id` null = ברירת מחדל. ה-snapshot באישור מקפיא גם את התבנית |
| `tests/` | `pure.test.ts` (ללא DB), `mock-server.mjs`, `seed-local.ts`, `send.sh`, `sent.py`, `approve-flow.ts` |

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
- `/q` רושם צפייה ב-`after()` (לא חוסם); צפייה ראשונה → `viewed` + התראה; דדופ שעה.
- **אורך מזהים = 6 תווים** (בקשת המשתמש: קישורים קצרים ונעימים בהודעות). אלפבית 55 תווים בלי דומים ⇒ 2.8×10¹⁰ צירופים. אין rate limit על `/q` ו-`/e` כרגע - אם יהיה חשש לניחוש, להוסיף לפני שמקצרים עוד.
- מקומית `waitUntil` הוא no-op — ה-Promise רץ ממילא. בפרודקשן חובה `maxDuration=60` על ה-route (קיים).
- אין OPENAI_API_KEY בסביבת המשתמש — מפתחות יוזנו דרך `/admin`.
- **דף הבית = דף נחיתה** עם CTA ל-`wa.me/<bot.phone>?text=היי`. המספר ב-`app_settings["bot.phone"]` (עריכה ב-`/admin → iBot`). **זמני:** המספר של Quick Shop, 972552554432, עד שיהיה מספר ייעודי ל-QuickOffer.

## מה הלאה (לפי סדר)
1. **חיבור אמיתי:** Neon DB + Vercel deploy + מפתח OpenAI ב-`/admin` + webhook token ב-iBot → הודעה קולית אמיתית מהטלפון של המשתמש. לאמת ש-`X-Webhook-Token` באמת מגיע.
2. eval של 20–30 הקלטות אמיתיות (PRODUCT.md §7.5) — לבחור מנוע תמלול, לכוונן `STRUCTURE_RULES`.
3. Vercel Blob (`BLOB_READ_WRITE_TOKEN`) — בלעדיו לוגו/חתימה/אודיו לא נשמרים (הקוד מחזיר null ולא נופל).
4. PDF (§8.3), התראות שלב 2, קטלוג אישי.

## החלטות פתוחות (PRODUCT.md §15)
- דומיין קצר לקישורים (טרם נבחר; בדוגמאות `qv.app`)
- בחירת מנוע תמלול סופית — אחרי eval של 30 הקלטות אמיתיות (OpenAI vs Groq vs ivrit.ai)
- אימות שה-`X-Webhook-Token` מגיע
