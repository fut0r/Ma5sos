import { IconArrow } from './ui/Icons.jsx';
import { ACTIONS, CLOSING, LINKS } from '../data/content.js';
import './Closing.css';

export default function Closing() {
  return (
    <section className="section" aria-labelledby="closing-title">
      <div className="wrap">
        <div className="brand-surface closing" data-reveal>
          <p className="head__eyebrow">{CLOSING.eyebrow}</p>
          <h2 className="closing__title" id="closing-title">
            {CLOSING.title}
          </h2>
          <p className="closing__text">{CLOSING.text}</p>
          <div className="closing__actions">
            <a className="btn btn--primary" href={LINKS.create}>
              {ACTIONS.createNow}
              <IconArrow />
            </a>
            <a className="btn btn--ghost" href={LINKS.login}>
              {ACTIONS.login}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
