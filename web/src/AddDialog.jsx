import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { KIND_LABEL, STATUS_LABEL, norm } from './utils.js';

const FILTERS = [['all', 'All'], ['movie', 'Movies'], ['series', 'Series'], ['anime', 'Anime']];
const keyOf = (r) => `${r.kind}:${r.source}:${r.externalId}`;

// Pop-up to find a new title and add it: search, pick a result, choose a status, Confirm (or Back).
export default function AddDialog({ library, onAdd, onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [picked, setPicked] = useState(null);
  const [status, setStatus] = useState('planning');
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  useEffect(() => {
    const term = q.trim();
    const id = ++seq.current;
    setPicked(null);
    if (term.length < 2) {
      setResults(null); setWarnings([]); setError(''); setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.search(term);
        if (id !== seq.current) return;
        setResults(data.results); setWarnings(data.warnings); setError('');
      } catch (e) {
        if (id === seq.current) { setError(e.message); setResults(null); }
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [q]);

  const ownedKeys = new Set(library.map(keyOf));
  const ownedAnime = library.filter((t) => t.kind === 'anime');
  // Anime may be in the library under another source (Jikan vs AniList): match by title + year.
  const isOwned = (r) =>
    ownedKeys.has(keyOf(r)) ||
    (r.kind === 'anime' && ownedAnime.some((t) => t.seasonInfo?.some((p) => p.externalId === r.externalId))) ||
    (r.kind === 'anime' &&
      ownedAnime.some(
        (t) =>
          (t.year == null || r.year == null || t.year === r.year) &&
          [norm(t.title), norm(t.originalTitle)].includes(norm(r.title))
      ));
  const shown = (results ?? []).filter((r) => filter === 'all' || r.kind === filter);

  async function confirm() {
    if (!picked || saving) return;
    setSaving(true); setError('');
    try {
      await onAdd({ kind: picked.kind, source: picked.source, externalId: picked.externalId, status });
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel modal adddialog" role="dialog" aria-modal="true" aria-label="Add a title">
        <button className="close" onClick={onClose} aria-label="Close">✕</button>
        <h2 className="display">Add a title</h2>

        <div className="qsearch big">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies, series, anime…"
            aria-label="Search titles to add"
            enterKeyHint="search"
          />
          {loading && <span className="spinner" />}
        </div>

        {results && (
          <div className="chips">
            {FILTERS.map(([v, l]) => (
              <button key={v} className={'chip' + (filter === v ? ' on' : '')} onClick={() => setFilter(v)}>{l}</button>
            ))}
          </div>
        )}

        <div className="addresults">
          {warnings.map((w) => <p key={w} className="warn">⚠ {w}</p>)}
          {!results && !error && !loading && <p className="muted pad">Type at least 2 characters.</p>}
          {results && shown.length === 0 && !loading && <p className="muted pad">No results.</p>}
          <ul>
            {shown.map((r) => {
              const owned = isOwned(r);
              const on = picked && keyOf(picked) === keyOf(r);
              return (
                <li key={keyOf(r)}>
                  <button className={'pick' + (on ? ' on' : '')} disabled={owned} aria-pressed={on} onClick={() => setPicked(on ? null : r)}>
                    {r.cover ? <img src={r.cover} alt="" loading="lazy" /> : <div className="poster none"><span>{r.title.slice(0, 1)}</span></div>}
                    <div className="rinfo">
                      <h4>{r.title} <small>{r.year ?? ''}</small></h4>
                      <span className="badge kind">{KIND_LABEL[r.kind]}{r.animeType ? ` · ${r.animeType}` : ''}</span>
                      <p className="muted clamp">{r.overview || 'No description.'}</p>
                      {owned && <span className="hud in">✓ In library</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {error && <p className="error">{error}</p>}
        <div className="group">
          <span className="hud">Add as</span>
          <div className="seg">
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <button key={v} className={status === v ? 'on' : ''} onClick={() => setStatus(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="mfoot">
          <button className="btn ghost" onClick={onClose}>Back</button>
          <button className="btn primary" disabled={!picked || saving} onClick={confirm}>
            {saving ? 'Adding…' : picked ? `Confirm · ${picked.title}` : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
