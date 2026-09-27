export const KIND_LABEL = { movie: 'Movie', series: 'Series', anime: 'Anime' };
export const STATUS_LABEL = { planning: 'Planning', watching: 'Watching', watched: 'Completed' };

export function fmtRuntime(min) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

// Short "size" line for cards: duration for movies, seasons/episodes for shows.
export function metaLine(t) {
  if (t.kind === 'movie') return fmtRuntime(t.runtimeMinutes) || 'Duration unknown';
  const parts = [];
  if (t.seasons > 1 || (t.kind === 'series' && t.seasons)) parts.push(`${t.seasons} season${t.seasons > 1 ? 's' : ''}`);
  parts.push(t.episodes ? `${t.episodes} ep${t.episodes > 1 ? 's' : ''}` : '? eps');
  if (t.episodes === 1 && t.runtimeMinutes) parts.push(fmtRuntime(t.runtimeMinutes));
  return parts.join(' · ');
}

export const hasProgress = (t) => t.kind !== 'movie' && !(t.kind === 'anime' && t.episodes === 1);

// Converts a flat "episodes watched" count into season/episode using per-season counts.
export function seasonEp(t) {
  const info = t.seasonInfo;
  if (!info || !t.episodesWatched) return null;
  let left = t.episodesWatched;
  for (const s of info) {
    if (left <= s.episodes) return { season: s.season, episode: left };
    left -= s.episodes;
  }
  return null;
}

// Must match the server's notion of "same anime" (title + year across Jikan/AniList).
export const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
