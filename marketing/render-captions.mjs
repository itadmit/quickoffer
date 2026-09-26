// Renders captions.html to a transparent PNG sequence for build-demo.sh to
// overlay. Alpha comes from puppeteer's omitBackground, so there is no
// alpha-video codec in the chain at all - ffmpeg overlays the PNGs directly.
//
//   node render-captions.mjs      -> .build-demo/caps/%05d.png
import puppeteer from "puppeteer-core";
import { mkdirSync, rmSync, existsSync, appendFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(DIR, "captions.html");
const OUT = path.join(DIR, ".build-demo", "caps");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FPS = 30;
const DURATION = 35.0;
const TOTAL = Math.round(DURATION * FPS);

const LOG = path.join(DIR, "render-captions.log");
writeFileSync(LOG, "");
const log = (m) => { appendFileSync(LOG, m + "\n"); console.log(m); };

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars",
         "--force-device-scale-factor=1", "--font-render-hinting=none"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(SRC).href, { waitUntil: "load", timeout: 120000 });
// coerce to a boolean inside the page - document.fonts.ready resolves to a
// FontFaceSet, which puppeteer cannot serialise, and evaluate never returns
await page.evaluate(async () => { await document.fonts.ready; return true; });
if (!(await page.evaluate(() => !!(window.__timelines || {}).main)))
  throw new Error("caption timeline never registered");
await page.evaluate(() => { window.__timelines.main.pause(); });

log(`rendering ${TOTAL} caption frames @${FPS}fps`);
const t0 = Date.now();
for (let i = 0; i < TOTAL; i++) {
  await page.evaluate((tt) => { const tl = window.__timelines.main; tl.pause(); tl.time(tt); },
                      i / FPS);
  await page.screenshot({ path: path.join(OUT, String(i).padStart(5, "0") + ".png"),
                          omitBackground: true, optimizeForSpeed: true });
  if (i % 200 === 0) log(`  ${i}/${TOTAL}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
log(`captions done in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${OUT}`);
