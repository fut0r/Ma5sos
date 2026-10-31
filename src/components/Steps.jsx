import SectionHead from './ui/SectionHead.jsx';
import { STEPS } from '../data/content.js';
import './Steps.css';

export default function Steps() {
  return (
    <section className="section" id="how" aria-labelledby="how-title">
      <div className="wrap">
        <SectionHead id="how-title" eyebrow={STEPS.eyebrow} title={STEPS.title} lead={STEPS.lead} />

        <ol className="steps">
          {STEPS.items.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="step" data-reveal style={{ '--reveal-index': index }}>
              <div className="step__top">
                <span className="tile">
                  <Icon />
                </span>
                <span className="step__num" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="step__title">{title}</h3>
              <p className="step__text">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
