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
const ploni = localFont({
  variable: "--font-ploni",
  display: "swap",
  src: [
    { path: "../../public/fonts/ploni-regular.otf", weight: "400" },
    { path: "../../public/fonts/ploni-medium.otf", weight: "500" },
    { path: "../../public/fonts/ploni-demibold.otf", weight: "600" },
    { path: "../../public/fonts/ploni-bold.otf", weight: "700" },
  ],
});

export const metadata: Metadata = {
  title: "QuickOffer",
  description: "שלח הודעה קולית. קבל הצעת מחיר. סגור עסקה.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${ping.variable} ${ploni.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface text-ink">{children}</body>
    </html>
  );
}
