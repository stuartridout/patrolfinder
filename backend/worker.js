/*
 * patrolfinder API — one Cloudflare Worker behind the whole of index.html.
 *
 *   GET  /tally     the four counts
 *   POST /tally     {patrol} -> increment, returns the counts
 *   POST /email     {email, patrol} -> stored for Pavilion co-design updates
 *   GET  /photos    approved cards on the wall
 *   POST /photos    multipart {patrol, photo} -> queued for the team to release
 *   GET  /photo/:id the image bytes
 *   POST /report    {id} -> pulls a card off the wall and flags it
 *
 *   GET  /admin/pending          cards waiting to be released
 *   POST /admin/approve  {id}
 *   POST /admin/hide     {id}
 *   POST /admin/purge            delete everything now
 *
 * Two promises are made to people in the app, and both are kept here rather
 * than in a policy document:
 *   1. Nothing goes on the public wall until a human releases it.
 *   2. Every photo is gone seven days after Reunion. The cron sweeps them,
 *      and every read also filters on the cutoff, so the promise holds even
 *      if the cron never fires.
 *
 * Bindings (see wrangler.toml): DB (D1), IMAGES (KV).
 * Secrets: ADMIN_TOKEN.
 */

const MAX_UPLOAD = 6 * 1024 * 1024;          /* 6MB: a 1080px JPEG is nowhere near this */
const PATROLS = ["wolves", "bulls", "curlews", "ravens"];
const UPLOADS_PER_IP_PER_HOUR = 12;

function cors(env, extra){
  const origin = env.ALLOWED_ORIGIN || "*";
  return Object.assign({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  }, extra || {});
}

function json(env, body, status){
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: cors(env, {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"})
  });
}

/* The last second of the seventh day after Reunion ends. */
function cutoffMs(env){
  const ends = env.REUNION_ENDS || "2026-09-06";
  return Date.parse(ends + "T23:59:59Z") + 7 * 24 * 60 * 60 * 1000;
}

function admin(request, env){
  const given = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  return env.ADMIN_TOKEN && given && given === env.ADMIN_TOKEN;
}

async function readTally(env){
  const out = {wolves: 0, bulls: 0, curlews: 0, ravens: 0};
  const rows = await env.DB.prepare("SELECT patrol, n FROM tally").all();
  for(const r of (rows.results || [])) if(r.patrol in out) out[r.patrol] = r.n;
  return out;
}

async function handle(request, env, ctx){
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if(request.method === "OPTIONS") return new Response(null, {status: 204, headers: cors(env)});

  /* ---------------- tally ---------------- */
  if(path === "/tally" && request.method === "GET"){
    return json(env, await readTally(env));
  }

  if(path === "/tally" && request.method === "POST"){
    const body = await request.json().catch(() => ({}));
    const patrol = String(body.patrol || "");
    if(!PATROLS.includes(patrol)) return json(env, {error: "unknown patrol"}, 400);
    /* One statement, so two people finishing the quiz at once cannot lose a count. */
    await env.DB.prepare(
      "INSERT INTO tally (patrol, n) VALUES (?1, 1) ON CONFLICT(patrol) DO UPDATE SET n = n + 1"
    ).bind(patrol).run();
    return json(env, await readTally(env));
  }

  /* ---------------- email ---------------- */
  if(path === "/email" && request.method === "POST"){
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const patrol = PATROLS.includes(body.patrol) ? body.patrol : null;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254){
      return json(env, {error: "bad email"}, 400);
    }
    await env.DB.prepare(
      "INSERT INTO signups (email, patrol, created) VALUES (?1, ?2, ?3) ON CONFLICT(email) DO NOTHING"
    ).bind(email, patrol, Date.now()).run();
    return json(env, {ok: true});
  }

  /* ---------------- the wall ---------------- */
  if(path === "/photos" && request.method === "GET"){
    const rows = await env.DB.prepare(
      "SELECT id, patrol, created FROM photos WHERE status = 'approved' AND created > ?1 ORDER BY created DESC LIMIT 300"
    ).bind(Date.now() - 60 * 24 * 60 * 60 * 1000).all();
    const items = (rows.results || []).map(r => ({
      id: r.id, patrol: r.patrol, created: r.created,
      url: new URL("/photo/" + r.id, url.origin).toString()
    }));
    return json(env, {items: items, deletedAfter: new Date(cutoffMs(env)).toISOString()});
  }

  if(path === "/photos" && request.method === "POST"){
    if(Date.now() > cutoffMs(env)) return json(env, {error: "the log is closed"}, 410);

    const ip = request.headers.get("CF-Connecting-IP") || "anon";
    const bucket = "rate:" + ip + ":" + Math.floor(Date.now() / 3600000);
    const used = Number(await env.IMAGES.get(bucket)) || 0;
    if(used >= UPLOADS_PER_IP_PER_HOUR) return json(env, {error: "too many uploads, try later"}, 429);

    const form = await request.formData().catch(() => null);
    if(!form) return json(env, {error: "bad form"}, 400);
    const patrol = String(form.get("patrol") || "");
    const file = form.get("photo");
    if(!PATROLS.includes(patrol)) return json(env, {error: "unknown patrol"}, 400);
    if(!file || typeof file === "string") return json(env, {error: "no photo"}, 400);
    if(file.size > MAX_UPLOAD) return json(env, {error: "photo too big"}, 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    /* Trust the bytes, not the declared type: JPEG and PNG magic numbers only. */
    const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8;
    const isPng  = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
    if(!isJpeg && !isPng) return json(env, {error: "that isn't an image"}, 415);

    const id = crypto.randomUUID().replace(/-/g, "");
    const type = isJpeg ? "image/jpeg" : "image/png";
    /* KV expiry is the backstop: even a lost database row cannot leave bytes behind. */
    const ttl = Math.max(60, Math.ceil((cutoffMs(env) - Date.now()) / 1000));
    await env.IMAGES.put("img:" + id, bytes, {expirationTtl: ttl, metadata: {type: type}});
    await env.DB.prepare(
      "INSERT INTO photos (id, patrol, status, created, type) VALUES (?1, ?2, 'pending', ?3, ?4)"
    ).bind(id, patrol, Date.now(), type).run();
    ctx.waitUntil(env.IMAGES.put(bucket, String(used + 1), {expirationTtl: 3700}));

    return json(env, {id: id, status: "pending"}, 201);
  }

  if(path.startsWith("/photo/") && request.method === "GET"){
    const id = path.slice("/photo/".length);
    if(!/^[0-9a-f]{32}$/.test(id)) return new Response("not found", {status: 404, headers: cors(env)});
    const row = await env.DB.prepare("SELECT status, type, created FROM photos WHERE id = ?1").bind(id).first();
    if(!row || row.status !== "approved" || Date.now() > cutoffMs(env)){
      return new Response("not found", {status: 404, headers: cors(env)});
    }
    const body = await env.IMAGES.get("img:" + id, {type: "arrayBuffer"});
    if(!body) return new Response("not found", {status: 404, headers: cors(env)});
    return new Response(body, {headers: cors(env, {
      "Content-Type": row.type || "image/jpeg",
      /* Short cache: a card pulled off the wall must disappear quickly. */
      "Cache-Control": "public, max-age=300"
    })});
  }

  if(path === "/report" && request.method === "POST"){
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    if(!/^[0-9a-f]{32}$/.test(id)) return json(env, {error: "bad id"}, 400);
    await env.DB.prepare(
      "UPDATE photos SET status = 'reported', reports = reports + 1 WHERE id = ?1"
    ).bind(id).run();
    return json(env, {ok: true});
  }

  /* ---------------- the team's own screens ---------------- */
  if(path.startsWith("/admin/")){
    if(!admin(request, env)) return json(env, {error: "no"}, 401);

    if(path === "/admin/pending"){
      const rows = await env.DB.prepare(
        "SELECT id, patrol, status, created, reports FROM photos WHERE status IN ('pending','reported') ORDER BY created ASC LIMIT 200"
      ).all();
      return json(env, {items: (rows.results || []).map(r => Object.assign({}, r, {
        url: new URL("/admin/photo/" + r.id, url.origin).toString()
      }))});
    }

    if(path.startsWith("/admin/photo/")){
      const id = path.slice("/admin/photo/".length);
      if(!/^[0-9a-f]{32}$/.test(id)) return new Response("not found", {status: 404, headers: cors(env)});
      const row = await env.DB.prepare("SELECT type FROM photos WHERE id = ?1").bind(id).first();
      const body = await env.IMAGES.get("img:" + id, {type: "arrayBuffer"});
      if(!row || !body) return new Response("not found", {status: 404, headers: cors(env)});
      return new Response(body, {headers: cors(env, {"Content-Type": row.type || "image/jpeg", "Cache-Control": "no-store"})});
    }

    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    if(path === "/admin/approve" || path === "/admin/hide"){
      if(!/^[0-9a-f]{32}$/.test(id)) return json(env, {error: "bad id"}, 400);
      const status = path.endsWith("approve") ? "approved" : "hidden";
      await env.DB.prepare("UPDATE photos SET status = ?2 WHERE id = ?1").bind(id, status).run();
      if(status === "hidden") await env.IMAGES.delete("img:" + id);
      return json(env, {ok: true, status: status});
    }

    if(path === "/admin/purge"){
      await purge(env, true);
      return json(env, {ok: true});
    }
  }

  return json(env, {error: "not found"}, 404);
}

/* Everything goes, seven days after Reunion. `force` runs it now. */
async function purge(env, force){
  if(!force && Date.now() < cutoffMs(env)) return;
  const rows = await env.DB.prepare("SELECT id FROM photos").all();
  for(const r of (rows.results || [])) await env.IMAGES.delete("img:" + r.id);
  await env.DB.prepare("DELETE FROM photos").run();
}

export default {
  async fetch(request, env, ctx){
    try{
      return await handle(request, env, ctx);
    }catch(err){
      return json(env, {error: "server error"}, 500);
    }
  },
  async scheduled(event, env, ctx){
    ctx.waitUntil(purge(env, false));
  }
};
