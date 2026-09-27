import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { POSTS } from "@/lib/blog";
import { appUrlBase } from "@/lib/quotes/links";

/** Same reasoning as the landing page: nothing here varies by visitor. */
export const revalidate = 3600;

const TITLE = "מדריכים להצעות מחיר לבעלי מקצוע | QuickOffer";
const DESCRIPTION =
  "מדריכים מעשיים לכתיבת הצעות מחיר: מה חייב להופיע, תבנית מלאה, תמחור לפי מקצוע, מע״מ ותנאי תשלום.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: await appUrlBase(),
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/blog" },
    // The root layout blocks indexing for everything; the public pages opt in.
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "he_IL",
      url: "/blog",
      title: TITLE,
      description: DESCRIPTION,
    },
  };
}

export default function BlogIndex() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">
      <nav aria-label="פירורי לחם" className="mb-8 text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          QuickOffer
        </Link>
        <span aria-hidden className="px-2">
          ›
        </span>
        <span className="text-ink">מדריכים</span>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
          מדריכים להצעות מחיר
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted">
          כל מה שבעל מקצוע צריך לדעת כדי לכתוב הצעה שנסגרת: מה חייב להופיע בה, איך
          מתמחרים לפי מקצוע, ואיך לא מפסידים עבודה בגלל מסמך שהגיע מאוחר.
        </p>
      </header>

      <ul className="space-y-4">
        {POSTS.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="group block rounded-2xl border border-line bg-card p-5 sm:p-6 transition-colors hover:border-brand"
            >
              <h2 className="text-xl font-semibold leading-snug group-hover:text-brand">
                {post.title}
              </h2>
              <p className="mt-2 leading-7 text-muted">{post.excerpt}</p>
              <div className="mt-4 flex items-center gap-4 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden />
                  {post.readingMinutes} דקות קריאה
                </span>
                <span className="inline-flex items-center gap-1 text-brand">
                  לקריאה
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
