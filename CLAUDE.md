# patrolfinder

Quiz SPA sorting people into the four 1907 Brownsea patrols (Wolves, Bulls, Curlews, Ravens). Promotes the UK Pavilion at Gilwell Reunion ahead of the 26th World Scout Jamboree, Poland 2027. Lives at wsjpatrol.com.

The app is still one file: `index.html`, no build step, official logos embedded as data URIs, all screens JS-rendered into `#app`. It is no longer the only file. A PWA needs real URLs, so `manifest.webmanifest`, `sw.js`, `icons/` and `CNAME` ship alongside it, and `backend/` holds the Azure Function App. The Publish workflow ships exactly that set and nothing else.

Rules that matter:
- Patrol colours and 1907 rosters are historical and verified. Do not change them. Keep "probably" on Simon Rodney and keep the honesty footer.
- Question wording belongs to the people who own it. Q6 (water) is the Safety Team's wording, verbatim. Do not tidy it.
- Official logo rules: Poland 2027 lockup on a clean light background (it lives on the white masthead bar), never rotated, recoloured or crowded. Scouts fleur 38px or more.
- Result banners re-ink per flood: white plate with patrol-colour type, navy plate on Curlews yellow. Never one fixed plate colour. The patrol cards follow the same rule: on a photo the plate is the patrol colour, on the patrol's own flood it goes cream.
- Curlews yellow is never used as type on cream. `PATROL_INK` carries the darkened version for text; `PATROL_HEX` stays historical.
- The patrol card is drawn in the browser and the photo never leaves the device. Say so plainly on the screen, in words a fourteen-year-old reads once and believes. If that ever stops being true, the copy changes first.
- The patrol log is opt-in, reportable by anyone, and deleted seven days after Reunion. All of it is enforced in `backend/src/functions/api.js`, not promised in a policy. `REUNION_ENDS` must match in `index.html` and the Function App's settings, because the app shows people the date it computes.
- Reunion is private, so cards go up straight away. The `moderate` switch turns human checking back on, and the upload panel's wording is driven by that switch: if nobody is checking, the app does not say anyone is.
- Four switches (`wall`, `uploads`, `cards`, `moderate`) live in the team's console at `<api>/console`. The app defaults every one to on and caches the last known answer, so an unreachable API never hides a feature and a phone with no signal shows what it last knew. Anything a switch hides needs `data-needs`, and `[hidden]` needs `!important` here because half the layout sets `display`.
- `API_BASE`, `EMAIL_ENDPOINT` and `REUNION_ENDS` at the top of the script are the only switches. Every one degrades to an honest notice when empty. Never fake a number: the tally only draws when the API answers.
- Bump `CACHE` in `sw.js` whenever `index.html` changes, or returning visitors keep the old copy.
- Deploys: push to `main`, the Publish workflow rewrites `gh-pages`, GitHub Pages serves it at wsjpatrol.com. CDN caches about 10 minutes.
- Before shipping visual changes, render real screenshots at 390x844@2x, 360 and 1440 for every state and critique them, plus all three card sizes x four patrols x with and without a photo. `bin`-less: the harness lives in the session scratchpad pattern (playwright, a mock API on a second port, axe-core, forced states via `renderResult(id)` / `renderCardStudio(id)` / `renderLog()`).

## Status

Last: 28 Aug 2026 - Feedback pass plus a big interactivity build. Q1/Q2 swapped into time order, Q6 water wording replaced with the Safety Team's own, Q7 says "patrol", closing copy points at the International Tent. Then: favicon and installable PWA, a patrol tally (counts only), email capture wired to the same API, share that actually shares a generated patrol card, a card studio with profile/4:5/9:16 formats and on-device photo compositing, and an opt-in patrol log with reporting and a seven-day deletion. Then the team's console: four live switches (wall, uploads, card studio, moderation), reported-card review, tally and sign-up numbers, CSV export and a purge, served from the API at /admin. Backend rewritten for Azure Functions on the MK Scouts subscription, tested end to end against in-memory stubs, not yet deployed. Zero axe violations across all six app screens and both console states. Moved to wsjpatrol.com.
Next: Deploy to Azure subscription "Azure subscription 1" (cb97a694-e8c5-4332-b326-70fa7cc02420) in the MK Scouts tenant - `backend/README.md`, then paste the URL into `API_BASE`. Reunion ending 6 Sep 2026 is confirmed, so the deletion date shown to people is 13 Sep. Then point wsjpatrol.com DNS at Pages and turn on Enforce HTTPS. Hand the admin token to whoever is on the stand, and show them the switches before the day rather than during it.
