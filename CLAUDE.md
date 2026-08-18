# patrolfinder

Single-file quiz SPA sorting people into the four 1907 Brownsea patrols (Wolves, Bulls, Curlews, Ravens). Promotes the UK Pavilion at Gilwell Reunion ahead of the 26th World Scout Jamboree, Poland 2027. Everything lives in `index.html`: no build step, official logos embedded as data URIs, all screens JS-rendered into `#app`.

Rules that matter:
- Patrol colours and 1907 rosters are historical and verified. Do not change them. Keep "probably" on Simon Rodney and keep the honesty footer.
- Official logo rules: Poland 2027 lockup on a clean light background (it lives on the white masthead bar), never rotated, recoloured or crowded. Scouts fleur 38px or more.
- Result banners re-ink per flood: white plate with patrol-colour type, navy plate on Curlews yellow. Never one fixed plate colour.
- `EMAIL_ENDPOINT` at the top of the script switches on email capture. Empty means the not-wired notice shows.
- Deploys: push to `main`, the Publish workflow rewrites `gh-pages`, GitHub Pages serves it. CDN caches about 10 minutes.
- Before shipping visual changes, render real screenshots at 390x844@2x, 360 and 1440 for every state and critique them. `bin`-less: the harness from the 18 Aug session lives in the session scratchpad pattern (playwright, seeded shuffle, forced results via `answers`/`renderResult`).

## Status

Last: 18 Aug 2026 - Claude-chat v6 design taken through a gauntlet loop: four rounds of blind screenshot critique against the previous build, 26 blind picks for the new one, zero axe violations, 44px targets everywhere. Masthead moved to its own white bar so nothing bleeds behind the lockup, result banners re-inked per flood, real desktop layouts added, email error states made unmissable. Live at https://stuartridout.github.io/patrolfinder/ with Stuart's GitHub uploads merged into history.
Next: Wire EMAIL_ENDPOINT to a form service before Reunion - Formspree free caps at 50 a month, so pick Getform, Basin or a Google Form, then test success, error and invalid states.
