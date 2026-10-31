import Brand from './ui/Brand.jsx';
import { BRAND, FOOTER_COLUMNS } from '../data/content.js';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__top">
        <div className="footer__brand">
          <Brand large />
          <div>
            <p className="footer__name">{BRAND.lockup}</p>
            <p className="footer__about">{BRAND.about}</p>
          </div>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <nav key={column.title} className="footer__col" aria-label={column.title}>
            <h2>{column.title}</h2>
            <ul>
              {column.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href} aria-current={link.href === window.location.pathname ? 'page' : undefined}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="wrap footer__bottom">
        <p>
          © {new Date().getFullYear()} {BRAND.name}. {BRAND.rights}
        </p>
        <p>{BRAND.location}</p>
      </div>
    </footer>
  );
}
