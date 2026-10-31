import SectionHead from './ui/SectionHead.jsx';
import { FEATURES } from '../data/content.js';
import './Features.css';

export default function Features() {
  return (
    <section className="section sheet features" id="features" aria-labelledby="features-title">
      <div className="wrap">
        <SectionHead
          id="features-title"
          align="start"
          eyebrow={FEATURES.eyebrow}
          title={FEATURES.title}
          lead={FEATURES.lead}
        />

        <ol className="flist" data-reveal>
          {FEATURES.items.map(({ id, icon: Icon, title, tagline, text, spotlight }, index) => (
            <li key={id} className={`flist__row${spotlight ? ' flist__row--spotlight' : ''}`}>
              <span className="flist__num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="flist__copy">
                <h3>{title}</h3>
                <p className="flist__tagline">{tagline}</p>
                <p>{text}</p>
              </div>
              <span className="tile">
                <Icon />
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
