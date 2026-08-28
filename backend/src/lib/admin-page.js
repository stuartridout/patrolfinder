/*
 * The Jamboree Team's console, served from the API itself at /console.
 *
 * It is one page with no build step and no framework, because it has to work
 * on a volunteer's phone, on event wifi, with someone else's hands. The token
 * is typed once and kept in the browser; nothing here is reachable without it.
 */

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Patrol log console</title>
<style>
  :root{
    --paper:#FAF5E9; --navy:#1B3579; --red:#E13327; --red-ink:#D42B20;
    --wolves:#2A5CAD; --bulls:#2F7D3F; --curlews:#F5B01E; --ravens:#C02D24;
    --line:rgba(27,53,121,.16);
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
    --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--sans);background:var(--paper);color:var(--navy);line-height:1.5;
    -webkit-font-smoothing:antialiased;padding:0 0 60px}
  .bar{background:#fff;border-bottom:1px solid var(--line);padding:14px 18px;
    display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .bar h1{font-family:var(--serif);font-size:1.3rem;font-weight:700}
  .bar .who{font-size:.75rem;font-weight:700;opacity:.7}
  .wrap{max-width:60rem;margin:0 auto;padding:18px}
  .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:16px}
  h2{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.72;margin-bottom:12px}
  p.hint{font-size:.82rem;opacity:.8}
  label.sw{display:flex;align-items:flex-start;gap:14px;padding:12px 0;border-top:1px solid var(--line);cursor:pointer}
  label.sw:first-of-type{border-top:0}
  label.sw input{position:absolute;opacity:0;width:0;height:0}
  .track{flex:none;width:52px;height:32px;border-radius:99px;background:#c9cfdd;position:relative;
    transition:background .16s ease;margin-top:2px}
  .track::after{content:"";position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;
    background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .16s ease}
  label.sw input:checked + .track{background:var(--bulls)}
  label.sw input:checked + .track::after{transform:translateX(20px)}
  label.sw input:focus-visible + .track{outline:3px solid var(--red);outline-offset:2px}
  .swtext b{display:block;font-size:1rem;font-weight:800}
  .swtext span{display:block;font-size:.8rem;opacity:.8}
  button{font-family:var(--sans);cursor:pointer;border-radius:99px;font-weight:800;min-height:44px;
    padding:11px 18px;font-size:.9rem;border:2px solid var(--navy);background:#fff;color:var(--navy)}
  button.primary{background:var(--navy);color:#fff}
  button.danger{background:var(--red-ink);border-color:var(--red-ink);color:#fff}
  button.quiet{border-color:var(--line)}
  button:disabled{opacity:.5;cursor:not-allowed}
  button:focus-visible{outline:3px solid var(--red);outline-offset:2px}
  input[type=password],input[type=text]{font-family:var(--sans);font-size:1rem;color:var(--navy);
    border:2px solid var(--line);border-radius:12px;padding:12px 14px;width:100%;background:#fff}
  input:focus-visible{outline:3px solid var(--red);outline-offset:1px}
  .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
  .stat{border:1px solid var(--line);border-radius:12px;padding:10px 12px}
  .stat b{display:block;font-size:1.5rem;font-variant-numeric:tabular-nums}
  .stat span{font-size:.7rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;opacity:.7}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-top:14px}
  figure{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}
  figure.flagged{border-color:var(--red-ink);border-width:3px}
  figure img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:#eee}
  figcaption{padding:8px 10px}
  .chip{display:inline-block;font-size:.6rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
    border-radius:99px;padding:3px 8px;color:#fff}
  .p-wolves{background:var(--wolves)} .p-bulls{background:var(--bulls)}
  .p-curlews{background:var(--curlews);color:var(--navy)} .p-ravens{background:var(--ravens)}
  .st{font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.7;margin-top:5px}
  .st.reported{color:var(--red-ink);opacity:1}
  /* Its own solid colour: .7 opacity on top of another .55 fell below 4.5:1. */
  .st.when{opacity:1;color:#5F72A1}
  figcaption .row{margin-top:8px;gap:6px}
  figcaption button{min-height:40px;padding:8px 12px;font-size:.75rem;flex:1}
  .note{margin-top:12px;font-size:.85rem;font-weight:700}
  .note.err{color:var(--red-ink)}
  .note.ok{color:var(--bulls)}
  .empty{opacity:.7;font-size:.9rem;padding:10px 0}
  .danger-zone{border-color:rgba(212,43,32,.4)}
  [hidden]{display:none !important}
</style>
</head>
<body>

<header class="bar">
  <h1>Patrol log console</h1>
  <span class="who" id="who"></span>
</header>

<main class="wrap">

  <div class="card" id="signin">
    <h2>Sign in</h2>
    <p class="hint">Paste the admin token. It is kept in this browser only.</p>
    <div class="row" style="flex-wrap:nowrap">
      <input type="password" id="token" placeholder="Admin token" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" aria-label="Admin token">
    </div>
    <label class="row" style="gap:8px;font-size:.85rem;font-weight:700">
      <input type="checkbox" id="remember" style="width:20px;height:20px" checked> Stay signed in on this device
    </label>
    <div class="row"><button class="primary" id="signinBtn">Sign in</button></div>
    <p class="note err" id="signinNote"></p>
  </div>

  <div id="console" hidden>

    <div class="card">
      <h2>Switches</h2>
      <p class="hint">These take effect on the next page load for everyone at the event.</p>
      <label class="sw">
        <input type="checkbox" data-flag="wall"><span class="track"></span>
        <span class="swtext"><b>Patrol wall</b><span>People can see the wall of cards. Off hides it everywhere and stops serving the pictures.</span></span>
      </label>
      <label class="sw">
        <input type="checkbox" data-flag="uploads"><span class="track"></span>
        <span class="swtext"><b>Adding to the wall</b><span>People can upload their card. Off leaves the wall visible but read-only.</span></span>
      </label>
      <label class="sw">
        <input type="checkbox" data-flag="cards"><span class="track"></span>
        <span class="swtext"><b>Patrol cards and photo overlay</b><span>The card studio after the result. Off removes it, and the wall with it.</span></span>
      </label>
      <label class="sw">
        <input type="checkbox" data-flag="moderate"><span class="track"></span>
        <span class="swtext"><b>Check cards before they go up</b><span>Off for a private event: cards appear straight away. On holds every upload here until someone releases it.</span></span>
      </label>
      <p class="note" id="flagNote"></p>
    </div>

    <div class="card">
      <h2>Numbers</h2>
      <div class="stats" id="stats"></div>
      <div class="row">
        <button class="quiet" id="csvBtn">Download sign-ups (CSV)</button>
        <button class="quiet" id="refreshBtn">Refresh</button>
      </div>
    </div>

    <div class="card">
      <h2>Reported <span id="repCount"></span></h2>
      <p class="hint">Reported cards come off the wall the moment anyone taps Report. Look, then put it back or delete it.</p>
      <div id="reported"><p class="empty">Nothing reported.</p></div>
    </div>

    <div class="card">
      <h2>Every card</h2>
      <div class="row" id="filters"></div>
      <div id="photos"><p class="empty">Loading...</p></div>
    </div>

    <div class="card danger-zone">
      <h2>Start clean</h2>
      <p class="hint">For clearing up after testing, or for starting Reunion morning with the day's own numbers. None of it can be undone.</p>
      <div class="row" style="flex-wrap:nowrap">
        <input type="text" id="purgeConfirm" placeholder="Type CLEAR to arm" aria-label="Type CLEAR to arm">
      </div>
      <div class="row">
        <button class="danger arm" id="purgePhotos" disabled>Delete every photo</button>
        <button class="danger arm" id="purgeTally" disabled>Reset the counts</button>
        <button class="danger arm" id="purgeSignups" disabled>Clear the sign-ups</button>
      </div>
      <div class="row"><button class="danger arm" id="purgeAll" disabled>All three</button></div>
      <p class="note" id="purgeNote"></p>
    </div>

  </div>
</main>

<script>
var TOKEN = "";
var PATROLS = ["wolves","bulls","curlews","ravens"];
var filter = "all";
var allPhotos = [];

function $(id){ return document.getElementById(id); }

function api(path, opts){
  opts = opts || {};
  opts.headers = Object.assign({Authorization: "Bearer " + TOKEN}, opts.headers || {});
  return fetch(path, opts);
}

function note(el, msg, kind){
  el.textContent = msg || "";
  el.className = "note" + (kind ? " " + kind : "");
  if(msg && kind === "ok") setTimeout(function(){ if(el.textContent === msg) el.textContent = ""; }, 2500);
}

function when(ms){
  var d = new Date(ms);
  return d.toLocaleDateString("en-GB",{day:"numeric",month:"short"}) + " " +
         d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
}

/* ---------------- sign in ---------------- */

function saveToken(t, remember){
  TOKEN = t;
  try{
    sessionStorage.setItem("pf.token", t);
    if(remember) localStorage.setItem("pf.token", t); else localStorage.removeItem("pf.token");
  }catch(e){}
}

function signOut(){
  TOKEN = "";
  forgetToken();
  location.reload();
}

function forgetToken(){
  try{ sessionStorage.removeItem("pf.token"); localStorage.removeItem("pf.token"); }catch(e){}
}

async function tryToken(t, remember){
  TOKEN = t;
  var res = await api("/console/config");
  if(res.status === 401){
    /* A token that has been rotated away is dead for good. Drop it rather than
       retrying it on every reload and leaving the field autofilled with it. */
    forgetToken();
    TOKEN = "";
    return false;
  }
  if(!res.ok) throw new Error("server said " + res.status);
  saveToken(t, remember);
  var flags = await res.json();
  $("signin").hidden = true;
  $("console").hidden = false;
  $("who").innerHTML = '<button class="quiet" style="min-height:32px;padding:5px 12px;font-size:.75rem" id="outBtn">Sign out</button>';
  $("outBtn").addEventListener("click", signOut);
  paintFlags(flags);
  refresh();
  return true;
}

$("signinBtn").addEventListener("click", async function(){
  var t = $("token").value.trim();
  if(!t){ note($("signinNote"), "Paste the token first.", "err"); return; }
  this.disabled = true;
  try{
    var ok = await tryToken(t, $("remember").checked);
    if(!ok) note($("signinNote"), "That token isn't right.", "err");
  }catch(e){
    note($("signinNote"), "Couldn't reach the API: " + e.message, "err");
  }
  this.disabled = false;
});
$("token").addEventListener("keydown", function(e){ if(e.key === "Enter") $("signinBtn").click(); });

/* ---------------- switches ---------------- */

function paintFlags(flags){
  document.querySelectorAll("[data-flag]").forEach(function(box){
    box.checked = !!flags[box.dataset.flag];
  });
}

document.querySelectorAll("[data-flag]").forEach(function(box){
  box.addEventListener("change", async function(){
    var patch = {};
    patch[box.dataset.flag] = box.checked;
    box.disabled = true;
    try{
      var res = await api("/console/config", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(patch)
      });
      if(!res.ok) throw new Error("save failed");
      paintFlags(await res.json());
      note($("flagNote"), "Saved.", "ok");
    }catch(e){
      box.checked = !box.checked;
      note($("flagNote"), "Didn't save. Try again.", "err");
    }
    box.disabled = false;
  });
});

/* ---------------- photos ---------------- */

/* An <img> cannot carry an Authorization header, and the admin image route is
   behind the token, so the bytes are fetched and handed over as a blob URL. */
var objectUrls = [];

function releaseImages(){
  objectUrls.forEach(function(u){ URL.revokeObjectURL(u); });
  objectUrls = [];
}

function loadImage(img, url){
  api(url).then(function(res){
    if(!res.ok) throw new Error("no image");
    return res.blob();
  }).then(function(b){
    var u = URL.createObjectURL(b);
    objectUrls.push(u);
    img.src = u;
  }).catch(function(){
    img.style.visibility = "hidden";
  });
}

function figureFor(p, flagged){
  var f = document.createElement("figure");
  if(flagged) f.className = "flagged";
  var img = document.createElement("img");
  img.alt = "A " + p.patrol + " card";
  loadImage(img, p.url);
  var cap = document.createElement("figcaption");
  cap.innerHTML = '<span class="chip p-' + p.patrol + '">' + p.patrol + '</span>' +
    '<div class="st' + (p.status === "reported" ? " reported" : "") + '">' +
      p.status + (p.reports ? " \\u00b7 " + p.reports + " report" + (p.reports > 1 ? "s" : "") : "") +
    '</div>' +
    '<div class="st when">' + when(p.created) + '</div>';
  var row = document.createElement("div");
  row.className = "row";
  if(p.status !== "approved"){
    row.appendChild(actionBtn("Put back", "primary", "/console/approve", p.id));
  }else{
    row.appendChild(actionBtn("Take down", "quiet", "/console/hide", p.id));
  }
  row.appendChild(actionBtn("Delete", "danger", "/console/delete", p.id));
  cap.appendChild(row);
  f.appendChild(img); f.appendChild(cap);
  return f;
}

function actionBtn(label, cls, path, id){
  var b = document.createElement("button");
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", async function(){
    if(path === "/console/delete" && !confirm("Delete this card for good?")) return;
    b.disabled = true;
    try{
      var res = await api(path, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({id: id})
      });
      if(!res.ok) throw new Error("failed");
      await refresh();
    }catch(e){
      b.disabled = false;
      alert("That didn't work. Try again.");
    }
  });
  return b;
}

function paintPhotos(){
  releaseImages();
  var reported = allPhotos.filter(function(p){ return p.status === "reported"; });
  var repBox = $("reported");
  repBox.innerHTML = "";
  $("repCount").textContent = reported.length ? "(" + reported.length + ")" : "";
  if(!reported.length){
    repBox.innerHTML = '<p class="empty">Nothing reported.</p>';
  }else{
    var g = document.createElement("div");
    g.className = "grid";
    reported.forEach(function(p){ g.appendChild(figureFor(p, true)); });
    repBox.appendChild(g);
  }

  var shown = filter === "all" ? allPhotos : allPhotos.filter(function(p){ return p.patrol === filter; });
  var box = $("photos");
  box.innerHTML = "";
  if(!shown.length){
    box.innerHTML = '<p class="empty">No cards yet.</p>';
    return;
  }
  var grid = document.createElement("div");
  grid.className = "grid";
  shown.forEach(function(p){ grid.appendChild(figureFor(p, p.status === "reported")); });
  box.appendChild(grid);
}

function paintFilters(){
  var box = $("filters");
  if(box.childElementCount) return;
  ["all"].concat(PATROLS).forEach(function(p){
    var b = document.createElement("button");
    b.className = "quiet";
    b.textContent = p === "all" ? "All" : p;
    b.style.textTransform = "capitalize";
    b.addEventListener("click", function(){
      filter = p;
      box.querySelectorAll("button").forEach(function(o){ o.className = o === b ? "primary" : "quiet"; });
      paintPhotos();
    });
    if(p === "all") b.className = "primary";
    box.appendChild(b);
  });
}

/* ---------------- numbers ---------------- */

function paintStats(s){
  var total = PATROLS.reduce(function(n, p){ return n + (s.tally[p] || 0); }, 0);
  var bits = [["Quizzes done", total], ["Sign-ups", s.signups]];
  PATROLS.forEach(function(p){ bits.push([p, s.tally[p] || 0]); });
  bits.push(["On the wall", (s.photos && s.photos.approved) || 0]);
  bits.push(["Reported", (s.photos && s.photos.reported) || 0]);
  $("stats").innerHTML = bits.map(function(b){
    return '<div class="stat"><b>' + b[1] + '</b><span>' + b[0] + '</span></div>';
  }).join("") +
  '<div class="stat" style="grid-column:1/-1"><span>Everything on the wall is deleted after ' +
    new Date(s.deletedAfter).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}) +
  '</span></div>';
}

async function refresh(){
  paintFilters();
  try{
    var [statsRes, photoRes] = await Promise.all([api("/console/stats"), api("/console/photos")]);
    if(statsRes.ok) paintStats(await statsRes.json());
    if(photoRes.ok){
      allPhotos = (await photoRes.json()).items || [];
      paintPhotos();
    }
  }catch(e){
    $("photos").innerHTML = '<p class="empty">Couldn\\'t load. Check the connection and refresh.</p>';
  }
}

$("refreshBtn").addEventListener("click", refresh);

$("csvBtn").addEventListener("click", async function(){
  this.disabled = true;
  try{
    var res = await api("/console/signups.csv");
    var blob = await res.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "wsjpatrol-signups.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  }catch(e){ alert("Couldn't download the CSV."); }
  this.disabled = false;
});

/* ---------------- danger ---------------- */

$("purgeConfirm").addEventListener("input", function(){
  var armed = this.value.trim().toUpperCase() === "CLEAR";
  document.querySelectorAll("button.arm").forEach(function(b){ b.disabled = !armed; });
});

function wipe(id, what, label){
  $(id).addEventListener("click", async function(){
    if(!confirm(label + " This cannot be undone.")) return;
    document.querySelectorAll("button.arm").forEach(function(b){ b.disabled = true; });
    try{
      var res = await api("/console/reset", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({what: what})
      });
      if(!res.ok) throw new Error("failed");
      note($("purgeNote"), "Done.", "ok");
      $("purgeConfirm").value = "";
      await refresh();
    }catch(e){
      note($("purgeNote"), "That didn't work.", "err");
      document.querySelectorAll("button.arm").forEach(function(b){ b.disabled = false; });
    }
  });
}

wipe("purgePhotos",  "photos",  "Delete every photo in the patrol log?");
wipe("purgeTally",   "tally",   "Reset all four patrol counts to zero?");
wipe("purgeSignups", "signups", "Delete every email sign-up?");
wipe("purgeAll",     "all",     "Delete every photo, every sign-up, and reset the counts?");

/* ---------------- boot ---------------- */

(function boot(){
  var saved = "";
  try{ saved = localStorage.getItem("pf.token") || sessionStorage.getItem("pf.token") || ""; }catch(e){}
  if(!saved) return;
  tryToken(saved, true).then(function(ok){
    if(!ok) note($("signinNote"), "The saved token no longer works. It has been forgotten - paste the current one.", "err");
  }).catch(function(){});
})();
</script>
</body>
</html>`;

module.exports = { ADMIN_HTML };
