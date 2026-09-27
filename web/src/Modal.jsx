import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Poster } from './Card.jsx';
import { KIND_LABEL, STATUS_LABEL, fmtRuntime, hasProgress, seasonEp } from './utils.js';

export default function Modal({ t, onClose, onChange, onRemove }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  async function run(fn) {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const patch = (body) => run(async () => onChange(await api.update(t.id, body)));
  const refresh = () => run(async () => onChange(await api.refresh(t.id)));
  const remove = () => run(async () => { await api.remove(t.id); onRemove(t.id); });

  const progress = hasProgress(t);
  const se = seasonEp(t);
  const pct = t.episodes ? Math.min(100, (t.episodesWatched / t.episodes) * 100) : 0;

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel modal" role="dialog" aria-modal="true" aria-label={t.title}>
        <button className="close" onClick={onClose} aria-label="Close">✕</button>
        <div className="mhead">
          <Poster t={t} className="mposter" />
          <div>
            <p className="hud">{KIND_LABEL[t.kind]}{t.airingStatus ? ` · ${t.airingStatus}` : ''}</p>
            <h2 className="display">{t.title}</h2>
            {t.originalTitle && t.originalTitle !== t.title && <p className="muted">{t.originalTitle}</p>}
            <p className="facts">
              {[t.year, (t.seasons > 1 || t.kind === 'series') && t.seasons && `${t.seasons} season${t.seasons > 1 ? 's' : ''}`,
                t.kind !== 'movie' && t.episodes && `${t.episodes} episodes`,
                fmtRuntime(t.runtimeMinutes) && (t.kind === 'movie' ? fmtRuntime(t.runtimeMinutes) : `${fmtRuntime(t.runtimeMinutes)} / ep`),
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        <p className="overview">{t.overview || 'No description available.'}</p>

        <div className="group">
          <span className="hud">Status</span>
          <div className="seg">
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <button key={v} className={t.status === v ? 'on' : ''} disabled={busy} onClick={() => t.status !== v && patch({ status: v })}>{l}</button>
            ))}
          </div>
        </div>

        {progress && (
          <div className="group">
            <span className="hud">Progress{se ? ` · S${se.season} E${se.episode}` : ''}</span>
            <div className="stepper">
              <button className="btn small" disabled={busy || t.episodesWatched <= 0} onClick={() => patch({ episodesWatched: t.episodesWatched - 1 })}>−</button>
              <strong>{t.episodesWatched}{t.episodes ? ` / ${t.episodes}` : ''}</strong>
              <button className="btn small" disabled={busy || (t.episodes && t.episodesWatched >= t.episodes)} onClick={() => patch({ episodesWatched: t.episodesWatched + 1 })}>+ ep</button>
            </div>
            {t.episodes > 0 && <div className="bar big"><i style={{ width: pct + '%' }} /></div>}
          </div>
        )}

        {error && <p className="error">{error}</p>}
        <div className="mfoot">
          <button className="btn ghost small" disabled={busy} onClick={refresh}>↻ Refresh data</button>
          {confirm ? (
            <>
              <button className="btn danger small" disabled={busy} onClick={remove}>Confirm remove</button>
              <button className="btn ghost small" onClick={() => setConfirm(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn ghost small" disabled={busy} onClick={() => setConfirm(true)}>Remove</button>
          )}
        </div>
      </div>
    </div>
  );
}
