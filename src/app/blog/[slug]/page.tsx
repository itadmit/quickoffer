import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Mic } from "lucide-react";
import { Blocks } from "@/components/blog-blocks";
import { POSTS, getPost, relatedPosts, type Post } from "@/lib/blog";
import { OPENING_LINE } from "@/lib/conversation/messages";
import { appUrlBase } from "@/lib/quotes/links";
import { getSetting } from "@/lib/settings";

export const revalidate = 3600;

/** Five posts, all known at build time - prerender the lot. */
export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  const url = `/blog/${post.slug}`;
  return {
    metadataBase: await appUrlBase(),
    title: post.metaTitle,
    description: post.description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      locale: "he_IL",
      url,
      title: post.metaTitle,
      description: post.description,
      publishedTime: post.published,
      modifiedTime: post.updated,
    },
  };
}

/**
 * Article + FAQPage + BreadcrumbList in one graph.
 *
 * The FAQ block is the one worth the effort: these posts answer questions that
 * get typed into Google verbatim, and FAQPage markup is what lets the answer
 * show up under the result instead of only inside it.
 */
function jsonLd(post: Post, origin: string) {
  const url = `${origin}/blog/${post.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: post.metaTitle,
        description: post.description,
        inLanguage: "he-IL",
        datePublished: post.published,
        dateModified: post.updated,
        mainEntityOfPage: url,
        author: { "@type": "Organization", name: "QuickOffer", url: origin },
        publisher: { "@type": "Organization", name: "QuickOffer", url: origin },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: post.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "QuickOffer", item: origin },
          { "@type": "ListItem", position: 2, name: "מדריכים", item: `${origin}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const base = await appUrlBase();
  const origin = base ? base.origin : "https://quickoffer.co.il";
  const phone = (await getSetting("bot.phone")).replace(/\D/g, "");
  // The same prefill the landing page sends, so blog traffic lands on the
  // opening line the bot already knows how to answer without an LLM call.
  const wa = `https://wa.me/${phone}?text=${encodeURIComponent(OPENING_LINE)}`;
  const related = relatedPosts(post);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(post, origin)) }}
      />

      <nav aria-label="פירורי לחם" className="mb-8 text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          QuickOffer
        </Link>
        <span aria-hidden className="px-2">
          ›
        </span>
        <Link href="/blog" className="hover:text-ink">
          מדריכים
        </Link>
      </nav>

      <article>
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{post.title}</h1>
          <div className="mt-4 flex items-center gap-4 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden />
              {post.readingMinutes} דקות קריאה
            </span>
            <time dateTime={post.updated}>
              עודכן{" "}
              {new Date(post.updated).toLocaleDateString("he-IL", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </div>
          <p className="mt-6 text-lg leading-8 text-muted">{post.excerpt}</p>
        </header>

        {post.sections.map((section) => (
          <section key={section.heading} className="mb-10">
            <h2 className="mb-4 text-2xl font-semibold leading-snug">{section.heading}</h2>
            <div className="space-y-4">
              <Blocks blocks={section.blocks} />
            </div>
          </section>
        ))}

        {post.faq.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-2xl font-semibold">שאלות נפוצות</h2>
            <div className="divide-y divide-line rounded-2xl border border-line bg-card">
              {post.faq.map((f) => (
                <details key={f.q} className="group px-5 py-4">
                  <summary className="cursor-pointer list-none font-medium leading-7 marker:content-none">
                    {f.q}
                  </summary>
                  <p className="mt-3 leading-8 text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </article>

      <aside className="rounded-2xl border border-line bg-brand-soft/40 p-6 sm:p-8">
        <h2 className="text-xl font-semibold leading-snug">
          במקום לכתוב את זה - להקליט את זה
        </h2>
        <p className="mt-3 leading-8 text-ink/90">
          שולחים הודעה קולית בוואטסאפ עם מה שעשיתם ובכמה, ומקבלים בחזרה הצעת מחיר
          מעוצבת עם הלוגו שלכם, מוכנה להעברה ללקוח. הלקוח פותח קישור, מאשר וחותם.
          בלי אפליקציה ובלי הרשמה, 5 ההצעות הראשונות חינם.
        </p>
        <a
          href={wa}
          target="_blank"
          rel="noopener"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-medium text-brand-ink"
        >
          <Mic className="h-5 w-5" aria-hidden />
          נסו עכשיו ב-WhatsApp
        </a>
      </aside>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">להמשך קריאה</h2>
          <ul className="space-y-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/blog/${r.slug}`}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-line bg-card px-5 py-4 transition-colors hover:border-brand"
                >
                  <span className="font-medium leading-snug group-hover:text-brand">
                    {r.title}
                  </span>
                  <ArrowLeft className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
