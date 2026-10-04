-- Safe to run repeatedly on a fresh or existing local development database.
-- Hosted deployments use the versioned migrations in drizzle/ instead.
CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  expires INTEGER NOT NULL
);
