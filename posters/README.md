# Posters

Four A4 teaser posters for Gilwell Reunion, one per patrol: the head
silhouette over "ARE YOU A WOLF?" (BULL / CURLEW / RAVEN), with a QR to
wsjpatrol.com on the torn cream panel. Print full-bleed (borderless) for the
proper flood; ordinary printing leaves a small white frame. The type and QR
are vector, so the same files scale to A3 cleanly.

`make-posters.mjs` rebuilds them. It lifts the fonts, the head masks and the
Poland 2027 lockup out of `../index.html` at run time, so the posters cannot
drift from the app; change the app and rerun. The QR is generated fresh and
the build fails unless a render of every poster machine-decodes back to
https://wsjpatrol.com.

To run: `npm install playwright qrcode jsqr pngjs`, make sure Playwright has
a Chromium (`npx playwright install chromium`), then `node make-posters.mjs`
from this folder. The PDFs land beside the script.

This folder is not shipped by the Publish workflow; it stays private to main.
