# wsjpatrol API

The API behind [wsjpatrol.com](https://wsjpatrol.com): the patrol tally, email
sign-ups, the patrol log, and the console the Jamboree Team runs it from.

One Azure Function App on the Consumption plan (Linux, Node 24), plus the
storage account it needs anyway. At event scale it sits inside the free monthly execution grant
and the storage costs pennies a month.

## What it stores

| Thing | Kept | Not kept |
|---|---|---|
| Tally | four running counts | which answers led there, when, or who |
| Sign-up | email, patrol, timestamp | anything else |
| Patrol log | image bytes, patrol, status | name, email, device, location |

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
./deploy.sh
```

It shows you what it is about to create and waits for a yes. Everything lands
in one new resource group; nothing outside it is touched and nothing is
deleted. `--yes` skips the prompt.

It prints an **admin token** once. Save it — it is the only way into the
console, and it is not shown again. (`az functionapp config appsettings list`
can read it back if you have Azure access.)

Then put the printed URL into `API_BASE` at the top of the script in
`index.html`, with no trailing slash, and push to `main`.

Later code changes: `./deploy.sh --code-only`.

### How the code gets there

Run-from-package: `npm install` runs locally, the whole thing is zipped with
its `node_modules`, uploaded to a `deployments` container in the storage
account, and `WEBSITE_RUN_FROM_PACKAGE` is pointed at a read-only SAS link to
that blob. The app mounts it read-only and restarts.

The obvious-looking alternative, `az functionapp deployment source config-zip
--build-remote`, does not work here. A Linux Consumption app has only a stub of
a Kudu/SCM site, so the server-side npm install has nothing to run on: the
deployment endpoint answers 503 indefinitely, and the CLI itself crashes with a
JSONDecodeError when it tries to read app settings back from SCM and gets an
HTML error page. Run-from-package never touches SCM.

Setting `WEBSITE_RUN_FROM_PACKAGE` is not on its own enough: the platform also
has to be told what triggers the package contains, which `config-zip` would
have done for you. Without that POST to `syncfunctiontriggers` the scale
controller has nothing to start, `az functionapp function list` answers Bad
Request, and the app returns 503 to everything however long you wait. The
script does it and retries.

Old packages stay in the container. Delete them when you like; the app only
ever reads the one the setting points at.

Overridable with environment variables: `RG`, `LOCATION`, `APP`, `STORAGE`,
`REUNION_ENDS`, `ALLOWED_ORIGIN`, `ADMIN_TOKEN`.

`REUNION_ENDS` must match the value in `index.html`. The app shows people the
deletion date it computes from that value, so if the two disagree the app is
telling people something the server will not do.

## The console

`https://<app>.azurewebsites.net/admin`, served by the API itself. Paste the
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

**Numbers.** The tally, the sign-up count, how many cards are up, and a CSV of
the sign-up list.

**Delete everything.** Every photo, now, behind a typed confirmation.

## Endpoints

Public:

| Method | Path | |
|---|---|---|
| GET | `/config` | which features are switched on |
| GET | `/tally` | the four counts |
| POST | `/tally` | `{patrol}` — increment |
| POST | `/email` | `{email, patrol}` |
| GET | `/photos` | cards on the wall |
| POST | `/photos` | multipart `patrol` + `photo` |
| GET | `/photo/:id` | image bytes |
| POST | `/report` | `{id}` — pulls a card off the wall |

Behind `Authorization: Bearer <ADMIN_TOKEN>`:

| Method | Path | |
|---|---|---|
| GET | `/admin` | the console (no token needed to load the page itself) |
| GET/POST | `/admin/config` | read or change the switches |
| GET | `/admin/photos` | every card and its status |
| GET | `/admin/photo/:id` | bytes for a card that is not on the wall |
| POST | `/admin/approve` `/admin/hide` `/admin/delete` | `{id}` |
| GET | `/admin/stats` | counts and sign-up total |
| GET | `/admin/signups.csv` | the sign-up list |
| POST | `/admin/purge` | delete every photo now |

## Deletion

The app promises people a date, so it is kept three ways rather than one:

1. a daily timer sweeps the log once the cutoff has passed;
2. every read checks the cutoff, so nothing is served after the date even if
   the sweep has not run;
3. the first request to arrive after the cutoff kicks off a sweep itself.

Plus **Delete everything** in the console for right now.

## Running it locally

```sh
npm install
npm install -g azure-functions-core-tools@4 --unsafe-perm true
echo '{"IsEncrypted":false,"Values":{"AzureWebJobsStorage":"UseDevelopmentStorage=true","FUNCTIONS_WORKER_RUNTIME":"node","ADMIN_TOKEN":"local-dev-token","ALLOWED_ORIGIN":"*"}}' > local.settings.json
func start
```

Needs Azurite for the storage emulator (`npm install -g azurite`, then
`azurite` in another terminal).
