import type { MetadataRoute } from "next";

/**
 * Not a PWA - WhatsApp is the app (PRODUCT.md §3.1). This exists so a quote
 * added to the home screen gets a name and an icon instead of a screenshot.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QuickOffer",
    short_name: "QuickOffer",
    description: "שלח הודעה קולית. קבל הצעת מחיר. סגור עסקה.",
    lang: "he",
    dir: "rtl",
    start_url: "/",
    display: "browser",
    background_color: "#f6f7f9",
    theme_color: "#0f766e",
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
  };
}
