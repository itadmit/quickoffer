# פרומפט ליצירת הקול של ההודעה הקולית

ההודעה הקולית ב-0:12 היא הרגע היחיד בפרסומת שבו **בעל המקצוע עצמו** מדבר. כרגע
היא מושמעת בקול של הקריין עם עיבוד טלפון, וזה הפשרה שצריך לסגור: הקריין מדבר
*על* בעל המקצוע ("לא שכחת", "ואתה מקבל עדכון"), אז הם חייבים להישמע כשני אנשים.

**איפה מייצרים:** ElevenLabs → Voice Design (Text to Voice).
⚠️ **דרך ה-API זה חסום בתוכנית חינם** (403: "Creating a voice through the API is
only available on a paid plan"). בממשק הווב זה כן עובד.

---

## הפרומפט (להדביק ב-Voice Description)

הפרומפטים באנגלית - Voice Design מבין אנגלית הרבה יותר טוב, והקול שייצא ידבר
עברית בלי קשר לשפת התיאור.

### ברירת מחדל - זה מה שכדאי לנסות ראשון

```
A 42-year-old Israeli tradesman with a warm, slightly gravelly mid-range male
voice. Working-class central-Israeli accent. He speaks Hebrew casually and
unhurried, a little tired at the end of a workday, thinking as he talks. Plain
and matter-of-fact, the way someone talks into a phone while sitting in a van -
not performing, not announcing, no radio-presenter polish. Slight breathiness,
natural pauses, relaxed pace.
```

### חלופה א׳ - מחוספס ומבוגר יותר, אם ברירת המחדל יוצאת חלקה מדי

```
A 48-year-old Israeli builder with a deep, rough, weathered male voice, heavy
smoker's rasp. Blunt working-class Israeli accent. Speaks Hebrew slowly and
flatly, low energy, no enthusiasm, like a man dictating something practical into
his phone at the end of a long day. Gruff but not angry. No polish whatsoever.
```

### חלופה ב׳ - צעיר ומהיר יותר, אם רוצים אנרגיה

```
A 34-year-old Israeli electrician with a bright, slightly nasal male voice and a
fast, clipped delivery. Casual modern Tel Aviv accent. Speaks Hebrew quickly and
practically, mid-task, slightly distracted, like someone firing off a voice note
between jobs. Friendly, informal, a bit rushed. Not a narrator.
```

---

## טקסט התצוגה המקדימה

⚠️ **ה-API דורש לפחות 100 תווים**, ולכן הוספתי זנב שממילא נחתך אחר כך.
שתי הערות כתיב שנבדקו בפועל:

- **`עוֹפֶר` עם ניקוד** - בלי זה המנוע מבטא "אוֹפֶר" או "עוֹפֵר".
- **`מַעַם` פונטי** ולא `מע״מ` - המנוע לא יודע לקרוא ראשי תיבות.

```
עוֹפֶר, תכין הצעה לדני כהן. שלוש נקודות חשמל, מאה שמונים ליחידה. ביקור מאתיים. לפני מַעַם. תשלח לי את זה כשתהיה מוכן.
```

**מה שנכנס לפרסומת בפועל** הוא רק עד "לפני מַעַם." - את הזנב חותכים.

---

## הגדרות מומלצות

| | |
|---|---|
| Model | `eleven_v3` |
| Stability | **0.35-0.45** - נמוך בכוונה. הודעה קולית אמיתית לא אחידה |
| Similarity | 0.70 |
| Style | 0.30-0.40 |
| Speed | 1.00 (העיבוד מאיץ אח״כ ל-1.12) |

## איך לבחור בין התוצאות

Voice Design מחזיר כמה אפשרויות. הקריטריון היחיד שחשוב:

1. **האם זה נשמע כמו אדם אחר מהקריין?** אם לא - לפסול, גם אם הקול יפה.
2. **האם המספרים נשמעים טבעיים?** "מאה שמונים" ו"מאתיים" הם רוב השורה. קול
   שמקריא מספרים כמו קריין חדשות הורס את הפרמיסה.
3. **בלי אנרגיית פרסומת.** אם יש חיוך בקול - לפסול.

---

## אחרי שיש קובץ

שולחים לי אותו ואני מכניס. העיבוד לצליל טלפון כבר קיים ורץ אוטומטית:

```
atempo=1.12, highpass=300Hz, lowpass=3400Hz,
acompressor=threshold=-20dB:ratio=4, equalizer=f=1800:g=3, volume=0.82
```

זה מה שהופך אותו מ"קריין שני" ל"אודיו שיוצא מהטלפון שבפריים". הקובץ נכנס ל-
`audio/voicenote.mp3`, ואז `./mix-audio.sh` ו-`./export-audio.sh`.

**עדיין הכי טוב:** להקליט את זה באמת בטלפון. חצי דקה עבודה, ואף מנוע לא ישחזר
את זה. הפרומפטים כאן הם הגיבוי.
