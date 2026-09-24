// Deterministic frame-by-frame render of demo-composition.html -> demo-screens.mp4.
//
// The GSAP timeline is seeked to i/FPS and screenshotted, so the output does not
// depend on how fast the machine can animate. CRF 16 because this is an
// intermediate: build-demo.sh re-encodes the slices it takes.
//
//   node render-demo.mjs        -> demo-screens.mp4
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, existsSync, appendFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(DIR, "demo-composition.html");
const OUT = path.join(DIR, ".build-demo", "frames");
const MP4 = path.join(DIR, "demo-screens.mp4");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FPS = 30;
const DURATION = 25.2;
const TOTAL = Math.round(DURATION * FPS);

// A 750-frame render is long enough that "is it stuck or just slow?" is a real
// question, and node buffers stdout when it is redirected to a file. So
// progress goes to render-demo.log with a synchronous write.
const LOG = path.join(DIR, "render-demo.log");
writeFileSync(LOG, "");
const log = (m) => { appendFileSync(LOG, m + "\n"); console.log(m); };

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
log("launching chrome");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars",
         "--force-device-scale-factor=1", "--font-render-hinting=none"],
});
log("chrome up");
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(SRC).href, { waitUntil: "load", timeout: 120000 });
log("page loaded");
// document.fonts.ready resolves to a FontFaceSet, which is not serialisable -
// coerce to a boolean inside the page or the evaluate never returns.
await page.evaluate(async () => { await document.fonts.ready; return true; });
log("fonts ready");
if (!(await page.evaluate(() => !!(window.__timelines || {}).main)))
  throw new Error("timeline never registered - check the CDN scripts loaded");
await page.evaluate(() => { window.__timelines.main.pause(); });

log(`rendering ${TOTAL} frames @${FPS}fps`);
const t0 = Date.now();
for (let i = 0; i < TOTAL; i++) {
  await page.evaluate((tt) => { const tl = window.__timelines.main; tl.pause(); tl.time(tt); },
                      i / FPS);
  await page.screenshot({ path: path.join(OUT, String(i).padStart(5, "0") + ".png"),
                          optimizeForSpeed: true });
  if (i % 150 === 0)
    log(`  ${i}/${TOTAL}  t=${(i / FPS).toFixed(2)}s  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
log(`frames done in ${((Date.now() - t0) / 1000).toFixed(0)}s - encoding`);

await new Promise((res, rej) => {
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS),
    "-i", path.join(OUT, "%05d.png"), "-c:v", "libx264", "-preset", "medium",
    "-crf", "16", "-pix_fmt", "yuv420p", MP4], { stdio: ["ignore", "ignore", "pipe"] });
  let err = ""; ff.stderr.on("data", (d) => { err += d; });
  ff.on("close", (c) => (c === 0 ? res() : rej(new Error(err.slice(-1500)))));
});
console.log("wrote", MP4, `in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
