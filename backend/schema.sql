-- patrolfinder D1 schema.
-- Nothing here identifies anyone. The tally is four numbers, the signups are
-- an email and the patrol it came from, and a photo row is an id, a patrol and
-- a status. No answers, no IP addresses, no names.

CREATE TABLE IF NOT EXISTS tally (
  patrol TEXT PRIMARY KEY,
  n      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS signups (
  email   TEXT PRIMARY KEY,
  patrol  TEXT,
  created INTEGER NOT NULL
);

-- status: pending -> approved (on the wall) | hidden | reported
CREATE TABLE IF NOT EXISTS photos (
  id      TEXT PRIMARY KEY,
  patrol  TEXT NOT NULL,
  status  TEXT NOT NULL DEFAULT 'pending',
  created INTEGER NOT NULL,
  type    TEXT NOT NULL DEFAULT 'image/jpeg',
  reports INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS photos_status ON photos (status, created DESC);
