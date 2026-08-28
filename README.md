# patrolfinder

**Which Brownsea patrol are you?** — a seven-question quiz that sorts you into one of the four original 1907 Brownsea Island patrols (Wolves, Bulls, Curlews or Ravens). Built for the UK Pavilion at Gilwell Reunion, ahead of the World Scout Jamboree in Gdańsk 2027.

Live site: **https://wsjpatrol.com** (also served from https://stuartridout.github.io/patrolfinder/)

## What's here

| | |
|---|---|
| `index.html` | the whole app: quiz, result, patrol card studio, patrol log |
| `manifest.webmanifest`, `sw.js`, `icons/` | the PWA — installable, and the quiz runs with no signal |
| `CNAME` | the custom domain, republished on every deploy |
| `backend/` | the Azure Function App behind the tally, sign-ups, the patrol log and the team's console |

`.github/workflows/pages.yml` republishes the site to `gh-pages` on every push to `main`. Edit, merge to `main`, and the site updates itself. The CDN caches for about ten minutes.

## Patrol cards

After the result you can build a card to post: a profile picture, a 4:5 Instagram post or a 9:16 story. Add a photo and it is framed with the patrol's animal stamp, its colour and its name.

**The photo never leaves the device.** It is opened and drawn onto a canvas in the browser; nothing is uploaded and nothing is stored. The one exception is deliberate and separate: adding a card to the patrol log, which is opt-in, needs an explicit tick, and is spelled out in the app before you do it.

## The patrol log

A public wall of cards people chose to share. Three rules, enforced in `backend/worker.js` rather than promised in a policy:

1. Anyone can report a card, and it comes off the wall immediately, before any human sees the report.
2. Everything is deleted seven days after Gilwell Reunion. A daily timer sweeps it, every read checks the cutoff, and the first request after the cutoff sweeps too.
3. Reunion is a private event, so cards go up as soon as they are uploaded. Flip **Check cards before they go up** in the console and every upload waits for the team instead.

`REUNION_ENDS` must match in `index.html` and the Function App's settings — the app shows people the deletion date it works out from that value.

## Switching things on

Three constants at the top of the script in `index.html`. Any of them can stay empty; the page shows an honest "not switched on yet" notice rather than failing.

| | |
|---|---|
| `API_BASE` | the Function App URL. Turns on the tally, email capture and the patrol log |
| `EMAIL_ENDPOINT` | a plain form service for email only, if the API isn't up yet |
| `REUNION_ENDS` | last day of Reunion, ISO. Photos go seven days later |

See `backend/README.md` to deploy it: `az login`, pick the subscription, `./deploy.sh`.

## Switching things off, mid-event

The Jamboree Team's console lives at `<api>/admin`, behind a token. Four
switches, each taking effect on the next page load for everyone:

- **Patrol wall** — hides the wall everywhere and stops serving the pictures
- **Adding to the wall** — the wall stays, nobody can add to it
- **Patrol cards and photo overlay** — removes the card studio from the result
- **Check cards before they go up** — off for a private event; on holds every upload

The console also lists reported cards for review, shows the tally and sign-up
count, exports the sign-ups as CSV, and can delete every photo on the spot.

The app remembers the last state it saw, so a phone with no signal shows what
it last knew, and everything defaults to on, so an unreachable API never
accidentally hides a feature.

## DNS

`wsjpatrol.com` points at GitHub Pages: four `A` records for the apex (`185.199.108.153`, `.109.153`, `.110.153`, `.111.153`), or `ALIAS`/`ANAME` to `stuartridout.github.io`, plus a `CNAME` on `www`. Set the custom domain in the repo's Pages settings and turn on Enforce HTTPS once the certificate is issued.

## Before shipping visual changes

Render real screenshots at 390x844@2x, 360 and 1440 for every state and critique them. Do the same for the cards at all three sizes, with and without a photo, for all four patrols.
