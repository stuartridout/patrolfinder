# wsjpatrol API

The API behind [wsjpatrol.com](https://wsjpatrol.com): the patrol tally, email
sign-ups, the patrol log, and the console the Jamboree Team runs it from.

One Azure Function App on **Flex Consumption** (Node 22), plus the storage
account it needs anyway. At event scale it sits inside the free monthly
execution grant and the storage costs pennies a month.

Live at `wsjpatrol-fn.azurewebsites.net`, in resource group `rg-wsjpatrol`,
subscription "Azure subscription 1" (`cb97a694-e8c5-4332-b326-70fa7cc02420`)
in the MK Scouts tenant.

## What it stores

| Thing | Kept | Not kept |
|---|---|---|
| Tally | four running counts | who, or when |
| Quiz run | the seven answers, the four scores, the patrol, any tie-break, the time | anything about the person: no name, no IP, no device, no session |
| Sign-up | email, patrol, timestamp | anything else |
| Patrol log | image bytes, patrol, status | name, email, device, location |

A **quiz run** is one row per completed quiz saying which patrol each answer
pointed at. It exists so the quiz can be checked for bias: if the wording hands
one patrol out too often, that shows up in the answers long before anyone
notices it in the results. There is nothing in a run that ties it to a person,
and the result screen says plainly that the answers are kept and why.

Runs are deleted whenever the counts are reset, since the two are views of the
same thing and would otherwise disagree.

Photos live in a **private** blob container and are only ever served back
through the function, so the wall switch and the deletion date actually bite —
there is no public blob URL to leak past them.

## Deploy

Run this from your own machine. The MK Scouts tenant's Conditional Access
blocks device-code sign-in, so it will not work from a container or a remote
shell however many times you try the code.

Needs `az`, `zip` and `npm` (`brew install azure-cli node`).

```sh
az login
az account set --subscription cb97a694-e8c5-4332-b326-70fa7cc02420
cd backend
./deploy.sh --flex
```

**Always pass `--flex`.** Without it the script builds a classic Linux
Consumption app, which is what the live one is not, and which does not work
here at all: see below.

It shows you what it is about to create and waits for a yes. Everything lands
in one new resource group; nothing outside it is touched and nothing is
deleted. `--yes` skips the prompt.

It prints an **admin token** once. Save it — it is the only way into the
console, and it is not shown again. (`az functionapp config appsettings list`
can read it back if you have Azure access.)

Then put the printed URL into `API_BASE` at the top of the script in
`index.html`, with no trailing slash, and push to `main`.

Later code changes: `./deploy.sh --flex --code-only`.

### How the code gets there, and why not the obvious way

On Flex, `npm install` runs locally, the app is zipped with its `node_modules`,
and `az functionapp deployment source config-zip` hands it to Flex's own
deployment container. Flex registers the triggers itself. That is all.

The script still carries a classic Linux Consumption path, without `--flex`.
Do not use it. It is kept only because it documents an evening of failure:

- A Linux Consumption app has only a stub of a Kudu/SCM site. It answers 503
  from the moment the app is created, before anything is deployed to it, and
  never warms up. That takes down `config-zip --build-remote`, `func azure
  functionapp publish`, and `syncfunctiontriggers` alike.
- `az` itself crashes with a `JSONDecodeError` on that path, because it reads
  app settings back from SCM and gets an HTML error page instead of JSON.
- Run-from-package (a SAS link in `WEBSITE_RUN_FROM_PACKAGE`) does get the code
  in place without touching SCM, and the classic path here does that. It still
  never booted: the host emitted no telemetry at all across three successful
  uploads by three different mechanisms.

Flex worked first time. If you are ever tempted by classic Consumption, do not
read a 503 on a freshly created resource as provisioning lag.

Overridable with environment variables: `RG`, `LOCATION`, `APP`, `STORAGE`,
`REUNION_ENDS`, `ALLOWED_ORIGIN`, `ADMIN_TOKEN`.

`REUNION_ENDS` must match the value in `index.html`. The app shows people the
deletion date it computes from that value, so if the two disagree the app is
telling people something the server will not do.

## The console

`https://<app>.azurewebsites.net/console`, served by the API itself. Paste the
admin token once and the browser remembers it. It works on a phone, which is
where it will actually be used.

**Switches.** Each takes effect on the next page load for everyone:

| Switch | Off means |
|---|---|
| Patrol wall | the wall is hidden everywhere and the pictures stop being served |
| Adding to the wall | the wall stays visible but nobody can add to it |
| Patrol cards and photo overlay | the card studio disappears from the result screen |
| Check cards before they go up | *off* for a private event: cards appear straight away. On holds every upload for the team |

The app keeps the last known answer, so a phone with no signal shows the state
it last saw rather than a blank screen. All three default to on, so an
unreachable API never accidentally hides the thing.

**Reported cards.** Anyone can report a card from the wall. It comes off
immediately, before any human sees the report, and lands at the top of the
console. From there: *Put back*, *Take down* (keeps the file, reversible), or
*Delete* (gone).

**Numbers.** The tally, the sign-up count, how many cards are up, how many
quiz runs are recorded, and CSV exports of the sign-ups and of every run.

**Is the quiz balanced?** How often each patrol was chosen, overall and per
question, as four bars. Even bars mean no patrol is being handed out by the
wording. Anything above 40% or below 12% of a bar is marked *lopsided*, which
is the question to go and read. The runs CSV has the per-run detail if you want
to pivot it properly.

**Start clean.** Behind a typed confirmation: delete every photo, reset the
four counts, clear the sign-up list, or all three. Use it to clear up after
testing, and again on Reunion morning so the numbers people see are the day's
own.

## Endpoints

Public:

| Method | Path | |
|---|---|---|
| GET | `/config` | which features are switched on |
| GET | `/tally` | the four counts |
| POST | `/tally` | `{patrol}` — increment. Optional `answers`, `scores`, `tied` record the run |
| POST | `/email` | `{email, patrol}` |
| GET | `/photos` | cards on the wall |
| POST | `/photos` | multipart `patrol` + `photo` |
| GET | `/photo/:id` | image bytes |
| POST | `/report` | `{id}` — pulls a card off the wall |

Behind `Authorization: Bearer <ADMIN_TOKEN>`. Note `/console`, not `/admin`:
the Functions host reserves `/admin/*` for its own API and answers 404 there
before a request reaches the app.

| Method | Path | |
|---|---|---|
| GET | `/console` | the console (no token needed to load the page itself) |
| GET/POST | `/console/config` | read or change the switches |
| GET | `/console/photos` | every card and its status |
| GET | `/console/photo/:id` | bytes for a card that is not on the wall |
| POST | `/console/approve` `/console/hide` `/console/delete` | `{id}` |
| GET | `/console/stats` | counts and sign-up total |
| GET | `/console/signups.csv` | the sign-up list |
| GET | `/console/runs.csv` | every quiz run: answers, scores, patrol, tie-break |
| POST | `/console/purge` | delete every photo now |
| POST | `/console/reset` | `{what: tally\|runs\|signups\|photos\|all}` — start clean |

## Deletion

The app promises people a date, so it is kept three ways rather than one:

1. a daily timer sweeps the log once the cutoff has passed;
2. every read checks the cutoff, so nothing is served after the date even if
   the sweep has not run;
3. the first request to arrive after the cutoff kicks off a sweep itself.

Plus **Start clean** in the console for right now.

## Running it locally

```sh
npm install
npm install -g azure-functions-core-tools@4 --unsafe-perm true
echo '{"IsEncrypted":false,"Values":{"AzureWebJobsStorage":"UseDevelopmentStorage=true","FUNCTIONS_WORKER_RUNTIME":"node","ADMIN_TOKEN":"local-dev-token","ALLOWED_ORIGIN":"*"}}' > local.settings.json
func start
```

Needs Azurite for the storage emulator (`npm install -g azurite`, then
`azurite` in another terminal).
