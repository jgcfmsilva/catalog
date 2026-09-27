// Anime via Jikan (unofficial MyAnimeList API, no key). Rate limit: 3 req/s.
const BASE = 'https://api.jikan.moe/v4';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, params = {}, attempts = 3) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (res.status === 429 || res.status >= 500) {
      await sleep(1200 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`Jikan error ${res.status}`);
    return res.json();
  }
  throw new Error('Jikan is busy or unavailable, try again in a moment');
}

// "24 min per ep" -> 24, "1 hr 55 min" -> 115
export function parseDuration(s) {
  if (!s) return null;
  const h = /(\d+)\s*hr/.exec(s);
  const m = /(\d+)\s*min/.exec(s);
  return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) || null;
}

const coverOf = (a) => a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null;
const yearOf = (a) => a.year || a.aired?.prop?.from?.year || null;
const nameOf = (a) => a.title_english || a.title;

export async function search(q) {
  // One attempt only: on failure the caller falls back to AniList.
  const data = await call('/anime', { q, limit: 12, sfw: 'true' }, 1);
  return data.data.map((a) => ({
    kind: 'anime',
    source: 'jikan',
    externalId: String(a.mal_id),
    title: nameOf(a),
    year: yearOf(a),
    overview: a.synopsis || '',
    cover: coverOf(a),
    animeType: a.type || null,
  }));
}

export async function anime(id) {
  const a = (await call(`/anime/${id}`)).data;
  return {
    title: nameOf(a),
    originalTitle: a.title_japanese || a.title,
    year: yearOf(a),
    overview: a.synopsis || '',
    coverUrl: coverOf(a),
    seasons: 1,
    episodes: a.episodes || null,
    runtimeMinutes: parseDuration(a.duration),
    seasonInfo: null,
    airingStatus: a.status || null,
  };
}
