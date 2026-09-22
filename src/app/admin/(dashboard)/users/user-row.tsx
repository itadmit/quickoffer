"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { User } from "@/lib/db/schema";
import {
  resetOnboardingAction,
  setUserPlanAction,
  toggleBlockAction,
} from "../actions";

export function UserRow({
  user,
  templateName,
  monthQuotes,
  totalQuotes,
  settingsUrl,
}: {
  user: User;
  templateName: string | null;
  monthQuotes: number;
  totalQuotes: number;
  settingsUrl: string;
}) {
  const [pending, start] = useTransition();
  return (
    <tr className={`border-t border-line ${user.blocked ? "opacity-50" : ""}`}>
      <td className="p-2" dir="ltr">
        {user.phone}
      </td>
      <td className="p-2">
        {user.businessName ?? (
          <span className="text-muted">{user.displayName}</span>
        )}
      </td>
      <td className="p-2">{user.vatStatus === "exempt" ? "פטור" : "מורשה"}</td>
      <td className="p-2">{user.onboardingState}</td>
      <td className="p-2">
        <select
          className="input py-1"
          value={user.plan}
          disabled={pending}
          onChange={(e) =>
            start(() =>
              setUserPlanAction(user.id, e.target.value as User["plan"]),
            )
          }
        >
          {["trial", "basic", "pro", "unlimited"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2">
        {templateName ?? <span className="text-muted">ברירת מחדל</span>}
      </td>
      <td className="p-2">
        <Link
          href={`/admin/quotes?q=${encodeURIComponent(user.phone)}`}
          className="underline"
        >
          {monthQuotes} / {totalQuotes}
        </Link>
      </td>
      <td className="p-2 whitespace-nowrap">
        {user.createdAt.toLocaleDateString("he-IL")}
      </td>
      <td className="p-2 whitespace-nowrap">
        {user.lastActiveAt.toLocaleString("he-IL")}
      </td>
      <td className="p-2 whitespace-nowrap">
        <div className="flex gap-3">
          <a href={settingsUrl} target="_blank" className="text-xs underline">
            הגדרות
          </a>
          <button
            className="text-xs underline"
            disabled={pending}
            onClick={() =>
              start(() => toggleBlockAction(user.id, !user.blocked))
            }
          >
            {user.blocked ? "בטל חסימה" : "חסום"}
          </button>
          <button
            className="text-xs underline"
            disabled={pending}
            onClick={() => {
              if (confirm("לאפס אונבורדינג?"))
                start(() => resetOnboardingAction(user.id));
            }}
          >
            אפס אונבורדינג
          </button>
        </div>
      </td>
    </tr>
  );
}
