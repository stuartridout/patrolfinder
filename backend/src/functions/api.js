/*
 * The API behind wsjpatrol.com. One HTTP function, routed by path, so the
 * whole contract lives on one page.
 *
 * Public
 *   GET  /config    which features are switched on
 *   GET  /tally     the four counts
 *   POST /tally     {patrol} -> increment, returns the counts
 *   POST /email     {email, patrol} -> stored for Pavilion co-design updates
 *   GET  /photos    cards on the wall
 *   POST /photos    multipart {patrol, photo}
 *   GET  /photo/:id the image bytes
 *   POST /report    {id} -> pulls a card off the wall for the team to look at
 *
 * The team, behind ADMIN_TOKEN
 *   GET  /console              the console, served from here
 *   GET  /console/config       POST to change a switch
 *   GET  /console/photos       every card and its status
 *   GET  /console/photo/:id    bytes for a card that is not on the wall
 *   POST /console/approve      {id} put it back up
 *   POST /console/hide         {id} take it down, keep the file
 *   POST /console/delete       {id} gone, file and all
 *   GET  /console/stats        counts and sign-up total
 *   GET  /console/signups.csv  the sign-up list
 *   POST /console/purge        delete every photo now
 *   POST /console/reset        {what: tally|signups|photos|all} start clean
 *
 * Not /admin: the Functions host reserves /admin/* for its own API, so a
 * request there is answered with a 404 before it ever reaches this function.
 *
 * Reunion is a private event, so cards go up as soon as they are uploaded.
 * Two things still hold, and both live here rather than in a policy document:
 *   1. Anyone can report a card, and it leaves the wall on the spot, before
 *      any human sees the report.
 *   2. Every photo is gone seven days after Reunion. A daily timer sweeps
 *      them, every read checks the cutoff, and the first request after the
 *      cutoff sweeps too, so the promise does not rest on the timer alone.
 * Flip the `moderate` switch and uploads wait for the team instead.
 */
const { app } = require("@azure/functions");
const store = require("../lib/store");
const { ADMIN_HTML } = require("../lib/admin-page");

const MAX_UPLOAD = 6 * 1024 * 1024;          /* 6MB: a 1080px JPEG is nowhere near this */
const UPLOADS_PER_IP_PER_HOUR = 12;

/* Rate limiting lives in memory. A consumption plan may run several instances,
   so this is a speed bump against one person hammering upload, not a security
   control. The real limits are the size cap and the magic-number check. */
const rate = new Map();

function rateHit(ip){
  const now = Date.now();
  const hour = Math.floor(now / 3600000);
  const key = ip + ":" + hour;
  for(const k of rate.keys()) if(!k.endsWith(":" + hour)) rate.delete(k);
  const used = (rate.get(key) || 0) + 1;
  rate.set(key, used);
  return used;
}

/* ALLOWED_ORIGIN may be a comma-separated list. The matching origin is echoed
   back, because "*" and a list are not the same header. */
function corsHeaders(request){
  const allowed = (process.env.ALLOWED_ORIGIN || "*").split(",").map(s => s.trim()).filter(Boolean);
  const asked = request.headers.get("origin");
  let origin = "*";
  if(!allowed.includes("*")) origin = (asked && allowed.includes(asked)) ? asked : allowed[0];
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function reunionEnds(){
  return process.env.REUNION_ENDS || "2026-09-06";
}

/* The last second of the seventh day after Reunion ends. */
function cutoffMs(){
  return Date.parse(reunionEnds() + "T23:59:59Z") + 7 * 24 * 60 * 60 * 1000;
}

function isAdmin(request){
  const token = process.env.ADMIN_TOKEN || "";
  const given = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if(!token || !given || given.length !== token.length) return false;
  /* Constant-time compare, so a wrong token cannot be found a byte at a time. */
  let diff = 0;
  for(let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

async function handler(request, context){
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const H = corsHeaders(request);

  const json = (body, status) => ({
    status: status || 200,
    headers: Object.assign({}, H, {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"}),
    jsonBody: body
  });
  const raw = (body, extra, status) => ({
    status: status || 200,
    headers: Object.assign({}, H, extra || {}),
    body: body
  });
  const gone = () => raw("not found", {"Content-Type": "text/plain"}, 404);

  if(request.method === "OPTIONS") return {status: 204, headers: H};

  /* Anything touching the API after the cutoff clears the wall, so deletion
     does not depend on the timer having fired. */
  if(Date.now() > cutoffMs()){
    context.extraOutputs = context.extraOutputs || {};
    store.purgeAllPhotos().catch(err => context.error("post-cutoff purge failed", err));
  }

  /* ---------------- what is switched on ---------------- */
  if(path === "/config" && request.method === "GET"){
    const flags = await store.readFlags();
    return json({
      wall: flags.wall, uploads: flags.uploads, cards: flags.cards,
      /* Public on purpose: the upload panel tells people whether a human
         checks their card first, and it must not say so when nobody does. */
      moderate: flags.moderate,
      reunionEnds: reunionEnds(),
      deletedAfter: new Date(cutoffMs()).toISOString()
    });
  }

  /* ---------------- tally ---------------- */
  if(path === "/tally" && request.method === "GET") return json(await store.readTally());

  if(path === "/tally" && request.method === "POST"){
    const body = await request.json().catch(() => ({}));
    const patrol = String(body.patrol || "");
    if(!store.PATROLS.includes(patrol)) return json({error: "unknown patrol"}, 400);
    await store.bumpTally(patrol);
    return json(await store.readTally());
  }

  /* ---------------- email ---------------- */
  if(path === "/email" && request.method === "POST"){
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const patrol = store.PATROLS.includes(body.patrol) ? body.patrol : null;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254){
      return json({error: "bad email"}, 400);
    }
    await store.addSignup(email, patrol);
    return json({ok: true});
  }

  /* ---------------- the wall ---------------- */
  if(path === "/photos" && request.method === "GET"){
    const flags = await store.readFlags();
    if(!flags.wall) return json({items: [], off: true});
    const rows = await store.listPhotos();
    return json({
      items: rows.filter(r => r.status === "approved").slice(0, 300).map(r => ({
        id: r.id, patrol: r.patrol, created: r.created,
        url: new URL("/photo/" + r.id, url.origin).toString()
      })),
      deletedAfter: new Date(cutoffMs()).toISOString()
    });
  }

  if(path === "/photos" && request.method === "POST"){
    if(Date.now() > cutoffMs()) return json({error: "the log is closed"}, 410);
    const flags = await store.readFlags();
    if(!flags.uploads || !flags.wall) return json({error: "uploads are switched off"}, 403);

    const ip = request.headers.get("x-forwarded-for") || "anon";
    if(rateHit(ip) > UPLOADS_PER_IP_PER_HOUR) return json({error: "too many uploads, try later"}, 429);

    const form = await request.formData().catch(() => null);
    if(!form) return json({error: "bad form"}, 400);
    const patrol = String(form.get("patrol") || "");
    const file = form.get("photo");
    if(!store.PATROLS.includes(patrol)) return json({error: "unknown patrol"}, 400);
    if(!file || typeof file === "string") return json({error: "no photo"}, 400);
    if(file.size > MAX_UPLOAD) return json({error: "photo too big"}, 413);

    const bytes = Buffer.from(await file.arrayBuffer());
    /* Trust the bytes, not the declared type: JPEG and PNG magic numbers only. */
    const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8;
    const isPng  = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
    if(!isJpeg && !isPng) return json({error: "that isn't an image"}, 415);

    const id = crypto.randomUUID().replace(/-/g, "");
    const type = isJpeg ? "image/jpeg" : "image/png";
    const status = flags.moderate ? "pending" : "approved";
    await store.putPhoto(id, patrol, status, type, bytes);
    return json({id: id, status: status}, 201);
  }

  if(path.startsWith("/photo/") && request.method === "GET"){
    const id = path.slice("/photo/".length);
    if(!/^[0-9a-f]{32}$/.test(id)) return gone();
    const flags = await store.readFlags();
    if(!flags.wall) return gone();
    const row = await store.getPhotoRow(id);
    if(!row || row.status !== "approved" || Date.now() > cutoffMs()) return gone();
    const body = await store.getPhotoBytes(id);
    if(!body) return gone();
    /* Short cache: a card pulled off the wall must disappear quickly. */
    return raw(body, {"Content-Type": row.type || "image/jpeg", "Cache-Control": "public, max-age=300"});
  }

  if(path === "/report" && request.method === "POST"){
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    if(!/^[0-9a-f]{32}$/.test(id)) return json({error: "bad id"}, 400);
    await store.reportPhoto(id);
    return json({ok: true});
  }

  /* ---------------- the team's console ---------------- */
  if(path === "/console" && request.method === "GET"){
    return raw(ADMIN_HTML, {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"});
  }

  if(path.startsWith("/console/")){
    if(!isAdmin(request)) return json({error: "no"}, 401);

    if(path === "/console/config" && request.method === "GET") return json(await store.readFlags());

    if(path === "/console/config" && request.method === "POST"){
      const body = await request.json().catch(() => ({}));
      const patch = {};
      for(const key of Object.keys(store.FLAG_DEFAULTS)) if(key in body) patch[key] = !!body[key];
      return json(await store.writeFlags(patch));
    }

    if(path === "/console/photos" && request.method === "GET"){
      const rows = await store.listPhotos();
      /* Anything reported floats to the top: it is off the wall and waiting. */
      rows.sort((a, b) => (b.status === "reported") - (a.status === "reported") || b.created - a.created);
      return json({items: rows.map(r => Object.assign({}, r, {
        url: new URL("/console/photo/" + r.id, url.origin).toString()
      }))});
    }

    if(path.startsWith("/console/photo/") && request.method === "GET"){
      const id = path.slice("/console/photo/".length);
      if(!/^[0-9a-f]{32}$/.test(id)) return gone();
      const row = await store.getPhotoRow(id);
      const body = row ? await store.getPhotoBytes(id) : null;
      if(!row || !body) return gone();
      return raw(body, {"Content-Type": row.type || "image/jpeg", "Cache-Control": "no-store"});
    }

    if(path === "/console/stats" && request.method === "GET"){
      const [tally, signups, rows] = await Promise.all([
        store.readTally(), store.listSignups(), store.listPhotos()
      ]);
      const byStatus = {};
      for(const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      return json({
        tally: tally, signups: signups.length, photos: byStatus,
        reunionEnds: reunionEnds(), deletedAfter: new Date(cutoffMs()).toISOString()
      });
    }

    if(path === "/console/signups.csv" && request.method === "GET"){
      const rows = await store.listSignups();
      const csv = ["email,patrol,signed_up"].concat(rows.map(r =>
        [r.email, r.patrol || "", new Date(r.created).toISOString()].join(",")
      )).join("\n");
      return raw(csv, {"Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store"});
    }

    if(request.method === "POST"){
      const body = await request.json().catch(() => ({}));
      const id = String(body.id || "");

      if(path === "/console/approve" || path === "/console/hide"){
        if(!/^[0-9a-f]{32}$/.test(id)) return json({error: "bad id"}, 400);
        /* hide keeps the file, so a card taken down by mistake goes back up. */
        const status = path.endsWith("approve") ? "approved" : "hidden";
        await store.setPhotoStatus(id, status);
        return json({ok: true, status: status});
      }

      if(path === "/console/delete"){
        if(!/^[0-9a-f]{32}$/.test(id)) return json({error: "bad id"}, 400);
        await store.deletePhoto(id);
        return json({ok: true});
      }

      if(path === "/console/purge"){
        const n = await store.purgeAllPhotos();
        return json({ok: true, deleted: n});
      }

      /* Clearing up after a test run, or starting the day clean. */
      if(path === "/console/reset"){
        const what = String(body.what || "");
        if(what === "tally" || what === "all") await store.resetTally();
        if(what === "signups" || what === "all") await store.clearSignups();
        if(what === "photos" || what === "all") await store.purgeAllPhotos();
        if(!["tally", "signups", "photos", "all"].includes(what)){
          return json({error: "what must be tally, signups, photos or all"}, 400);
        }
        return json({ok: true, reset: what});
      }
    }

    return json({error: "not found"}, 404);
  }

  return json({error: "not found"}, 404);
}

app.http("api", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "{*path}",
  handler: async (request, context) => {
    try{
      return await handler(request, context);
    }catch(err){
      context.error(err);
      return {
        status: 500,
        headers: Object.assign({}, corsHeaders(request), {"Content-Type": "application/json"}),
        jsonBody: {error: "server error"}
      };
    }
  }
});

module.exports = { handler, cutoffMs };
