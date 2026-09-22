// Renders every page in art/ with the installed Chrome and writes PNG + WebP
// into public/. Usage: npm run art:capture
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";
import { chromium } from "playwright-core";

const TARGETS = [
  { page: "keyart.html", out: "public/palette-provider" },
  { page: "step-sampling.html", out: "public/art/step-1-sampling" },
  { page: "step-density.html", out: "public/art/step-2-density" },
  { page: "step-families.html", out: "public/art/step-3-families" },
  { page: "step-tiers.html", out: "public/art/step-4-tiers" },
];

// Vite picks the next free port if 5199 is busy; read the URL it bound.
const server = await createServer({
  server: { port: 5199 },
  logLevel: "silent",
});
await server.listen();
const base = `${server.resolvedUrls.local[0]}art/`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1400, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
mkdirSync("public/art", { recursive: true });

for (const { page: file, out } of TARGETS) {
  await page.goto(base + file);
  await page.waitForSelector("#frame[data-ready='1']", { timeout: 30000 });
  const png = await page.locator("#frame").screenshot({ type: "png" });
  writeFileSync(`${out}.png`, png);

  // WebP via the page's own canvas, so no image library is needed
  const webp = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d").drawImage(img, 0, 0);
    return c.toDataURL("image/webp", 0.9).split(",")[1];
  }, png.toString("base64"));
  writeFileSync(`${out}.webp`, Buffer.from(webp, "base64"));
  console.log(`${out}.png / .webp`);
}

await browser.close();
await server.close();
