import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { toVisual } from "@/lib/og-bidi";
import { formatMoney } from "@/lib/quotes/calc";
import { getQuoteByPublicId } from "@/lib/quotes/service";
import { normalizeTemplateSpec, type QuoteTemplateSpec } from "@/lib/quotes/template-spec";
import { getTemplateForUser } from "@/lib/quotes/templates";

/**
 * The preview card WhatsApp renders when the professional forwards the link.
 *
 * This is the first thing the customer sees - before the tap, before the page.
 * A bare link reads as spam; a card with the business name and the total reads
 * as a document. Same information as the top of the quote, nothing more.
 */

export const alt = "הצעת מחיר";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

// Hebrew subsets (~13KB each) - ImageResponse budgets 500KB for the whole bundle
// and only accepts ttf/otf/woff, so these stay uncompressed next to the code.
const fontDir = join(process.cwd(), "src/assets/og");
const [ploniMedium, ploniBold] = await Promise.all([
  readFile(join(fontDir, "ploni-medium-subset.otf")),
  readFile(join(fontDir, "ploni-bold-subset.otf")),
]);

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";

export default async function Image({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const q = await getQuoteByPublicId(publicId);

  const snapshot = q?.status === "approved" ? (q.approvedSnapshot as SnapshotShape | null) : null;
  const business = snapshot?.business ?? {
    businessName: q?.user.businessName ?? null,
    logoUrl: q?.user.logoUrl ?? null,
  };
  const accent = normalizeTemplateSpec(
    snapshot?.template ?? (q ? await getTemplateForUser(q.user) : null),
  ).accent;

  const businessName = business.businessName ?? "הצעת מחיר";
  const total = q ? formatMoney(q.total) : "";
  const approved = q?.status === "approved";
  const itemCount = q?.items.length ?? 0;

  // Satori has no bidi, so every Hebrew string is reordered before it goes in.
  const he = toVisual;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          fontFamily: "Ploni",
          color: INK,
        }}
      >
        {/* accent rule - the only brand colour, same one the document uses */}
        <div style={{ display: "flex", height: 14, background: accent }} />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 72px",
          }}
        >
          {/* row-reverse rather than dir="rtl": Satori ignores `direction`, so
              element order is arranged here and text order by `he()` above. */}
          <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 28 }}>
            {business.logoUrl ? (
              // Satori renders plain <img>; next/image has no meaning here.
              <img
                src={business.logoUrl}
                alt=""
                width={104}
                height={104}
                style={{ width: 104, height: 104, objectFit: "contain", borderRadius: 24 }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  width: 104,
                  height: 104,
                  borderRadius: 24,
                  background: `${accent}1f`,
                  color: accent,
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 52,
                  fontWeight: 700,
                }}
              >
                {businessName.slice(0, 1)}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.1 }}>{he(businessName)}</div>
              <div style={{ fontSize: 28, color: MUTED }}>
                {he(approved ? "הצעת מחיר · אושרה ונחתמה" : "הצעת מחיר")}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            {q?.customerName ? (
              <div style={{ fontSize: 34, color: MUTED }}>{he(`לכבוד ${q.customerName}`)}</div>
            ) : null}
            {q?.title ? (
              <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.2 }}>{he(q.title)}</div>
            ) : null}
            <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontSize: 96, fontWeight: 700, color: accent, lineHeight: 1 }}>{he(total)}</span>
              {itemCount > 0 ? (
                <span style={{ fontSize: 30, color: MUTED }}>{he(`${itemCount} סעיפים`)}</span>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "row-reverse",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `2px solid ${LINE}`,
              paddingTop: 26,
              fontSize: 27,
              color: MUTED,
            }}
          >
            <span>{he(approved ? "המסמך החתום" : "לצפייה, אישור וחתימה - לחץ")}</span>
            <span>QuickOffer</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Ploni", data: ploniMedium as unknown as ArrayBuffer, weight: 500, style: "normal" },
        { name: "Ploni", data: ploniBold as unknown as ArrayBuffer, weight: 700, style: "normal" },
      ],
    },
  );
}

type SnapshotShape = {
  business: { businessName: string | null; logoUrl: string | null };
  template?: Partial<QuoteTemplateSpec>;
};
