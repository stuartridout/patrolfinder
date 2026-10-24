# patrolfinder

**Which patrol are you?** — a seven-question quiz that sorts you into one of the four original 1907 Brownsea Island patrols (Wolves, Bulls, Curlews or Ravens). The UK's activity at the 26th World Scout Jamboree, Poland 2027, for an international audience in English, French, Polish, Spanish and Arabic. First used at Gilwell Reunion 2026.

Live site: **https://wsjpatrol.com** (also served from https://stuartridout.github.io/patrolfinder/)

## What's here

| | |
|---|---|
| `index.html` | the whole app: quiz, reveal, result, patrol card studio, patrol wall, in five languages |
| `viewer.html` | the live wall display for the TV on the stand |
| `manifest.webmanifest`, `sw.js`, `icons/` | the PWA — installable, and the quiz runs with no signal |
| `CNAME` | the custom domain, republished on every deploy |
| `backend/` | the Azure Function App behind the tally, the patrol wall and the team's console |
| `fonts-src/` | the font files inlined in the two pages, so they can be re-embedded rather than guessed at |
| `posters/` | the A4 teaser posters and the script that builds them (not published) |

`.github/workflows/pages.yml` republishes the site to `gh-pages` on every push to `main`. Edit, merge to `main`, and the site updates itself. The CDN caches for about ten minutes.

## Patrol cards

After the result you can build a card to post: a profile picture, a 4:5 Instagram post or a 9:16 story. Add a photo and it is set on the patrol's colour with its animal and its name, in the language you took the quiz in.

**The photo never leaves the device.** It is opened and drawn onto a canvas in the browser; nothing is uploaded and nothing is stored. The one exception is deliberate and separate: adding a card to the patrol log, which is opt-in, needs an explicit tick, and is spelled out in the app before you do it.

## The patrol log

A public wall of cards people chose to share. Three rules, enforced in `backend/src/functions/api.js` rather than promised in a policy:

1. Anyone can report a card, and it comes off the wall immediately, before any human sees the report.
2. Everything is deleted seven days after the event's last day (`REUNION_ENDS`, now 2027-08-24, so 31 August 2027). A daily timer sweeps it, every read checks the cutoff, and the first request after the cutoff sweeps too.
3. Cards go up as soon as they are uploaded. Flip **Check cards before they go up** in the console and every upload waits for the team instead, and the app says so.

`REUNION_ENDS` must match in `index.html` and the Function App's settings — the app shows people the deletion date it works out from that value.

## Switching things on

Two constants at the top of the script in `index.html`. With no API the page shows an honest "not switched on yet" notice rather than failing.

| | |
|---|---|
| `API_BASE` | the Function App URL. Turns on the tally, the switches and the patrol wall |
| `REUNION_ENDS` | last day of the event, ISO. Cards go seven days later. Must match the Function App's setting of the same name |

The email sign-up for the Pavilion went with the Reunion version; the API still accepts and exports old sign-ups.

## Languages

English, French, Polish, Spanish and Arabic (right to left) live in the `STR` table in `index.html`. Only English is checked so far. The other four are drafts: a language appears in the menu only once its `ready` flag is true, and until then it is reachable by link alone (`?lang=pl`, `?lang=ar`) with a banner saying it is a draft. The water question in every language needs the Safety Team before it is marked ready. Every string falls back to English.

See `backend/README.md` to deploy it: `az login`, pick the subscription, `./deploy.sh`.

## Switching things off, mid-event

The Jamboree Team's console lives at `<api>/console`, behind a token. Four
switches, each taking effect on the next page load for everyone:

- **Patrol wall** — hides the wall everywhere and stops serving the pictures
- **Adding to the wall** — the wall stays, nobody can add to it
- **Patrol cards and photo overlay** — removes the card studio from the result
- **Check cards before they go up** — off for a private event; on holds every upload

The console also lists reported cards for review, shows the tally and which
languages the quiz is being taken in, exports the quiz runs (and any old
sign-ups) as CSV, and can start clean on the spot: delete every photo, reset the counts, clear the sign-ups, or all three.

**Is the quiz balanced?** Every completed quiz records which patrol each of the
seven answers pointed at, plus the four scores, any tie-break, the question
set and the language. The console
draws that as bars, overall and per question, and marks a question *lopsided*
when one patrol takes more than 40% or less than 12% of the answers. It holds
nothing about the person answering, and the result screen says so.

The app remembers the last state it saw, so a phone with no signal shows what
it last knew, and everything defaults to on, so an unreachable API never
accidentally hides a feature.

## DNS

`wsjpatrol.com` points at GitHub Pages, on GoDaddy nameservers:

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` (all four) |
| CNAME | `www` | `stuartridout.github.io` |

The `www` record has to point at the Pages host, **not** at your own apex.
GitHub issues one certificate covering both names, and **Enforce HTTPS stays
unavailable until both are issued** — the checkbox reverts with a red cross. A
`www` CNAME chained to the apex leaves the apex certificate fine and the `www`
one never issued, so `https://www.wsjpatrol.com` fails TLS while the apex works.
That is the symptom to recognise.

Also check there is no `CAA` record blocking Let's Encrypt. Set the custom
domain in the repo's Pages settings; if it stays stuck for hours, remove and
re-add it there to retrigger issuance, then re-run the Publish workflow, since
removing the domain deletes `CNAME` from `gh-pages`.

## Before shipping visual changes

Render real screenshots at 390x844@2x, 360 and 1440 for every state and critique them, in English and at least once in Arabic (right to left) and Polish (the longest). Do the same for the cards in all four shapes, with and without a photo, for all four patrols.
