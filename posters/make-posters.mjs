/* The four A4 teaser posters, one per patrol, rendered in the app's own
   design language. Run from this folder; the PDFs land beside the script.

   Everything visual is lifted from ../index.html at run time - the Bravely
   and Galano subsets, the four head masks, the Poland 2027 lockup - so the
   posters cannot drift from the app. The QR is generated fresh and then
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

/* The app's font faces and head masks, verbatim. */
const fonts = (idx.match(/@font-face\{[\s\S]*?\}/g) || []).join("\n");
if (!fonts.includes("Bravely") || !fonts.includes("Galano")) throw new Error("fonts not found in index.html");
const headCss = (idx.match(/\.head-(?:wolves|bulls|curlews|ravens)\{[^}]*\}/g) || []).join("\n");
if (headCss.split("\n").length !== 4) throw new Error("head masks not found in index.html");
const WSJ = idx.match(/const WSJ_MARK = "(data:image\/svg\+xml;base64,[^"]+)"/)[1];

const SITE = "https://wsjpatrol.com";
const PAPER = "#FAF5E9", NAVY = "#1B3579";
const HEX = { wolves: "#2A5CAD", bulls: "#2F7D3F", curlews: "#F5B01E", ravens: "#C02D24" };
const INK = { wolves: "#2A5CAD", bulls: "#2A6E38", curlews: "#8A6100", ravens: "#B0271E" };
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

function posterHtml(id, headImg) {
  const c = COPY[id];
  const onFlood = id === "curlews" ? NAVY : PAPER;
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
${fonts}
  @page{size:A4;margin:0}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:210mm;height:297mm}
  body{background:${HEX[id]};overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .flood{position:relative;height:200mm;color:${onFlood};padding:14mm 16mm 0;text-align:center}
  .eyebrow{
    font-family:"Galano Grotesque",sans-serif;font-weight:700;font-size:10.5pt;
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
    white-space:nowrap;
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
    font-family:"Galano Grotesque",sans-serif;font-weight:600;
    font-size:12pt;line-height:1.45;margin-top:4.5mm;max-width:121mm;
  }
  .url{font-family:"Galano Grotesque",sans-serif;font-weight:700;font-size:15pt;margin-top:3.5mm}
  .foot{
    position:absolute;left:16mm;right:16mm;bottom:9mm;
    display:flex;align-items:flex-end;justify-content:space-between;
  }
  .sig{
    font-family:"Liberation Serif",serif;font-weight:700;
    font-size:13pt;color:${INK[id]};
  }
  .sig span{
    display:block;font-family:"Galano Grotesque",sans-serif;font-weight:600;
    font-size:8pt;letter-spacing:.14em;color:${NAVY};margin-top:1.2mm;
  }
  .wsj{height:17mm;display:block}
</style></head>
<body>
  <div class="flood">
    <p class="eyebrow">GILWELL REUNION &middot; 120 YEARS OF PATROLS</p>
    <div class="postmark">${POSTMARK(onFlood)}</div>
    <img class="head" src="${headImg}" alt="">
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

/* The head masks tint by background in the app; print rasterises masks less
   reliably, so bake each head into a tinted transparent PNG first. */
const page = await browser.newPage({ viewport: { width: 1600, height: 1500 } });
const heads = {};
for (const id of Object.keys(COPY)) {
  const tint = id === "curlews" ? NAVY : PAPER;
  await page.setContent(`<style>
    body{margin:0}
    .head{display:block;width:1600px;height:1500px;background:${tint};
      -webkit-mask-size:contain;mask-size:contain;
      -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
      -webkit-mask-position:center;mask-position:center;}
    ${headCss}
  </style><span class="head head-${id}"></span>`);
  heads[id] = path.join(TMP, `head-${id}.png`);
  await page.locator(".head").screenshot({ path: heads[id], omitBackground: true });
}

for (const id of Object.keys(COPY)) {
  const file = path.join(TMP, `poster-${id}.html`);
  fs.writeFileSync(file, posterHtml(id, heads[id]));
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
