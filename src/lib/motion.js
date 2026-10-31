import { useEffect, useState } from 'react';

/*
 * Scroll reveal. Blocks marked `data-reveal` start hidden and rise in once, the
 * first time they scroll into view (styles in base.css). index.html adds the
 * `reveal-ready` class only when the browser can do this and the visitor has
 * not asked for reduced motion; otherwise everything is simply visible.
 */
export function useReveal() {
  useEffect(() => {
    if (!document.documentElement.classList.contains('reveal-ready')) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-revealed', '');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );

    document.querySelectorAll('[data-reveal]:not([data-revealed])').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/*
 * Returns the id of the section currently crossing a thin band just above the
 * middle of the screen, or null between sections. `ids` must be a stable array.
 */
export function useActiveSection(ids) {
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;

    const inBand = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        setActive(ids.find((id) => inBand.has(id)) ?? null);
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );

    ids.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
