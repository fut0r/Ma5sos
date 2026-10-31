import { useEffect, useRef, useState } from 'react';
import Brand from './ui/Brand.jsx';
import { IconArrow, IconClose, IconMenu, IconMoon, IconSun } from './ui/Icons.jsx';
import { ACCOUNT_COPY } from '../data/account.js';
import { ACTIONS, LINKS, NAV } from '../data/content.js';
import { useSession } from '../lib/session.js';
import { useActiveSection } from '../lib/motion.js';
import './Header.css';

// The home-page section each link points at (hrefs look like "/#features").
const sectionOf = (href) => href.split('#')[1];
const SECTION_IDS = NAV.map((item) => sectionOf(item.href));

// Blocks that carry a palette of their own (see base.css).
const SURFACES = ['sheet', 'brand-surface', 'gold-surface'];

/**
 * The palette class of the block passing under the bar, or '' over the plain
 * page. The bar is see-through, so over a block of another colour it borrows
 * that block's palette; otherwise its links fade into what shows through.
 * Only a block as wide as the bar's content counts, not a single card.
 */
function useSurfaceBeneath(barRef) {
  const [surface, setSurface] = useState('');

  useEffect(() => {
    const blocks = [...document.querySelectorAll(SURFACES.map((name) => `main .${name}`).join(','))];

    const measure = () => {
      const bar = barRef.current;
      if (!bar || !bar.firstElementChild || !bar.lastElementChild) return;
      const first = bar.firstElementChild.getBoundingClientRect();
      const last = bar.lastElementChild.getBoundingClientRect();
      const left = Math.min(first.left, last.left);
      const right = Math.max(first.right, last.right);
      const { top, height } = bar.getBoundingClientRect();
      const line = top + height / 2;

      const beneath = blocks.find((block) => {
        const box = block.getBoundingClientRect();
        return box.top <= line && box.bottom > line && box.left <= left + 1 && box.right >= right - 1;
      });
      setSurface(beneath ? SURFACES.find((name) => beneath.classList.contains(name)) : '');
    };

    // Browsers send at most one scroll event per frame, so this needs no throttle.
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [barRef]);

  return surface;
}

export default function Header({ theme, onToggleTheme }) {
  const [open, setOpen] = useState(false);
  const activeId = useActiveSection(SECTION_IDS);
  const barRef = useRef(null);
  const surface = useSurfaceBeneath(barRef);
  // Signed in: "My account" (the package page) in place of "Sign in".
  const session = useSession();
  const account =
    session.status === 'user'
      ? { href: LINKS.create, label: ACCOUNT_COPY.account }
      : { href: LINKS.login, label: ACTIONS.login };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const close = () => setOpen(false);
  const dark = theme === 'dark';

  return (
    <header className={`header${surface ? ` ${surface}` : ''}`}>
      <div className="wrap header__bar" ref={barRef}>
        <Brand />

        <nav className="header__nav" aria-label="التنقل الرئيسي">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={sectionOf(item.href) === activeId ? 'true' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="header__actions">
          <button
            type="button"
            className="theme-switch"
            role="switch"
            aria-checked={dark}
            aria-label="الوضع الداكن"
            title={dark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
            onClick={onToggleTheme}
          >
            <span className="theme-switch__option" data-active={!dark}>
              <IconSun />
            </span>
            <span className="theme-switch__option" data-active={dark}>
              <IconMoon />
            </span>
          </button>
          <a className="header__login" href={account.href}>
            {account.label}
          </a>
          <a className="btn btn--primary btn--sm header__cta" href={LINKS.create}>
            {ACTIONS.create}
          </a>
          <button
            type="button"
            className="icon-btn header__menu-btn"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      <div className="header__panel" id="site-menu" data-open={open}>
        <nav className="wrap" aria-label="قائمة الجوال">
          {NAV.map((item) => (
            <a key={item.href} className="header__panel-link" href={item.href} onClick={close}>
              {item.label}
              <IconArrow size={20} />
            </a>
          ))}
          <div className="header__panel-actions">
            <a className="btn btn--ghost" href={account.href} onClick={close}>
              {account.label}
            </a>
            <a className="btn btn--primary" href={LINKS.create} onClick={close}>
              {ACTIONS.create}
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
