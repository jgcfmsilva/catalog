// Anime via AniList GraphQL (no key). Used as a fallback when Jikan/MyAnimeList is down.
const URL_ = 'https://graphql.anilist.co';

const SEARCH = `
query ($q: String) {
  Page(perPage: 12) {
    media(search: $q, type: ANIME, isAdult: false, sort: SEARCH_MATCH) {
      id title { romaji english } startDate { year } description(asHtml: false)
      coverImage { extraLarge large } format
    }
  }
}`;

const DETAILS = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id title { romaji english native } startDate { year } description(asHtml: false)
    coverImage { extraLarge large } episodes duration format status
  }
}`;

async function call(query, variables) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`AniList error ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`AniList: ${json.errors[0].message}`);
  return json.data;
}

const clean = (s) =>
  (s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
const nameOf = (m) => m.title.english || m.title.romaji;
const coverOf = (m) => m.coverImage?.extraLarge || m.coverImage?.large || null;
const formatOf = (f) => (f ? f.replace(/_/g, ' ') : null);
const STATUS = {
  FINISHED: 'Finished Airing', RELEASING: 'Currently Airing', NOT_YET_RELEASED: 'Not yet aired',
  CANCELLED: 'Cancelled', HIATUS: 'On Hiatus',
};

export async function search(q) {
  const data = await call(SEARCH, { q });
  return data.Page.media.map((m) => ({
    kind: 'anime',
    source: 'anilist',
    externalId: String(m.id),
    title: nameOf(m),
    year: m.startDate?.year || null,
    overview: clean(m.description),
    cover: coverOf(m),
    animeType: formatOf(m.format),
  }));
}

export async function anime(id) {
  const m = (await call(DETAILS, { id: Number(id) })).Media;
  return {
    title: nameOf(m),
    originalTitle: m.title.native || m.title.romaji,
    year: m.startDate?.year || null,
    overview: clean(m.description),
    coverUrl: coverOf(m),
    seasons: 1,
    episodes: m.episodes || null,
    runtimeMinutes: m.duration || null,
    seasonInfo: null,
    airingStatus: STATUS[m.status] || null,
  };
}
