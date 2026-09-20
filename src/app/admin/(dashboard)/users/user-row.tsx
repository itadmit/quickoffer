"use client";

import { useTransition } from "react";
import type { User } from "@/lib/db/schema";
import { resetOnboardingAction, setUserPlanAction, toggleBlockAction } from "../actions";

export function UserRow({ user, monthQuotes, totalQuotes }: { user: User; monthQuotes: number; totalQuotes: number }) {
  const [pending, start] = useTransition();
  return (
    <tr className={`border-t border-line ${user.blocked ? "opacity-50" : ""}`}>
      <td className="p-2" dir="ltr">{user.phone}</td>
      <td className="p-2">{user.businessName ?? <span className="text-muted">{user.displayName}</span>}</td>
      <td className="p-2">{user.vatStatus === "exempt" ? "פטור" : "מורשה"}</td>
      <td className="p-2">{user.onboardingState}</td>
      <td className="p-2">
        <select
          className="input py-1"
          value={user.plan}
          disabled={pending}
          onChange={(e) => start(() => setUserPlanAction(user.id, e.target.value as User["plan"]))}
        >
          {["trial", "basic", "pro", "unlimited"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </td>
      <td className="p-2">{monthQuotes} / {totalQuotes}</td>
      <td className="p-2 whitespace-nowrap">{user.createdAt.toLocaleDateString("he-IL")}</td>
      <td className="p-2 whitespace-nowrap">{user.lastActiveAt.toLocaleString("he-IL")}</td>
      <td className="p-2 whitespace-nowrap space-x-2 space-x-reverse">
        <button className="text-xs underline" disabled={pending} onClick={() => start(() => toggleBlockAction(user.id, !user.blocked))}>
          {user.blocked ? "בטל חסימה" : "חסום"}
        </button>
        <button className="text-xs underline" disabled={pending} onClick={() => { if (confirm("לאפס אונבורדינג?")) start(() => resetOnboardingAction(user.id)); }}>
          אפס אונבורדינג
        </button>
      </td>
    </tr>
  );
}
