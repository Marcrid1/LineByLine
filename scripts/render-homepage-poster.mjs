import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "../server/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const orderId = process.argv[2] || "b4e08c3d";
const htmlPath = path.join(rootDir, "Output", orderId, "poster.html");
const outPath = path.join(rootDir, "assets", "poster-example.png");

if (!existsSync(htmlPath)) {
  console.error("poster.html not found:", htmlPath);
  process.exit(1);
}

const chromePaths = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const executablePath = chromePaths.find((p) => existsSync(p));
if (!executablePath) {
  console.error("Chrome/Edge not found for puppeteer-core");
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({
    width: 794,
    height: 1123,
    deviceScaleFactor: 2,
  });
  await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, {
    waitUntil: "networkidle0",
    timeout: 120000,
  });
  await page.emulateMediaType("screen");
  await page.addStyleTag({
    content: `
      html, body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: #fff8f4 !important; }
      #a4-poster { margin: 0 !important; width: 794px !important; height: 1123px !important; }
      .poster-page { width: 794px !important; height: 1123px !important; }
    `,
  });
  await new Promise((resolve) => setTimeout(resolve, 500));

  const poster = await page.$("#a4-poster");
  if (!poster) throw new Error("#a4-poster not found");

  await poster.screenshot({
    path: outPath,
    type: "png",
  });
  console.log("Saved", outPath);
} finally {
  await browser.close();
}
