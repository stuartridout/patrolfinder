/* The four A4 teaser posters, one per patrol, rendered in the app's own
   design language. Run from this folder; the PDFs land beside the script.

   The fonts and the four patrol marks are lifted from ../index.html at run
   time, so the posters cannot drift from the app; the Poland 2027 mark is
   wsj-mark.svg beside this script. The QR is generated fresh and then
   decode-verified from a render of each poster, never trusted by eye.

   Needs: npm install playwright qrcode jsqr pngjs
   and a Chromium for Playwright (npx playwright install chromium, or set
   executablePath below to an existing one). */
import { chromium } from "playwright";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import fs from "fs";
import os from "os";
import path from "path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "posters-"));
const idx = fs.readFileSync(path.join(HERE, "..", "index.html"), "utf8");

/* The app's font faces and patrol marks, verbatim. The marks are vector
   paths, so they print sharp at any size. */
const fonts = (idx.match(/@font-face\{[\s\S]*?\}/g) || []).join("\n");
if (!fonts.includes("Bravely") || !fonts.includes("Galano")) throw new Error("fonts not found in index.html");
const headsSrc = idx.match(/const HEADS = (\{[\s\S]*?\n\});/);
if (!headsSrc) throw new Error("patrol marks not found in index.html");
const HEADS = Function("return " + headsSrc[1])();
const WSJ = "data:image/svg+xml;base64," + fs.readFileSync(path.join(HERE, "wsj-mark.svg")).toString("base64");

const SITE = "https://wsjpatrol.com";
const PAPER = "#FAF5E9", NAVY = "#1B3579";
/* The Patrol Shoulder Knots, as in the app: Wolves black with a yellow
   border and yellow accents, Ravens pure black. */
const HEX = { wolves: "#000000", bulls: "#C02D24", curlews: "#2F7D3F", ravens: "#000000" };
const INK = { wolves: "#000000", bulls: "#B0271E", curlews: "#2A6E38", ravens: "#000000" };
const ACCENT = { wolves: "#F5B01E" };
const COPY = {
  wolves:  { name: "Wolves",  one: "WOLF" },
  bulls:   { name: "Bulls",   one: "BULL" },
  curlews: { name: "Curlews", one: "CURLEW" },
  ravens:  { name: "Ravens",  one: "RAVEN" },
};

/* The QR as one compact path: a rect per run of dark modules. */
const qr = QRCode.create(SITE, { errorCorrectionLevel: "Q" });
const QR_N = qr.modules.size;
let QR_D = "";
for (let y = 0; y < QR_N; y++) {
  let x = 0;
  while (x < QR_N) {
    if (qr.modules.data[y * QR_N + x]) {
      let run = 0;
      while (x + run < QR_N && qr.modules.data[y * QR_N + (x + run)]) run++;
      QR_D += `M${x} ${y}h${run}v1h-${run}z`;
      x += run;
    } else x++;
  }
}

const POSTMARK = (ink) => `
<svg viewBox="0 0 120 120" aria-hidden="true" style="width:100%;height:100%;color:${ink}">
  <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="5 5"/>
  <circle cx="60" cy="60" r="41" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <defs>
    <path id="arcT" d="M16,60 a44,44 0 1,1 88,0"/>
    <path id="arcB" d="M10,60 a50,50 0 1,0 100,0"/>
  </defs>
  <text fill="currentColor" font-size="10" letter-spacing="2.5" font-weight="700" font-family="'Liberation Serif',serif">
    <textPath href="#arcT" startOffset="50%" text-anchor="middle">BROWNSEA ISLAND</textPath>
  </text>
  <text fill="currentColor" x="60" y="62" text-anchor="middle" font-size="28" font-weight="800" font-family="'Liberation Serif',serif">120</text>
  <text fill="currentColor" x="60" y="76" text-anchor="middle" font-size="9.5" letter-spacing="3.5" font-weight="700" font-family="'Liberation Serif',serif">YEARS</text>
  <text fill="currentColor" font-size="8.5" letter-spacing="1.5" font-weight="700" font-family="'Liberation Serif',serif">
    <textPath href="#arcB" startOffset="50%" text-anchor="middle">1907 &#8226; 2027</textPath>
  </text>
</svg>`;

/* The torn top edge of the cream panel: the same jitter idea as the app's
   cards, drawn once so all four posters tear identically. */
function tornEdge() {
  const pts = [];
  const steps = 46;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * 100;
    const y = 6 + Math.sin(i * 1.7) * 2.4 + Math.sin(i * 0.53 + 2) * 2.0;
    pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return `polygon(0 100%, 0 ${pts[0].split(" ")[1]}, ${pts.join(", ")}, 100% 100%)`;
}
const TORN = tornEdge();

function posterHtml(id) {
  const c = COPY[id];
  const onFlood = PAPER;
  const accent = ACCENT[id] || PAPER;
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
${fonts}
  @page{size:A4;margin:0}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:210mm;height:297mm}
  body{background:${HEX[id]};overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .flood{position:relative;height:200mm;color:${onFlood};padding:14mm 16mm 0;text-align:center}
  .eyebrow{
    font-family:"Galano",sans-serif;font-weight:700;font-size:10.5pt;
    letter-spacing:.18em;
  }
  .postmark{position:absolute;top:12mm;right:14mm;width:34mm;height:34mm}
  .head{display:block;width:100mm;height:84mm;object-fit:contain;object-position:center;margin:9mm auto 9mm}
  .ask1{
    font-family:"Bravely",serif;font-weight:400;
    font-size:52pt;line-height:1;letter-spacing:.07em;
  }
  /* Sized so CURLEW?, the longest name, runs margin to margin; the set keeps
     one size so the four posters read as one family. */
  .ask2{
    font-family:"Bravely",serif;font-weight:400;
    font-size:116pt;line-height:1;letter-spacing:.015em;margin-top:5mm;
    white-space:nowrap;color:${accent};
  }
  /* Wolves' yellow border. Inset rather than at the trim, so it survives a
     printer that cannot print to the edge, and run on under the torn panel so
     the paper is laid over it - never drawn on the cream. */
  .frame{
    position:absolute;left:5mm;right:5mm;top:5mm;height:240mm;
    border:3mm solid ${accent};border-bottom:0;
    display:${ACCENT[id] ? "block" : "none"};
  }
  .panel{
    position:absolute;left:0;right:0;bottom:0;height:101mm;
    background:${PAPER};clip-path:${TORN};
    padding:16mm 16mm 12mm;color:${NAVY};
  }
  .row{display:flex;gap:10mm;align-items:flex-start;margin-top:4mm}
  .qr{
    flex:none;width:52mm;height:52mm;background:#fff;
    border:.6mm solid ${NAVY};border-radius:2.5mm;padding:3mm;
  }
  .qr svg{width:100%;height:100%;display:block}
  .ask{
    font-family:"Bravely",serif;font-weight:400;
    font-size:27pt;line-height:1.02;color:${NAVY};
  }
  .how{
    font-family:"Galano",sans-serif;font-weight:700;
    font-size:12pt;line-height:1.45;margin-top:4.5mm;max-width:121mm;
  }
  .url{font-family:"Galano",sans-serif;font-weight:700;font-size:15pt;margin-top:3.5mm}
  .foot{
    position:absolute;left:16mm;right:16mm;bottom:9mm;
    display:flex;align-items:flex-end;justify-content:space-between;
  }
  .sig{
    font-family:"Liberation Serif",serif;font-weight:700;
    font-size:13pt;color:${INK[id]};
  }
  .sig span{
    display:block;font-family:"Galano",sans-serif;font-weight:700;
    font-size:8pt;letter-spacing:.14em;color:${NAVY};margin-top:1.2mm;
  }
  .wsj{height:17mm;display:block}
</style></head>
<body>
  <div class="frame"></div>
  <div class="flood">
    <p class="eyebrow">GILWELL REUNION &middot; 120 YEARS OF PATROLS</p>
    <div class="postmark">${POSTMARK(accent)}</div>
    <svg class="head" viewBox="0 0 ${HEADS[id].w} ${HEADS[id].h}" aria-hidden="true"><path fill="${accent}" fill-rule="evenodd" d="${HEADS[id].d}"/></svg>
    <h1><span class="ask1">ARE YOU A</span><br><span class="ask2">${c.one}?</span></h1>
  </div>
  <div class="panel">
    <div class="row">
      <div class="qr">
        <svg viewBox="-2 -2 ${QR_N + 4} ${QR_N + 4}" shape-rendering="crispEdges"><path d="${QR_D}" fill="${NAVY}"/></svg>
      </div>
      <div>
        <h2 class="ask">FIND YOUR PATROL</h2>
        <p class="how">Scan to take the quiz &mdash; the same seven questions that sorted BP&rsquo;s first camp in 1907. About 90 seconds.</p>
        <p class="url">wsjpatrol.com</p>
      </div>
    </div>
    <div class="foot">
      <p class="sig">${c.name}<span>BROWNSEA 1907 &middot; POLAND 2027</span></p>
      <img class="wsj" src="${WSJ}" alt="26th World Scout Jamboree, Poland 2027">
    </div>
  </div>
</body></html>`;
}

const launchOpts = fs.existsSync("/opt/pw-browsers/chromium")
  ? { executablePath: "/opt/pw-browsers/chromium" } : {};
const browser = await chromium.launch(launchOpts);

const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });

for (const id of Object.keys(COPY)) {
  const file = path.join(TMP, `poster-${id}.html`);
  fs.writeFileSync(file, posterHtml(id));
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.goto("file://" + file);
  await page.waitForTimeout(300);
  await page.pdf({ path: path.join(HERE, `patrol-poster-${id}-a4.pdf`), format: "A4", printBackground: true });

  /* Decode the QR from a render of the same page. A poster whose QR does not
     read as the site is a failed build, not a shipped poster. */
  const shot = path.join(TMP, `qr-${id}.png`);
  await page.locator(".qr").screenshot({ path: shot });
  const png = PNG.sync.read(fs.readFileSync(shot));
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!code || code.data !== SITE) throw new Error(`${id}: QR decode failed`);
  console.log(`patrol-poster-${id}-a4.pdf - QR reads ${code.data}`);
}

await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
