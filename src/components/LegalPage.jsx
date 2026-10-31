import { useEffect, useMemo, useState } from 'react';
import { IconChevron } from './ui/Icons.jsx';
import { LEGAL_COPY } from '../data/content.js';
import { useActiveSection } from '../lib/motion.js';
import './LegalPage.css';

// Wide enough for the contents to sit beside the text, always open.
const WIDE = '(min-width: 1025px)';

const anchor = (index) => `clause-${index + 1}`;

function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);

  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const onChange = () => setWide(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return wide;
}

function Block({ block }) {
  if (typeof block === 'string') return <p>{block}</p>;

  return (
    <dl className="legal__terms">
      {block.define.map(([term, meaning]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A legal document (terms, privacy policy): its title and date, numbered
 * sections, and a list of contents that follows the reader. On narrow screens
 * the contents fold away above the text.
 */
export default function LegalPage({ doc }) {
  const ids = useMemo(() => doc.sections.map((_, index) => anchor(index)), [doc]);
  const active = useActiveSection(ids);
  const wide = useWide();

  return (
    <article className="legal" aria-labelledby="legal-title">
      <header className="wrap legal__head">
        <p className="head__eyebrow">{LEGAL_COPY.eyebrow}</p>
        <h1 className="legal__title" id="legal-title">
          {doc.title}
        </h1>
        <p className="legal__updated">
          {LEGAL_COPY.updated} <time dateTime={doc.updated.iso}>{doc.updated.text}</time>
        </p>
      </header>

      <div className="wrap legal__grid">
        <nav className="legal__toc" aria-label={LEGAL_COPY.contents}>
          {/* Open and fixed on wide screens; the reader folds it on narrow ones. */}
          <details open={wide}>
            <summary onClick={(event) => wide && event.preventDefault()}>
              {LEGAL_COPY.contents}
              <IconChevron className="legal__chevron" size={20} />
            </summary>
            <ol>
              {doc.sections.map((section, index) => (
                <li key={section.title}>
                  <a href={`#${anchor(index)}`} aria-current={active === anchor(index) ? 'true' : undefined}>
                    <span>{index + 1}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        </nav>

        <div className="legal__body">
          <div className="legal__intro">
            {doc.intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          {doc.sections.map((section, index) => (
            <section key={section.title} id={anchor(index)} className="legal__section">
              <h2>
                <span aria-hidden="true">{index + 1}</span>
                {section.title}
              </h2>
              {section.body.map((block, blockIndex) => (
                <Block key={blockIndex} block={block} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
