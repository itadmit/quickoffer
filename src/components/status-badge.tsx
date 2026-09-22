import type { Quote } from "@/lib/db/schema";

export const STATUS_LABELS: Record<Quote["status"], [label: string, className: string]> = {
  draft: ["טיוטה", "bg-line text-ink"],
  sent: ["נשלחה", "bg-brand-soft text-brand"],
  viewed: ["נצפתה", "bg-brand-soft text-brand"],
  approved: ["אושרה", "bg-ok/15 text-ok"],
  rejected: ["נדחתה", "bg-danger/10 text-danger"],
  expired: ["פג תוקף", "bg-warn text-warn-ink"],
};

export function StatusBadge({ status }: { status: Quote["status"] }) {
  const [label, cls] = STATUS_LABELS[status];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${cls}`}>{label}</span>;
}
