import { useEffect, useRef } from 'react';

const INTERACTIVE = 'button, a, input, select, [role="tab"]';

// A soft glow and a small ring that ease toward the pointer (lerp on rAF).
// Skipped on touch devices and when the user prefers reduced motion.
export default function CursorGlow() {
  const glow = useRef(null);
  const ring = useRef(null);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || calm) return;

    const target = { x: 0, y: 0 };
    const g = { x: 0, y: 0 };
    const r = { x: 0, y: 0 };
    let seen = false;
    let raf;

    const onMove = (e) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!seen) {
        seen = true;
        g.x = r.x = e.clientX;
        g.y = r.y = e.clientY;
        glow.current?.classList.add('on');
        ring.current?.classList.add('on');
      }
      ring.current?.classList.toggle('hot', !!e.target.closest?.(INTERACTIVE));
    };
    const onLeave = () => {
      seen = false;
      glow.current?.classList.remove('on');
      ring.current?.classList.remove('on');
    };

    const tick = () => {
      g.x += (target.x - g.x) * 0.08;
      g.y += (target.y - g.y) * 0.08;
      r.x += (target.x - r.x) * 0.2;
      r.y += (target.y - r.y) * 0.2;
      if (glow.current) glow.current.style.transform = `translate3d(${g.x}px, ${g.y}px, 0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('mousemove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <>
      <div ref={glow} className="cursor-glow" aria-hidden="true" />
      <div ref={ring} className="cursor-ring" aria-hidden="true"><i /></div>
    </>
  );
}
