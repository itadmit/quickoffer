import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/quotes/links";

/**
 * The private routes are disallowed here as well as being noindex in the root
 * layout. The meta tag is what actually keeps them out of the index; this file
 * is what stops a crawler from spending its budget on six-character link codes
 * it will never be allowed to show.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = (await appUrl()).replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/blog"],
      disallow: ["/q/", "/e/", "/s/", "/u/", "/w/", "/r/", "/admin", "/api/", "/link-expired"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
