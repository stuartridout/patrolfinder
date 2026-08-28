# patrolfinder API

One Cloudflare Worker behind everything in `index.html` that needs a server:
the patrol tally, email sign-up, and the patrol log.

Everything it uses is on Cloudflare's free plan. No card needed: D1 for the
counts, the sign-ups and the photo metadata, Workers KV for the image bytes.

## What it stores

| Thing | Kept | Not kept |
|---|---|---|
| Tally | four running counts | which answers led there, when, or who |
| Sign-up | email, patrol, timestamp | anything else |
| Patrol log | image bytes, patrol, status | name, email, device, location |

Uploads are rate-limited per IP for an hour at a time. The IP is used as a
short-lived counter key and is never written to the database.

## Deploy

```sh
npm install -g wrangler
wrangler login

wrangler d1 create patrolfinder            # copy the id into wrangler.toml
wrangler kv namespace create IMAGES        # copy the id into wrangler.toml
wrangler d1 execute patrolfinder --remote --file=schema.sql

wrangler secret put ADMIN_TOKEN            # any long random string
wrangler deploy
```

Then put the deployed URL into `API_BASE` at the top of `index.html`, with no
trailing slash, and push to `main`.

Set `REUNION_ENDS` in `wrangler.toml` and in `index.html` to the same date.
The app shows people the deletion date it computes from that value, so if the
two disagree the app is telling people something the server will not do.

## Endpoints

| Method | Path | |
|---|---|---|
| GET | `/tally` | the four counts |
| POST | `/tally` | `{patrol}` — increment |
| POST | `/email` | `{email, patrol}` |
| GET | `/photos` | approved cards |
| POST | `/photos` | multipart `patrol` + `photo` — goes into the queue |
| GET | `/photo/:id` | image bytes, approved only |
| POST | `/report` | `{id}` — pulls a card off the wall |

## Running the wall at Reunion

Nothing appears publicly until someone releases it. With `ADMIN_TOKEN` in
`$T` and the Worker URL in `$API`:

```sh
curl -H "Authorization: Bearer $T" $API/admin/pending
curl -H "Authorization: Bearer $T" -H 'content-type: application/json' \
     -d '{"id":"..."}' $API/admin/approve
curl -H "Authorization: Bearer $T" -H 'content-type: application/json' \
     -d '{"id":"..."}' $API/admin/hide      # also deletes the bytes
```

`GET /admin/photo/:id` shows a pending card so you can look before releasing it.

A reported card is pulled off the wall the moment anyone taps Report, before
any human sees the report. Releasing it again is a deliberate act.

## Deletion

`POST /admin/purge` deletes every photo immediately. Otherwise the daily cron
does it once `REUNION_ENDS` + 7 days has passed, the KV entries carry an
expiry set to the same moment, and every read checks the cutoff. Three
independent belts, because the app promises people a date.
