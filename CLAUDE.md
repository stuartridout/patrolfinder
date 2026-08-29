# patrolfinder

Quiz SPA sorting people into the four 1907 Brownsea patrols (Wolves, Bulls, Curlews, Ravens). Promotes the UK Pavilion at Gilwell Reunion ahead of the 26th World Scout Jamboree, Poland 2027. Lives at wsjpatrol.com.

The app is still one file: `index.html`, no build step, official logos embedded as data URIs, all screens JS-rendered into `#app`. It is no longer the only file. A PWA needs real URLs, so `manifest.webmanifest`, `sw.js`, `icons/` and `CNAME` ship alongside it, and `backend/` holds the Azure Function App. The Publish workflow ships exactly that set and nothing else.

Rules that matter:
- Patrol colours and 1907 rosters are historical and verified. Do not change them. Keep "probably" on Simon Rodney and keep the honesty footer.
- Question wording belongs to the people who own it. Q6 (water) is the Safety Team's wording, verbatim. Do not tidy it.
- Official logo rules: Poland 2027 lockup on a clean light background (it lives on the white masthead bar), never rotated, recoloured or crowded. Scouts fleur 38px or more.
- The reveal is held back a beat: the seventh answer lands on "Almost there", which carries the Pavilion call to action, and the patrol only appears when someone asks for it. The run is recorded on that screen, not at the reveal, so the count is of finished quizzes either way. Never flood that screen in a patrol colour - it would give the answer away.
- Every screen change starts at the top. `toTop()` is called first in every render function.
- White panels on a patrol flood (`.card`, `.cardcta`, `.wallcta`) must all be in the `:is(...)` button rules, or their buttons inherit the flood's white-on-transparent treatment and vanish on white.
- No `opacity` on text sitting on a patrol flood. It composites the whole subtree and a child cannot set it back. Bulls green is the tight one: cream at .9 lands at 4.46:1. Scan all four floods, not just Wolves and Curlews.
- Result banners re-ink per flood: white plate with patrol-colour type, navy plate on Curlews yellow. Never one fixed plate colour. The patrol cards follow the same rule: on a photo the plate is the patrol colour, on the patrol's own flood it goes cream.
- Curlews yellow is never used as type on cream. `PATROL_INK` carries the darkened version for text; `PATROL_HEX` stays historical.
- Audience: Gilwell Reunion is adult Scouters. The Jamboree it promotes is for 14-17s, so some copy will be read by both. Plain language serves both; policy register serves neither.
- The patrol card is drawn in the browser and the photo never leaves the device. Say so plainly on the screen, in words anyone reads once and believes rather than parses. If that ever stops being true, the copy changes first.
- The patrol log is opt-in, reportable by anyone, and deleted seven days after Reunion. All of it is enforced in `backend/src/functions/api.js`, not promised in a policy. `REUNION_ENDS` must match in `index.html` and the Function App's settings, because the app shows people the date it computes.
- Reunion is private, so cards go up straight away. The `moderate` switch turns human checking back on, and the upload panel's wording is driven by that switch: if nobody is checking, the app does not say anyone is.
- Four switches (`wall`, `uploads`, `cards`, `moderate`) live in the team's console at `<api>/console`. The app defaults every one to on and caches the last known answer, so an unreachable API never hides a feature and a phone with no signal shows what it last knew. Anything a switch hides needs `data-needs`, and `[hidden]` needs `!important` here because half the layout sets `display`.
- Every completed quiz records its seven answers, the four scores and any tie-break, so the quiz can be checked for bias. It records nothing about the person. The result screen says what is kept and why, and that sentence changes before the storage does, not after. Resetting the counts deletes the runs with them.
- `API_BASE`, `EMAIL_ENDPOINT` and `REUNION_ENDS` at the top of the script are the only switches. Every one degrades to an honest notice when empty. Never fake a number: the tally only draws when the API answers.
- The photo is reframed on the picture itself: one finger drags, two pinch, the wheel zooms on a laptop. There is no zoom slider - it sat under the picture and people missed it. The canvas is focusable and takes arrows and +/- so the keyboard keeps both.
- A card on the wall carries no patrol label over it. The card already says its patrol in its own type, and the pill landed on the word.
- The Report control is a transparent 44px button with the pill on a span inside it. Painting the button itself and clipping to the content box gives a pill exactly as wide as the word, and the rounded ends bite into the letters.
- The five patrol filters share the row equally and never wrap. "Curlews" sets the width.
- The 120 postmark carries the place over the top and the date under the foot, both on the band between its two rings, with "120 YEARS" centred inside. It is drawn twice - `POSTMARK` as SVG for the screen, `drawPostmark` on canvas for the cards - and the two must be changed together or they drift apart.
- `arcText`'s `outward` flag is not cosmetic. A top arc and a bottom arc sweep opposite ways round the circle, and getting it wrong does not look broken, it looks upside down.
- Nothing on a panel card is laid out against a fixed column. `roomFor()` asks how far a line may run at that line's own height, because the roundel is a disc and a line below it has more room than one beside it.
- The link is a pill in the panel's bottom right corner, not the last line of the stack. Taking it out of the stack is what drops the text far enough to clear the torn edge, which wobbles by `W*0.026` and used to reach the eyebrow.
- No ribbon on the card studio: its banner is a full-width white bar at the top and the two whites read as one torn shape.
- Every upload to the wall is rendered in the `wall` format whatever is on screen, so the wall is one design rather than three cropped square. It carries the patrol name, the animal and "Brownsea 1907" and stops: a wall card is looked at about 170px wide.
- The wall panel is an invitation, not a consent form. All the facts are still on it - anyone can see it, when it goes up, when it is deleted, that it is optional - as calm chips beside real cards from the wall. If it ever reads like a warning again, nobody will use it.
- `panelFraction()` is the single definition of how much of a panel card is cream. The drawing and the pan clamp both need it and they drifted apart once.
- The icon is Baden-Powell in his campaign hat, traced from the silhouette Stuart supplied, cropped to the head and shoulder and bled off the bottom edge. It is not original artwork and it is not drawn from scratch - that was tried, and a hand-drawn head in a wide-brimmed hat turns into a plague doctor's mask at icon size. `icons/favicon.svg` carries the path and the two framings the eight PNGs are rendered at; never hand-edit the PNGs.
- Bump `CACHE` in `sw.js` whenever `index.html` changes, or returning visitors keep the old copy.
- Deploys: push to `main`, the Publish workflow rewrites `gh-pages`, GitHub Pages serves it at wsjpatrol.com. CDN caches about 10 minutes.
- Before shipping visual changes, render real screenshots at 390x844@2x, 360 and 1440 for every state and critique them, plus all three card sizes x four patrols x with and without a photo. `bin`-less: the harness lives in the session scratchpad pattern (playwright, a mock API on a second port, axe-core, forced states via `renderResult(id)` / `renderCardStudio(id)` / `renderLog()`).

## Status

Last: 29 Aug 2026 - Fourth phone review. On the Instagram cards the link is now a pill in the bottom right corner rather than the last line of the stack, which lets the whole text block drop far enough to clear the torn edge - it wobbles by W*0.026 and could reach the eyebrow. The two lines that end up beside the pill are measured against it, the same way every line is already measured against the roundel. The icon is Baden-Powell again, but traced from Stuart's own silhouette rather than drawn from scratch, cropped to the head and shoulder and bled off the bottom; the hand-drawn attempt read as a plague doctor's mask and no amount of redrawing was going to fix the subject.
Next: Use Start clean in the console to clear the pre-event test data, delete the dead wsjpatrol-api app, and hand the admin token to whoever is on the stand and show them the four switches before the day, not during it.
