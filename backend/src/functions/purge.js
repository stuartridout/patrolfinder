/*
 * The seven-day sweep. Everything in the patrol log goes seven days after the
 * last day of Reunion, because that is the date the app shows people before
 * they upload.
 *
 * This is one of three things keeping that promise: the timer here, a cutoff
 * check on every read in api.js, and a sweep kicked off by the first request
 * that arrives after the cutoff. A missed timer run cannot leave a photo up.
 */
const { app } = require("@azure/functions");
const store = require("../lib/store");

function cutoffMs(){
  const ends = process.env.REUNION_ENDS || "2026-09-06";
  return Date.parse(ends + "T23:59:59Z") + 7 * 24 * 60 * 60 * 1000;
}

app.timer("purge", {
  schedule: "0 17 3 * * *",          /* 03:17 UTC daily */
  handler: async (timer, context) => {
    if(Date.now() < cutoffMs()){
      context.log("patrol log still open, nothing swept");
      return;
    }
    const n = await store.purgeAllPhotos();
    context.log(`patrol log swept, ${n} photo(s) deleted`);
  }
});
