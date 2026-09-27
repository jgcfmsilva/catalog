import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, waitForDb, migrate } from './db.js';
import { seed } from './seed.js';
import { saveCover, removeCover, COVERS_DIR } from './covers.js';
import * as tmdb from './providers/tmdb.js';
import * as jikan from './providers/jikan.js';
import * as anilist from './providers/anilist.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET is required');
  process.exit(1);
}

const SOURCES = { movie: ['tmdb'], series: ['tmdb'], anime: ['jikan', 'anilist'] };
const STATUSES = ['planning', 'watching', 'watched'];

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '50kb' }));

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const httpError = (status, message) => Object.assign(new Error(message), { status });

// ---------- helpers ----------

const dto = (r) => ({
  id: r.id,
  kind: r.kind,
  source: r.source,
  externalId: r.external_id,
  title: r.title,
  originalTitle: r.original_title,
  year: r.year,
  overview: r.overview,
  coverUrl: r.cover_path ? `/covers/${r.cover_path}` : null,
  status: r.status,
  seasons: r.seasons,
  episodes: r.episodes,
  runtimeMinutes: r.runtime_minutes,
  seasonInfo: r.season_info,
  airingStatus: r.airing_status,
  episodesWatched: r.episodes_watched,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function fetchMeta(kind, source, id) {
  if (kind === 'anime') return source === 'anilist' ? anilist.anime(id) : jikan.anime(id);
  if (kind === 'movie') return tmdb.movie(id);
  return tmdb.tv(id);
}

// Same anime can come from Jikan (MyAnimeList) or AniList with slightly different titles.
// Treat it as one title when a normalized title matches and the years agree (or one is unknown).
const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');

async function findAnimeDuplicate(userId, meta) {
  const { rows } = await pool.query("SELECT * FROM titles WHERE user_id=$1 AND kind='anime'", [userId]);
  const names = new Set([norm(meta.title), norm(meta.originalTitle)].filter(Boolean));
  return rows.find(
    (r) =>
      (r.year == null || meta.year == null || r.year === meta.year) &&
      [norm(r.title), norm(r.original_title)].some((n) => n && names.has(n))
  );
}

// One card per anime: seasons that are separate entries upstream are kept as parts in season_info
// ([{ season, episodes, externalId }]). Refresh re-reads every part and recombines them.
const isMulti = (row) => row.kind === 'anime' && Array.isArray(row.season_info) && row.season_info.some((p) => p.externalId);

async function fetchMulti(row) {
  const metas = [];
  for (const p of row.season_info) metas.push(await fetchMeta('anime', row.source, p.externalId));
  const seasonInfo = row.season_info.map((p, i) => ({
    season: i + 1,
    episodes: metas[i].episodes ?? p.episodes,
    externalId: p.externalId,
  }));
  return {
    ...metas[0],
    title: row.title,
    seasons: seasonInfo.length,
    episodes: seasonInfo.reduce((n, p) => n + (p.episodes || 0), 0) || null,
    seasonInfo,
    airingStatus: metas[metas.length - 1].airingStatus,
  };
}

const int = (v) => (Number.isInteger(v) ? v : null);

// ---------- auth ----------

const attempts = new Map(); // ip -> { count, resetAt }
function loginLimiter(req, res, next) {
  const now = Date.now();
  const entry = attempts.get(req.ip);
  if (entry && entry.resetAt > now && entry.count >= 8) {
    return res.status(429).json({ error: 'Too many attempts, try again in a minute' });
  }
  next();
}
function noteFailure(ip) {
  const now = Date.now();
  const e = attempts.get(ip);
  if (!e || e.resetAt <= now) attempts.set(ip, { count: 1, resetAt: now + 60_000 });
  else e.count++;
}

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

app.post(
  '/api/auth/login',
  loginLimiter,
  wrap(async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw httpError(400, 'Username and password are required');
    }
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) {
      noteFailure(req.ip);
      throw httpError(401, 'Invalid username or password');
    }
    attempts.delete(req.ip);
    const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username } });
  })
);

function auth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  try {
    const payload = jwt.verify(m?.[1] ?? '', JWT_SECRET);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/auth/me', auth, (req, res) => res.json(req.user));

// Covers are public (loaded by <img>, which cannot send auth headers). File names are unguessable-ish.
app.use('/covers', express.static(COVERS_DIR, { maxAge: '30d', immutable: true }));

// ---------- search ----------

app.get(
  '/api/search',
  auth,
  wrap(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [], warnings: [] });
    // Anime: Jikan first, AniList if Jikan/MyAnimeList is unavailable.
    const animeSearch = jikan.search(q).catch((jikanErr) =>
      anilist.search(q).catch((aniErr) => {
        throw new Error(`Anime search unavailable (Jikan: ${jikanErr.message}; AniList: ${aniErr.message})`);
      })
    );
    const [t, j] = await Promise.allSettled([tmdb.search(q), animeSearch]);
    const warnings = [];
    if (t.status === 'rejected') warnings.push(t.reason.message);
    if (j.status === 'rejected') warnings.push(j.reason.message);
    res.json({
      results: [...(t.value ?? []), ...(j.value ?? [])],
      warnings,
    });
  })
);

// ---------- titles ----------

app.get(
  '/api/titles',
  auth,
  wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM titles WHERE user_id = $1 ORDER BY updated_at DESC', [req.user.id]);
    res.json(rows.map(dto));
  })
);

app.post(
  '/api/titles',
  auth,
  wrap(async (req, res) => {
    const { kind, source, externalId } = req.body || {};
    const status = req.body?.status ?? 'planning';
    if (!SOURCES[kind]?.includes(source)) throw httpError(400, 'Invalid kind/source');
    if (!/^\d{1,12}$/.test(String(externalId))) throw httpError(400, 'Invalid externalId');
    if (!STATUSES.includes(status)) throw httpError(400, 'Invalid status');
    const extId = String(externalId);

    const dup = await pool.query(
      'SELECT id FROM titles WHERE user_id=$1 AND kind=$2 AND source=$3 AND external_id=$4',
      [req.user.id, kind, source, extId]
    );
    if (dup.rowCount) throw httpError(409, 'Already in your library');

    if (kind === 'anime') {
      const part = await pool.query(
        "SELECT title FROM titles WHERE user_id=$1 AND kind='anime' AND season_info @> $2::jsonb LIMIT 1",
        [req.user.id, JSON.stringify([{ externalId: extId }])]
      );
      if (part.rowCount) throw httpError(409, `Already in your library as part of "${part.rows[0].title}"`);
    }

    let meta;
    try {
      meta = await fetchMeta(kind, source, extId);
    } catch (e) {
      throw httpError(502, `Could not fetch data: ${e.message}`);
    }
    if (kind === 'anime') {
      const same = await findAnimeDuplicate(req.user.id, meta);
      if (same) throw httpError(409, `Already in your library as "${same.title}"`);
    }
    const cover = await saveCover(meta.coverUrl, `${kind}-${extId}`);
    const watched = status === 'watched' ? meta.episodes ?? 0 : 0;

    const { rows } = await pool.query(
      `INSERT INTO titles
         (user_id, kind, source, external_id, title, original_title, year, overview, cover_path,
          status, seasons, episodes, runtime_minutes, season_info, airing_status, episodes_watched)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        req.user.id, kind, source, extId, meta.title, meta.originalTitle, meta.year, meta.overview, cover,
        status, meta.seasons, meta.episodes, meta.runtimeMinutes,
        meta.seasonInfo ? JSON.stringify(meta.seasonInfo) : null, meta.airingStatus, watched,
      ]
    );
    res.status(201).json(dto(rows[0]));
  })
);

async function loadOwned(req) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw httpError(400, 'Invalid id');
  const { rows } = await pool.query('SELECT * FROM titles WHERE id=$1 AND user_id=$2', [id, req.user.id]);
  if (!rows[0]) throw httpError(404, 'Not found');
  return rows[0];
}

app.patch(
  '/api/titles/:id',
  auth,
  wrap(async (req, res) => {
    const row = await loadOwned(req);
    const body = req.body || {};
    let status = row.status;
    let watched = row.episodes_watched;

    if ('episodesWatched' in body) {
      const n = int(body.episodesWatched);
      if (n === null || n < 0) throw httpError(400, 'Invalid episodesWatched');
      watched = row.episodes ? Math.min(n, row.episodes) : n;
      // Progress drives status unless the client also sets one explicitly.
      if (row.episodes && watched >= row.episodes) status = 'watched';
      else if (watched > 0 && status !== 'watching') status = 'watching';
      else if (watched === 0 && status === 'watching') status = 'planning';
    }
    if ('status' in body) {
      if (!STATUSES.includes(body.status)) throw httpError(400, 'Invalid status');
      status = body.status;
      if (status === 'watched' && row.episodes) watched = row.episodes;
      if (status === 'planning') watched = 0;
    }

    const { rows } = await pool.query(
      `UPDATE titles SET status=$1, episodes_watched=$2, updated_at=now()
       WHERE id=$3 RETURNING *`,
      [status, watched, row.id]
    );
    res.json(dto(rows[0]));
  })
);

// Re-fetch metadata (e.g. a running series got new episodes). Progress is kept.
app.post(
  '/api/titles/:id/refresh',
  auth,
  wrap(async (req, res) => {
    const row = await loadOwned(req);
    let meta;
    try {
      meta = isMulti(row) ? await fetchMulti(row) : await fetchMeta(row.kind, row.source, row.external_id);
    } catch (e) {
      throw httpError(502, `Could not fetch data: ${e.message}`);
    }
    const newCover = await saveCover(meta.coverUrl, `${row.kind}-${row.external_id}`);
    const { rows } = await pool.query(
      `UPDATE titles SET title=$1, original_title=$2, year=$3, overview=$4, cover_path=COALESCE($5, cover_path),
         seasons=$6, episodes=$7, runtime_minutes=$8, season_info=$9, airing_status=$10, updated_at=now()
       WHERE id=$11 RETURNING *`,
      [
        meta.title, meta.originalTitle, meta.year, meta.overview, newCover,
        meta.seasons, meta.episodes, meta.runtimeMinutes,
        meta.seasonInfo ? JSON.stringify(meta.seasonInfo) : null, meta.airingStatus, row.id,
      ]
    );
    if (newCover) await removeCover(row.cover_path);
    res.json(dto(rows[0]));
  })
);

app.delete(
  '/api/titles/:id',
  auth,
  wrap(async (req, res) => {
    const row = await loadOwned(req);
    await pool.query('DELETE FROM titles WHERE id=$1', [row.id]);
    await removeCover(row.cover_path);
    res.status(204).end();
  })
);

// ---------- errors ----------

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------- boot ----------

await waitForDb();
await migrate();
await seed();
app.listen(4000, () => console.log('[api] listening on :4000'));
