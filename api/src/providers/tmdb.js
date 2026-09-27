// Movies + series via TMDB. Accepts a v3 API key or a v4 read-access token.
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const LANG = process.env.TMDB_LANGUAGE || 'en-US';

async function call(path, params = {}) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error('TMDB_API_KEY is not set (movies and series search disabled)');
  const url = new URL(BASE + path);
  const headers = { accept: 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set('api_key', key);
  url.searchParams.set('language', LANG);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (res.status === 401) throw new Error('TMDB rejected the API key');
  if (!res.ok) throw new Error(`TMDB error ${res.status}`);
  return res.json();
}

const yearOf = (d) => (d ? parseInt(d.slice(0, 4), 10) || null : null);

export async function search(q) {
  const data = await call('/search/multi', { query: q, include_adult: 'false' });
  return data.results
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 12)
    .map((r) => ({
      kind: r.media_type === 'movie' ? 'movie' : 'series',
      source: 'tmdb',
      externalId: String(r.id),
      title: r.title || r.name,
      year: yearOf(r.release_date || r.first_air_date),
      overview: r.overview || '',
      cover: r.poster_path ? IMG + r.poster_path : null,
    }));
}

export async function movie(id) {
  const d = await call(`/movie/${id}`);
  return {
    title: d.title,
    originalTitle: d.original_title,
    year: yearOf(d.release_date),
    overview: d.overview || '',
    coverUrl: d.poster_path ? IMG + d.poster_path : null,
    seasons: null,
    episodes: null,
    runtimeMinutes: d.runtime || null,
    seasonInfo: null,
    airingStatus: d.status || null,
  };
}

export async function tv(id) {
  const d = await call(`/tv/${id}`);
  const seasons = (d.seasons || [])
    .filter((s) => s.season_number > 0 && s.episode_count > 0)
    .map((s) => ({ season: s.season_number, episodes: s.episode_count }));
  const episodes = seasons.reduce((n, s) => n + s.episodes, 0) || d.number_of_episodes || null;
  return {
    title: d.name,
    originalTitle: d.original_name,
    year: yearOf(d.first_air_date),
    overview: d.overview || '',
    coverUrl: d.poster_path ? IMG + d.poster_path : null,
    seasons: seasons.length || d.number_of_seasons || null,
    episodes,
    runtimeMinutes: d.episode_run_time?.[0] || d.last_episode_to_air?.runtime || null,
    seasonInfo: seasons.length ? seasons : null,
    airingStatus: d.status || null,
  };
}
