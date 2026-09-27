import { useState } from 'react';
import { KIND_LABEL, STATUS_LABEL, metaLine, hasProgress } from './utils.js';

// Covers are static files; if one fails to load (transient error), retry a couple of times, then show the placeholder.
export function Poster({ t, className = '' }) {
  const [tries, setTries] = useState(0);
  if (!t.coverUrl || tries > 2) {
    return <div className={'poster none ' + className}><span>{t.title.slice(0, 1)}</span></div>;
  }
  const src = tries ? `${t.coverUrl}?r=${tries}` : t.coverUrl;
  return (
    <img
      key={src}
      className={'poster ' + className}
      src={src}
      alt=""
      decoding="async"
      onError={() => setTimeout(() => setTries((n) => n + 1), 600)}
    />
  );
}

export default function Card({ t, onOpen, onRemove }) {
  const pct = hasProgress(t) && t.episodes ? Math.min(100, (t.episodesWatched / t.episodes) * 100) : t.status === 'watched' ? 100 : 0;
  return (
    <div className="cardwrap">
      <button className={`card s-${t.status}`} onClick={onOpen}>
        <div className="frame">
          <Poster t={t} />
          <span className="badge kind">{KIND_LABEL[t.kind]}</span>
          <span className={`badge status s-${t.status}`}>{STATUS_LABEL[t.status]}</span>
          {t.status !== 'planning' && <div className="bar"><i style={{ width: pct + '%' }} /></div>}
        </div>
        <div className="info">
          <h3>{t.title}</h3>
          <p className="muted">{t.year ?? '—'} · {metaLine(t)}</p>
        </div>
      </button>
      <button className="cardx" onClick={onRemove} aria-label={`Remove ${t.title}`} title="Remove">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
      </button>
    </div>
  );
}
