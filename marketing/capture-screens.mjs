// Captures the real product screens the demo reel uses, into shots/.
//
//   scr-quote916.png   /q/{publicId} at the ad's own 9:16, so it fills the
//                      frame with no crop and no letterbox
//   og-card.png        the link preview card WhatsApp shows under the link
//
// Nothing here is a mockup: both come out of the running app, so the numbers on
// screen are whatever calc.ts actually produces.
//
// Setup (LOCAL database only - see the warning in seed-demo.sql):
//   psql -d quickoffer_dev -f marketing/seed-demo.sql
//   cp marketing/logo-yossi.png public/tmp-logo-yossi.png
//   DATABASE_URL=postgresql://$USER@localhost:5432/quickoffer_dev \
//     APP_URL=http://localhost:3100 npx next dev -p 3100
//   node marketing/capture-screens.mjs
//   rm public/tmp-logo-yossi.png
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SHOTS = path.join(DIR, "shots");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.DEMO_BASE ?? "http://localhost:3100";
const PUBLIC_ID = process.env.DEMO_QUOTE ?? "A3f9Qd";

// The Next dev-tools badge floats over the bottom corner of every capture.
const HIDE_DEV = "nextjs-portal{display:none!important}";

mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--font-render-hinting=none"],
});
const page = await browser.newPage();

// 430 x 764 CSS is 9:16; at DSF 2.512 that lands on 1080 x 1919. Capturing at
// the ad's aspect rather than a phone's means the page lays itself out for the
// frame, instead of being cropped into it afterwards.
await page.setViewport({ width: 430, height: 764, deviceScaleFactor: 2.512 });
await page.goto(`${BASE}/q/${PUBLIC_ID}`, { waitUntil: "networkidle0", timeout: 60000 });
await page.addStyleTag({ content: HIDE_DEV });
await page.evaluate(async () => { await document.fonts.ready; return true; });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: path.join(SHOTS, "scr-quote916.png") });
console.log("shots/scr-quote916.png");

// The OG route renders with Satori, so fetch the bytes rather than screenshot
// it. It needs users.logo_url to be absolute - a relative path throws there.
const og = await page.evaluate(async (u) => {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`opengraph-image returned ${r.status}`);
  const b = new Uint8Array(await r.arrayBuffer());
  return Array.from(b);
}, `${BASE}/q/${PUBLIC_ID}/opengraph-image`);
writeFileSync(path.join(SHOTS, "og-card.png"), Buffer.from(og));
console.log(`shots/og-card.png  ${og.length.toLocaleString()} bytes`);

await browser.close();
