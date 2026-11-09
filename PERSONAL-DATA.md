# Patrol Finder: personal data

The personal data specification for Patrol Finder (wsjpatrol.com, its API and the wall viewer). It says what the app collects, why, where it goes, who can see it and when it is deleted. The UK Pavilion DPIA draws on it (dev-hq, `areas/uk-pavilion-dpia.md`).

Written 9 Nov 2026 from the code at that date. Rule: this file changes before the storage does, never after. The app's own screens say the same things in five languages, and they change at the same time.

## In one paragraph

Patrol Finder is a quiz. It doesn't ask who you are. It collects no name, no email, no account, no location and no device identifier. The only personal data it can hold is a card someone chooses to put on the patrol wall. That is opt-in with an explicit tick, visible to everyone at the stand, reportable by anyone, and deleted on 31 August 2027 by code rather than by promise.

## Who the data is about

- Visitors to the UK Pavilion who take the quiz. Mostly Jamboree participants aged 14 to 17. Also adults (IST, leaders, visitors, dignitaries) and families with younger children.
- Anyone who scans a poster QR or takes the quiz online before or after the event.
- Anyone who appears in a wall card photo, who may not be the person who uploaded it.

## What is collected

| Item | Personal data? | Collected when | Why | Stored where | Who can see it | Deleted |
|---|---|---|---|---|---|---|
| Tally: four running counts, one per patrol | No | Every completed quiz | The "how everyone is splitting" bar | Azure Table Storage `tally`, UK South | Everyone (public API) | Reset from the console |
| Quiz run: the seven answers as patrol names, four scores, the result, any tie-break, question set, language, time to the millisecond | No. Nothing about the person | On finishing the quiz | To check the quiz isn't biased towards a patrol | Table `runs`, UK South | The team (console bars and CSV) | When the counts are reset. Proposed: reset after the Jamboree once the bias check is exported |
| Wall card: a JPEG or PNG rendered on the phone, usually a face, with the name and one line the person typed, plus the patrol | Yes. An image of a person, often a child, and a typed name | Only on tapping "Add me to the wall" after ticking the consent box | The patrol wall: the TV at the stand (`viewer.html`) and the wall screen in the app | Private Blob container `photos` and a Table `photos` row (id, patrol, status, type, created, reports). UK South | Anyone, while the card is approved and the wall switch is on. The team sees every card and status | 7 days after `REUNION_ENDS` (2027-08-24), so 31 Aug 2027. Sooner if reported or deleted |
| Report: the id of a card | No | Tapping the flag on a card | Takes the card off the wall at once for the team to look at | `status` and `reports` on the card's row | The team | With the card |
| Upload rate limit key: requester IP and the hour | Yes, transiently | On uploading a card | 12 uploads per IP per hour | The function's memory only. Never written to storage | Nobody | Within the hour, or on restart |
| Legacy sign-up: email, patrol, time | Yes | The Gilwell Reunion 2026 version of the app. The screen is gone, the API endpoint remains | Pavilion co-design updates | Table `signups`, UK South | The team (console CSV) | No automatic deletion. See open points |
| On the phone: chosen language (`pf.lang`), last known switches (`pf.flags`), the service worker's cache of the app | No | While using the app | Open in your language, work with no signal | The person's own browser | The person | When they clear site data |
| Platform logs: Function App logs and Application Insights request telemetry | Weakly. Azure Monitor drops client IPs by default (`0.0.0.0` after geolocation) | Every request | Operations | Azure Monitor, UK South | Azure subscription users | Default 90 days. Confirm `DisableIpMasking` is not set |
| GitHub Pages access logs for the static site | Weakly (IP, user agent) | Every page load | GitHub's own operations | GitHub | GitHub, under its privacy statement. Not visible to us | GitHub's policy |

## What is not collected, on purpose

- No name, email, account, sign-in, cookie banner, analytics or tracking. No third-party scripts, fonts or CDNs. Everything the page needs is embedded in `index.html`.
- The card is composed on the phone. The photo never leaves the device unless the person joins the wall. The screen says so: "Your photo stays on your phone" and "never sent to us unless you join the wall".
- The card is drawn through a canvas, so EXIF data including GPS doesn't survive into the upload.
- A quiz run carries no IP, device, session or user agent. The result screen says: "We keep your answers only, nothing about you, to check the quiz is fair."

## Lawful basis (proposed, for the controller to confirm)

- Tally and quiz runs: not personal data. If the controller prefers to treat them as personal data, legitimate interests (running a fair activity).
- Wall cards: consent, given by the tick "Yes, put my card on the wall. It's optional." after four facts are shown in the person's language: anyone can see it, when it goes up (straight away, or checked first), anyone can report it, and the date everything is deleted. Withdrawal: report the card from the wall, which takes it down at once, or ask the stand team. Most participants are 14 to 17 and can consent for themselves under UK law. Younger visitors come with an adult, and the stand team should be briefed to involve the adult.
- Legacy sign-ups: consent at the time. The purpose has lapsed. Delete.

## Where the data goes

- Phone or laptop to `wsjpatrol.com` (GitHub Pages, static files only).
- Phone to `wsjpatrol-fn.azurewebsites.net` (Azure Functions, Flex Consumption, UK South) to Table Storage and the private Blob container (UK South). Cards are only ever served back through the function, which checks the wall switch, the card's status and the deletion date on every read.
- The TV at the stand loads `viewer.html` and polls the API for approved cards.
- The team's console talks to the API with a bearer token.

The data is collected in Poland at the Jamboree and stored in the UK. No personal data goes to any other country or third party.

## Who has access

- Everyone: approved wall cards, the four counts, which switches are on.
- The team: the console behind `ADMIN_TOKEN`, compared in constant time. The token is printed once by `backend/deploy.sh` and held in the Function App's settings. Held by Stuart Ridout as of 9 Nov 2026. Handover to the stand team is planned.
- Anyone with access to the Azure subscription that hosts resource group `rg-wsjpatrol` (the Milton Keynes District Scouts tenant, per-user MFA).
- Microsoft, as processor.

## Retention and deletion

- Wall cards: deleted 7 days after `REUNION_ENDS`. Three mechanisms keep the promise: a daily timer at 03:17 UTC, a cutoff check on every read, and a sweep kicked off by the first request after the cutoff. The console can delete one card or purge all. A report takes a card off the wall before any human sees it.
- `REUNION_ENDS` must be the same in `index.html` and the Function App's settings, because the app shows people the date it computes. The live API still carried the old Reunion date on 31 Oct 2026, so every upload was refused. Redeploy with 2027-08-24 and check `/config` returns `deletedAfter` of 31 Aug 2027.
- Runs and tally: reset from the console. Proposed: reset after the Jamboree once the runs CSV is exported for the bias check.
- Legacy sign-ups: reset from the console. Proposed: now.
- Logs: Azure Monitor defaults, about 90 days.
- Backups: none, deliberately. The promise is deletion, and a backup would outlive it.

## Security

- HTTPS only. Storage account has blob public access off and a minimum of TLS 1.2. Cards sit in a private container with no public URL. Served images carry a 5-minute cache so a pulled card disappears quickly.
- Uploads: 6 MB cap, JPEG or PNG checked by magic number not declared type, 12 per IP per hour, refused when the uploads or wall switch is off and after the deletion date.
- Admin: bearer token, constant-time comparison, console over HTTPS, no token in a URL.
- CORS allowlist: `wsjpatrol.com`, `www.wsjpatrol.com`, `stuartridout.github.io`.
- Encryption at rest: Azure Storage service encryption, Microsoft-managed keys.
- Known gaps: one shared admin token rather than named accounts, no log of who read the console, no penetration test.

## People's rights

- To see or remove a wall card: report it from the wall (instant takedown), or ask the stand team, who delete it from the console. A card is identified by what it shows, so no identity check is needed.
- Quiz runs identify nobody, so there is nothing to return or erase.
- The screens carry the facts. A fuller privacy notice (who the controller is, how to contact them, the rights) should be linked from the app and shown at the stand. It doesn't exist yet.

## Open points

1. Delete the legacy sign-ups from the console and remove `POST /email` from the API.
2. Redeploy the API with `REUNION_ENDS=2027-08-24`.
3. Decide who holds the admin token at the Jamboree, and rotate it afterwards.
4. Link the controller's privacy notice from the app footer and the stand.
5. Decide whether the `moderate` switch is on at the Jamboree. Reunion was a private event. The Jamboree isn't, so the recommendation is on.
6. Decide whether run timestamps are rounded to the hour. It costs nothing and removes the one field that could be matched to a person standing at the stand.
