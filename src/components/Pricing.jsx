import SectionHead from './ui/SectionHead.jsx';
import { IconCheck, IconGift, IconStar } from './ui/Icons.jsx';
import { LINKS, PRICING, planLink } from '../data/content.js';
import { PLANS, SHARED_FEATURES, TRIAL } from '../data/plans.js';
import './Pricing.css';

function Checks({ items, className = '' }) {
  return (
    <ul className={`checks ${className}`.trim()}>
      {items.map((item) => (
        <li key={item}>
          <IconCheck size={18} />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function Pricing() {
  return (
    <section className="section" id="pricing" aria-labelledby="pricing-title">
      <div className="wrap">
        <SectionHead id="pricing-title" eyebrow={PRICING.eyebrow} title={PRICING.title} lead={PRICING.lead} />

        <div className="plans">
          {PLANS.map((plan, index) => (
            <article
              key={plan.id}
              className={`plan${plan.surface ? ` plan--featured ${plan.surface}-surface` : ''}`}
              data-reveal
              style={{ '--reveal-index': index }}
            >
              <p className="plan__tagline">
                <span>{plan.index}</span>
                {plan.tagline}
              </p>
              <h3 className="plan__name">
                {plan.name}
                {plan.recommended && <IconStar className="plan__star" size={20} />}
              </h3>

              <p className="plan__price">
                <span className="plan__amount">{plan.price}</span>
                <span className="plan__unit">{PRICING.currency}</span>
              </p>

              <Checks items={plan.features} className="plan__list" />

              <a className={`btn btn--block ${plan.surface ? 'btn--primary' : 'btn--ghost'}`} href={planLink(plan.id)}>
                {PRICING.choose}
              </a>
            </article>
          ))}
        </div>

        <div className="plans__more">
          <article className="trial" data-reveal>
            <div className="trial__head">
              <span className="tile">
                <IconGift />
              </span>
              <div>
                <h3 className="trial__name">{TRIAL.name}</h3>
                <p className="trial__tagline">{TRIAL.tagline}</p>
              </div>
              <p className="trial__price">{PRICING.free}</p>
            </div>
            <Checks items={TRIAL.features} className="checks--two" />
            <a className="btn btn--ghost trial__cta" href={planLink(TRIAL.id)}>
              {PRICING.startFree}
            </a>
          </article>

          <section className="shared" aria-labelledby="shared-title" data-reveal style={{ '--reveal-index': 1 }}>
            <h3 className="shared__title" id="shared-title">
              {PRICING.sharedTitle}
            </h3>
            <Checks items={SHARED_FEATURES} />
          </section>
        </div>

        <div className="plans__notes" data-reveal>
          <ul className="paymethods" aria-label={PRICING.methodsLabel}>
            <li className="paymethods__label" aria-hidden="true">
              {PRICING.methodsLabel}
            </li>
            {PRICING.methods.map((method) => (
              <li key={method} className="paymethods__item">
                {method}
              </li>
            ))}
          </ul>
          <p>{PRICING.note}</p>
          <p>
            {PRICING.contact.before} <a href={LINKS.contact}>{PRICING.contact.link}</a> {PRICING.contact.after}
          </p>
        </div>
      </div>
    </section>
  );
}
