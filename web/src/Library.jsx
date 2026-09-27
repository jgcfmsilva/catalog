import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { norm } from './utils.js';
import { Logo } from './Logo.jsx';
import AddDialog from './AddDialog.jsx';
import Card from './Card.jsx';
import Modal from './Modal.jsx';
import UserMenu from './UserMenu.jsx';

const TABS = [['watching', 'Watching'], ['planning', 'Planning'], ['watched', 'Completed'], ['all', 'All']];
const SORTS = [['recent', 'Recent'], ['az', 'A–Z']];
const KINDS = [['shows', 'Series / Anime'], ['movie', 'Movies'], ['all', 'Everything']];
const matchKind = (kind, t) => kind === 'all' || (kind === 'shows' ? t.kind === 'series' || t.kind === 'anime' : t.kind === kind);

export default function Library({ user, onLogout }) {
  const [titles, setTitles] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('watching');
  const [kind, setKind] = useState('shows');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toRemove, setToRemove] = useState(null); // title pending a delete confirmation
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    api.list().then(setTitles).catch((e) => setError(e.message));
  }, []);

  const upsert = (t) =>
    setTitles((list) => {
      const rest = list.filter((x) => x.id !== t.id);
      return [t, ...rest].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    });
  const drop = (id) => setTitles((list) => list.filter((x) => x.id !== id));

  const needle = norm(query);
  const matchQuery = (t) => !needle || norm(t.title).includes(needle) || norm(t.originalTitle).includes(needle);

  const counts = useMemo(() => {
    const c = { all: 0, watching: 0, planning: 0, watched: 0 };
    for (const t of titles ?? []) {
      if (matchKind(kind, t) && matchQuery(t)) { c.all++; c[t.status]++; }
    }
    return c;
  }, [titles, kind, needle]);

  const visible = (titles ?? []).filter(
    (t) => (tab === 'all' || t.status === tab) && matchKind(kind, t) && matchQuery(t)
  );
  // 'recent' keeps the server order (last updated first).
  if (sort === 'az') visible.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }));
  const open = titles?.find((t) => t.id === openId);

  async function confirmRemove() {
    setRemoving(true);
    try {
      await api.remove(toRemove.id);
      drop(toRemove.id);
      setToRemove(null);
    } catch (e) {
      setError(e.message);
      setToRemove(null);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Logo />
        <div className="topactions">
          <button className="usericon addbtn" onClick={() => setAdding(true)} aria-label="Add a title" title="Add a title">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </header>

      <nav className="filters" aria-label="Library filters">
        <div className="tabs" role="tablist">
          {TABS.map(([v, label]) => (
            <button key={v} role="tab" aria-selected={tab === v} className={'tab' + (tab === v ? ' on' : '')} onClick={() => setTab(v)}>
              {label} <b>{counts[v]}</b>
            </button>
          ))}
        </div>
        <div className="qsearch">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder="Filter your library"
            aria-label="Search your library"
          />
          {query && <button className="clear" onClick={() => setQuery('')} aria-label="Clear library search">✕</button>}
        </div>
        <div className="chips">
          <div className="chipgroup sorts">
            {SORTS.map(([v, label]) => (
              <button key={v} className={'chip sort' + (sort === v ? ' on' : '')} onClick={() => setSort(v)} aria-pressed={sort === v}>{label}</button>
            ))}
          </div>
          <span className="chip-sep" aria-hidden="true" />
          <div className="chipgroup kinds">
            {KINDS.map(([v, label]) => (
              <button key={v} className={'chip' + (kind === v ? ' on' : '')} onClick={() => setKind(v)}>{label}</button>
            ))}
          </div>
        </div>
      </nav>

      {error && <p className="error">{error}</p>}
      {titles === null && !error && <div className="boot small"><span className="spinner" /></div>}
      {titles && visible.length === 0 && (
        <div className="empty panel">
          <p className="display">{titles.length ? 'Nothing here yet' : 'Your library is empty'}</p>
          <p className="muted">{titles.length ? 'Try another filter or search.' : 'Search for a movie, series or anime above to add your first title.'}</p>
        </div>
      )}
      <main className="grid">
        {visible.map((t) => <Card key={t.id} t={t} onOpen={() => setOpenId(t.id)} onRemove={() => setToRemove(t)} />)}
      </main>

      {adding && (
        <AddDialog
          library={titles ?? []}
          onAdd={async (body) => upsert(await api.add(body))}
          onClose={() => setAdding(false)}
        />
      )}

      {toRemove && (
        <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && !removing && setToRemove(null)}>
          <div className="panel modal confirm" role="alertdialog" aria-modal="true" aria-label="Remove title">
            <h2 className="display">Remove title?</h2>
            <p className="overview"><strong>{toRemove.title}</strong> will be removed from your library, including its cover.</p>
            <div className="mfoot">
              <button className="btn ghost" disabled={removing} onClick={() => setToRemove(null)}>Cancel</button>
              <button className="btn danger" disabled={removing} onClick={confirmRemove}>{removing ? 'Removing…' : 'Remove'}</button>
            </div>
          </div>
        </div>
      )}

      {open && <Modal t={open} onClose={() => setOpenId(null)} onChange={upsert} onRemove={(id) => { drop(id); setOpenId(null); }} />}
    </div>
  );
}
