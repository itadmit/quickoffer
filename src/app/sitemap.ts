import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/blog";
import { appUrl } from "@/lib/quotes/links";

/**
 * Only the pages meant to be found. Everything under /q, /e, /s, /u, /w and /r
 * belongs to one professional or one of their customers - those are private
 * links that happen to be reachable, not pages we want a crawler holding on to.
 *
 * Next prerenders this at build time, so the origin is whatever `app.url` held
 * during the build rather than at request time. That is fine for a domain that
 * changes about never, but changing `app.url` in /admin will not move the URLs
 * here until the next deploy - unlike the links in lib/quotes/links.ts, which
 * do follow it live.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = (await appUrl()).replace(/\/$/, "");
  const newest = POSTS.reduce(
    (latest, p) => (p.updated > latest ? p.updated : latest),
    POSTS[0]?.updated ?? "2026-09-27",
  );

  return [
    {
      url: origin,
      lastModified: new Date(newest),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${origin}/blog`,
      lastModified: new Date(newest),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...POSTS.map((post) => ({
      url: `${origin}/blog/${post.slug}`,
      lastModified: new Date(post.updated),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
