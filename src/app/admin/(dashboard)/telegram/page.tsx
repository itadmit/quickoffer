import { describeSettings } from "@/lib/settings";
import { TelegramForm } from "./telegram-form";

export default async function AdminTelegram() {
  const all = await describeSettings();
  const s = Object.fromEntries(all.map((x) => [x.key, x])) as Record<string, (typeof all)[number]>;
  const mask = (v: string) => (!v ? "" : v.length <= 8 ? "••••" : `${v.slice(0, 3)}…${v.slice(-4)}`);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">טלגרם</h1>
      <p className="text-sm text-muted max-w-2xl">
        ערוץ שני, בעיקר לבדיקות בלי instance של WhatsApp. אותה שיחה, אותו בוט - משתמשי טלגרם נשמרים עם כתובת <code dir="ltr">tg:&lt;chatId&gt;</code>.
        צור בוט ב-@BotFather, הדבק את הטוקן, שמור, ואז &quot;הגדר webhook&quot;.
      </p>
      <TelegramForm
        current={{
          token: { value: mask(s["telegram.bot_token"].value), source: s["telegram.bot_token"].source },
          secretSet: !!s["telegram.webhook_secret"].value,
          username: s["telegram.bot_username"].value,
          appUrl: s["app.url"].value,
        }}
      />
    </div>
  );
}
