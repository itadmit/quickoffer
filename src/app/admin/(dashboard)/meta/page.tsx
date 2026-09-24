import { describeSettings } from "@/lib/settings";
import { MetaForm } from "./meta-form";

export default async function AdminMeta() {
  const all = await describeSettings();
  const s = Object.fromEntries(all.map((x) => [x.key, x])) as Record<string, (typeof all)[number]>;
  const mask = (v: string) => (!v ? "" : v.length <= 8 ? "••••" : `${v.slice(0, 3)}…${v.slice(-4)}`);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Meta (פיקסל)</h1>
      <p className="text-sm text-muted max-w-2xl">
        הפיקסל רץ רק בדף הנחיתה: PageView, ו-Contact בלחיצה על כפתור WhatsApp/טלגרם. מה שקורה אחר כך בבוט נשלח מהשרת
        (Conversions API): Lead בהודעה הראשונה, CompleteRegistration בסוף האונבורדינג, Subscribe בשדרוג בתשלום.
        בלי מזהה פיקסל - אין מעקב בכלל. בלי טוקן - רק הפיקסל בדפדפן.
      </p>
      <MetaForm
        current={{
          pixelId: s["meta.pixel_id"].value,
          token: { value: mask(s["meta.capi_token"].value), source: s["meta.capi_token"].source },
          testCode: s["meta.test_event_code"].value,
        }}
      />
    </div>
  );
}
