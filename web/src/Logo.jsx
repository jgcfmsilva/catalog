export function Logo({ big }) {
  return (
    <div className={'logo' + (big ? ' big' : '')}>
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c084fc" />
            <stop offset="1" stopColor="#e879f9" />
          </linearGradient>
        </defs>
        <path d="M16 3.6l10.7 6.2v12.4L16 28.4 5.3 22.2V9.8z" fill="none" stroke="url(#logo-g)" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M13.2 11.4l8 4.6-8 4.6z" fill="url(#logo-g)" stroke="url(#logo-g)" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span>CATALOG</span>
    </div>
  );
}
