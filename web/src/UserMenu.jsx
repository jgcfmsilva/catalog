import { useEffect, useRef, useState } from 'react';

export default function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !box.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="usermenu" ref={box}>
      <button className="usericon" onClick={() => setOpen((o) => !o)} aria-label="User menu" aria-expanded={open} aria-haspopup="true">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
        </svg>
      </button>
      {open && (
        <div className="panel userpop" role="menu">
          <div>
            <span className="hud">Signed in as</span>
            <strong>{user.username}</strong>
          </div>
          <button className="logout" role="menuitem" onClick={onLogout} aria-label="Log out" title="Log out">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 4H5v16h4" />
              <path d="M16 8l4 4-4 4" />
              <path d="M20 12H9" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
