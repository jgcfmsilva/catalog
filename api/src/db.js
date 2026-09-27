import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitForDb(retries = 30) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e) {
      console.log(`[db] not ready (${i}/${retries}): ${e.message}`);
      await sleep(2000);
    }
  }
  throw new Error('Database never became ready');
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS titles (
  id               SERIAL PRIMARY KEY,
  user_id          INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('movie','series','anime')),
  source           TEXT NOT NULL CHECK (source IN ('tmdb','jikan','anilist')),
  external_id      TEXT NOT NULL,
  title            TEXT NOT NULL,
  original_title   TEXT,
  year             INT,
  overview         TEXT,
  cover_path       TEXT,
  status           TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','watching','watched')),
  seasons          INT,
  episodes         INT,
  runtime_minutes  INT,
  season_info      JSONB,
  airing_status    TEXT,
  episodes_watched INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, source, external_id)
);
ALTER TABLE titles DROP CONSTRAINT IF EXISTS titles_source_check;
ALTER TABLE titles ADD CONSTRAINT titles_source_check CHECK (source IN ('tmdb','jikan','anilist'));
ALTER TABLE titles DROP COLUMN IF EXISTS rating;
CREATE INDEX IF NOT EXISTS titles_user_idx ON titles (user_id, updated_at DESC);
`;

export const migrate = () => pool.query(SCHEMA);
