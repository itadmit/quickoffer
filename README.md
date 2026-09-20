# QuickOffer

שלח הודעה קולית ב-WhatsApp → קבל הצעת מחיר מעוצבת → הלקוח מאשר וחותם.

- **אפיון:** [PRODUCT.md](PRODUCT.md) (מקור האמת) · **הקשר לפיתוח:** [CLAUDE.md](CLAUDE.md)
- **סטאק:** Next.js 16 (App Router) · Neon Postgres + Drizzle · OpenAI (Whisper + GPT structured output) · iBot Chat (WhatsApp) · Vercel

## הרצה מקומית

```bash
npm install
cp .env.example .env.local        # מלא DATABASE_URL, SETTINGS_ENCRYPTION_KEY, TOKEN_SECRET, ADMIN_PASSWORD
npm run db:migrate                 # יוצר את הסכמה (drizzle/)
npm run dev                        # http://localhost:3000
```

Postgres מקומי (`localhost`) עובד עם דרייבר `pg`; Neon עובד דרך `@neondatabase/serverless`.

### הגדרת ספקים (בלי deploy)

`/admin` (סיסמה מ-`ADMIN_PASSWORD`) → **ספקי AI**: ספק/מודל/מפתח לתמלול ול-LLM, "בדוק חיבור". → **iBot**: token, instance_id, webhook token, כתובת האפליקציה.
המפתחות נשמרים מוצפנים (AES-256-GCM) ב-`app_settings`; משתני סביבה הם fallback בלבד.

### iBot

בדשבורד iBot: Webhook URL = `https://<domain>/api/webhooks/ibot`, ולייצר **webhook token** (נשלח כ-`X-Webhook-Token`). בלי טוקן — 401.

### טלגרם (ערוץ שני, נוח לבדיקות)

בוט מ-@BotFather → `/admin → טלגרם` → הדבק טוקן → "הגדר webhook" (דורש HTTPS ציבורי - Vercel או ngrok). משתמשי טלגרם עוברים בדיוק את אותה שיחה.

### בדיקה מקומית בלי WhatsApp ובלי OpenAI

```bash
npm run mock          # מדמה iBot (send-*) + LLM תואם OpenAI על :4001
npm run seed:local    # מכוון app_settings למוק
npm run dev
tests/send.sh M1 text "היי"                       # webhook מזויף עם הפיילוד האמיתי של iBot
tests/send.sh M2 text "הצעת מחיר לדני כהן, 3 גופי תאורה 150 שקל ליחידה, ביקור 200"
python3 tests/sent.py                             # מה הבוט "שלח"
```

`npm test` — בדיקות ללא DB (פרסר iBot על capture אמיתי, חישוב מע״מ, טוקנים, הצפנה).

## מסלולים

| נתיב | תפקיד |
|---|---|
| `POST /api/webhooks/ibot` | קליטת הודעות WhatsApp (200 מיד, עיבוד ב-`waitUntil`) |
| `POST /api/webhooks/telegram` | קליטת הודעות טלגרם, אותו חוזה |
| `GET /api/cron/tick?secret=` | הרמת הודעות תקועות, פקיעת תוקף — כל 5 דק׳ מפינגר חיצוני |
| `/q/{publicId}` | דף לקוח: צפייה, אישור + חתימה, שאלה, דחייה |
| `/e/{token}` | מסך עריכה (magic link, 7 ימים) |
| `/s/{token}` | הגדרות העסק |
| `/admin` | סופר-אדמין |
