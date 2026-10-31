import logo from '../../assets/brand/logo.webp';
import logoSmall from '../../assets/brand/logo-small.webp';
import { BRAND, LINKS } from '../../data/content.js';
import './Brand.css';

// The artwork's own proportions (800x577), so the browser keeps its place before it loads.
const SIZE = { width: 800, height: 577 };

/**
 * The Ma5sos (مخصوص) emblem with transparent background. It carries the name
 * "مخصوص" and tagline "لأنك المقصود" inside it, and reads clearly on both dark
 * and light themes. `large` picks the higher-resolution file; pass `alt=""`
 * where it is only decoration.
 */
export function Emblem({ large = false, alt = BRAND.logoAlt, className = '' }) {
  return (
    <img
      className={`emblem ${className}`.trim()}
      src={large ? logo : logoSmall}
      alt={alt}
      decoding="async"
      {...SIZE}
    />
  );
}

// The emblem alone, linking home: header size by default, `large` in the footer.
export default function Brand({ large = false }) {
  return (
    <a className={`brand${large ? ' brand--large' : ''}`} href={LINKS.home} aria-label={BRAND.homeLabel}>
      <Emblem large={large} />
    </a>
  );
}
