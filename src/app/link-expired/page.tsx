import type { Metadata } from "next";
import { LinkExpired } from "@/components/link-expired";

export const metadata: Metadata = { title: "הקישור לא תקף - QuickOffer" };

export default function LinkExpiredPage() {
  return <LinkExpired hint="הקישור פג או שההצעה נמחקה. שלח “ערוך” לבוט לקבלת קישור חדש." />;
}
