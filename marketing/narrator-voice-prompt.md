# פרומפט לקול הקריין

המטרה: קריין שלא נשמע מלאכותי. הכישלון הנפוץ הוא לא "קול מכוער" אלא **קול מושלם
מדי** - אחיד בקצב, אחיד בעוצמה, בלי נשימות, עם חיוך של פרסומת. אלה הסימנים שהאוזן
מזהה כ-TTS, וכל אחד מהם נסגר אחרת.

⚠️ **דרך ה-API יצירת קול חסומה בתוכנית חינם** (403). בממשק הווב זה עובד.

---

## הפרומפט (Voice Description)

באנגלית - Voice Design מבין אנגלית טוב בהרבה, והקול ידבר עברית בלי קשר.

### ברירת מחדל

```
A 38-year-old Israeli man with a natural, conversational mid-range voice and a
standard central-Israeli accent. He sounds like a friend from the same trade
explaining something across a table - dry, direct, a little wry. Relaxed pace
with uneven rhythm: he leans on some words and throws others away. Audible
breaths between sentences, slightly soft consonants, a touch of vocal fry at the
ends of phrases. Recorded close on a decent microphone in a normal room, not a
broadcast booth. Absolutely no advertising or announcer energy, no smile in the
voice, no upselling warmth, never over-articulated.
```

### חלופה א׳ - מבוגר ורגוע יותר

```
A 45-year-old Israeli man with a calm, slightly worn baritone and a standard
Israeli accent. Understated and unhurried, the way someone talks when they have
nothing to prove. Uneven natural rhythm, clear breaths, occasional throat
clearing texture. Warm but completely unsentimental. No announcer delivery, no
commercial polish, no rising enthusiastic endings.
```

### חלופה ב׳ - צעיר וחד יותר

```
A 32-year-old Israeli man with a light, quick, slightly nasal voice and a casual
modern Tel Aviv accent. Talks fast and plainly, swallows the ends of some words,
sounds like he is mid-conversation rather than reading. Natural breaths, informal
and a bit blunt. No radio voice, no performance, no advertising smile.
```

---

## ההגדרות משנות לא פחות מהפרומפט

**זה החלק שהכי מפספסים.** אפשר לקבל קול מעולה ולהרוס אותו ב-Stability גבוה.

| | | למה |
|---|---|---|
| Model | `eleven_v3` | |
| **Stability** | **0.30-0.40** | הנמוך ביותר שעוד יציב. Stability גבוה = אחידות = רובוט |
| Similarity | 0.65-0.75 | גבוה מדי מחזיר ארטיפקטים מהאימון |
| Style | 0.25-0.40 | מעל זה נכנסת אנרגיית פרסומת |
| Speed | 0.96-1.00 | טיפה מתחת ל-1 נשמע שקול יותר |

**להגריל כמה פעמים.** אותו טקסט ואותן הגדרות נותנים תוצאות שונות. הריצה הראשונה
כמעט אף פעם לא הכי טובה.

---

## הטקסט - שם נמצא חצי מהטבעיות

מנוע TTS מבצע את מה שכתוב. כתיב "נכון" נותן קריינות; כתיב פונטי עם פיסוק לנשימה
נותן דיבור.

**כללים שנבדקו בפרויקט הזה:**

- **ראשי תיבות לא מנוגנים.** `מע"מ` → **`מַעַם`**
- **מספרים במילים.** `40 שניות` → **`ארבעים שניות`**
- **לועזית בכתיב עברי.** `QuickOffer` → **`קוויק אוֹפֶר`**
- **ניקוד על שמות.** `עופר` → **`עוֹפֶר`** (אחרת יוצא "אוֹפֶר")
- **שלוש נקודות = נשימה.** פסיק = פסיק קצר. מקף ארוך = שבירה.

### הסקריפט עם סימוני ביצוע

להדביק שורה-שורה, לא הכול ביחד - כל שורה נכנסת לקאט בנפרד ממילא.

```
לא שכחת... פשוט לא היה לך רגע להכין אותה.

אז שולחים לעוֹפֶר, הבוט שלנו, הודעה קולית בוואטסאפ.

עוֹפֶר מתמלל, מסדר, מחשב מַעַם - ומחזיר הצעה מקצועית, עם הלוגו שלך.
תוך ארבעים שניות.

הלקוח פותח, מאשר וחותם... ישר מהטלפון.

ואתה מקבל עדכון באותו הרגע.

קוויק אוֹפֶר. שולחים הודעה קולית... ועוֹפֶר על זה.
```

---

## מה לפסול

1. **חיוך בקול.** אם הוא נשמע שמח למכור - לפסול. §0 מגדיר את הטון: "חבר מהמקצוע,
   לא קופירייטר. אפס בוז לבעל המקצוע - הוא לא עצלן, הוא עסוק."
2. **סופים עולים.** קריין פרסומת מרים את סוף המשפט. חבר לא.
3. **אחידות.** אם כל משפט באותו אורך נשימה ובאותה עוצמה - זה TTS, גם אם הטימבר יפה.
4. **הגייה מושלמת מדי.** "ארבעים שניות" צריך להישמע נזרק, לא מוכרז.

## אחרי שיש קובץ

שולחים לי ואני מחליף. אני מודד מחדש את גבולות המשפטים (`silencedetect`) וממפה
כל בלוק לפעימת התמונה שלו, כמו שנעשה עם ההקלטה הנוכחית - אז אורך שונה לא שובר
כלום, רק צריך למפות מחדש.

הרמות ב-`mix-audio.sh` מחושבות ליעד RMS, אז אם הקובץ החדש יוצא בעוצמה אחרת -
מודדים אותו ומעדכנים את `VO_G`. לא מכוונים בעין.
