import { redirect } from "next/navigation";
import { checkPassword, isAdmin, startAdminSession } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const pw = String(formData.get("password") ?? "");
  if (!checkPassword(pw)) redirect("/admin/login?error=1");
  await startAdminSession();
  redirect("/admin");
}

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main className="flex-1 grid place-items-center p-6">
      <form action={login} className="w-full max-w-xs space-y-3 rounded-2xl border border-line bg-card p-5">
        <h1 className="text-xl font-bold">QuickVoice · Admin</h1>
        {!process.env.ADMIN_PASSWORD && (
          <p className="text-sm text-danger">ADMIN_PASSWORD לא מוגדר בסביבה.</p>
        )}
        <input name="password" type="password" className="input" placeholder="סיסמה" autoFocus />
        {error && <p className="text-sm text-danger">סיסמה שגויה</p>}
        <button className="btn-primary w-full">כניסה</button>
      </form>
    </main>
  );
}
