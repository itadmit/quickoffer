import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Same pairing as the Quick Shop sites: Ping for headings, Ploni for body.
const ping = localFont({
  variable: "--font-ping",
  display: "swap",
  src: [
    { path: "../../public/fonts/ping-regular.woff2", weight: "400" },
    { path: "../../public/fonts/ping-medium.woff2", weight: "500" },
    { path: "../../public/fonts/ping-bold.woff2", weight: "700" },
    { path: "../../public/fonts/ping-heavy.woff2", weight: "800" },
  ],
});
// woff2, not the original otf: same four weights, 233KB instead of 576KB over
// the wire - and these pages are opened on cellular, once.
const ploni = localFont({
  variable: "--font-ploni",
  display: "swap",
  src: [
    { path: "../../public/fonts/ploni-regular.woff2", weight: "400" },
    { path: "../../public/fonts/ploni-medium.woff2", weight: "500" },
    { path: "../../public/fonts/ploni-demibold.woff2", weight: "600" },
    { path: "../../public/fonts/ploni-bold.woff2", weight: "700" },
  ],
});

export const metadata: Metadata = {
  title: "QuickOffer",
  description: "שלח הודעה קולית. קבל הצעת מחיר. סגור עסקה.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "QuickOffer", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Matches the two palettes in globals.css, so the browser chrome does not
  // sit on a different background than the page.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${ping.variable} ${ploni.variable} h-full antialiased`}
      // Safari needs this on <html> too, or the overscroll area stays white.
      style={{ background: "var(--surface)" }}
    >
      <body className="min-h-full flex flex-col bg-surface text-ink">{children}</body>
    </html>
  );
}
