# patrolfinder

**Which Brownsea patrol are you?** — a seven-question quiz that sorts you into one of the four original 1907 Brownsea Island patrols (Wolves, Bulls, Curlews or Ravens). Built for the UK Pavilion at Gilwell Reunion, ahead of the World Scout Jamboree in Gdańsk 2027.

Live site: **https://wsjpatrol.com** (also served from https://stuartridout.github.io/patrolfinder/)

## What's here

| | |
|---|---|
| `index.html` | the whole app: quiz, result, patrol card studio, patrol log |
| `manifest.webmanifest`, `sw.js`, `icons/` | the PWA — installable, and the quiz runs with no signal |
| `CNAME` | the custom domain, republished on every deploy |
| `backend/` | the Cloudflare Worker behind the tally, sign-ups and the patrol log |

`.github/workflows/pages.yml` republishes the site to `gh-pages` on every push to `main`. Edit, merge to `main`, and the site updates itself. The CDN caches for about ten minutes.

## Patrol cards

After the result you can build a card to post: a profile picture, a 4:5 Instagram post or a 9:16 story. Add a photo and it is framed with the patrol's animal stamp, its colour and its name.

**The photo never leaves the device.** It is opened and drawn onto a canvas in the browser; nothing is uploaded and nothing is stored. The one exception is deliberate and separate: adding a card to the patrol log, which is opt-in, needs an explicit tick, and is spelled out in the app before you do it.

## The patrol log

A public wall of cards people chose to share. Three rules, enforced in `backend/worker.js` rather than promised in a policy:

1. Nothing appears publicly until a human on the Jamboree Team releases it.
2. Anyone can report a card, and it comes off the wall immediately.
3. Everything is deleted seven days after Gilwell Reunion. The cron sweeps it, the stored bytes carry an expiry set to the same moment, and every read filters on the cutoff.

`REUNION_ENDS` must match in `index.html` and `backend/wrangler.toml` — the app shows people the deletion date it works out from that value.

## Switching things on

Three constants at the top of the script in `index.html`. Any of them can stay empty; the page shows an honest "not switched on yet" notice rather than failing.

| | |
|---|---|
| `API_BASE` | the Worker URL. Turns on the tally, email capture and the patrol log |
| `EMAIL_ENDPOINT` | a plain form service for email only, if the Worker isn't up yet |
| `REUNION_ENDS` | last day of Reunion, ISO. Photos go seven days later |

See `backend/README.md` to deploy the Worker.

## DNS

`wsjpatrol.com` points at GitHub Pages: four `A` records for the apex (`185.199.108.153`, `.109.153`, `.110.153`, `.111.153`), or `ALIAS`/`ANAME` to `stuartridout.github.io`, plus a `CNAME` on `www`. Set the custom domain in the repo's Pages settings and turn on Enforce HTTPS once the certificate is issued.

## Before shipping visual changes

Render real screenshots at 390x844@2x, 360 and 1440 for every state and critique them. Do the same for the cards at all three sizes, with and without a photo, for all four patrols.
