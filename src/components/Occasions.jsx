import { useState } from 'react';
import SectionHead from './ui/SectionHead.jsx';
import { IconArrow, IconCheck } from './ui/Icons.jsx';
import { LINKS, OCCASIONS_COPY } from '../data/content.js';
import { OCCASIONS } from '../data/occasions.js';
import { useSession } from '../lib/session.js';
import { splitWording } from '../lib/wording.js';
import './Occasions.css';

// Left arrow moves forward because the tabs read right-to-left.
const KEY_STEPS = { ArrowLeft: 1, ArrowDown: 1, ArrowRight: -1, ArrowUp: -1 };

export default function Occasions() {
  const [activeId, setActiveId] = useState(OCCASIONS[0].id);
  const [copied, setCopied] = useState(false);
  const session = useSession();
  const active = OCCASIONS.find((occasion) => occasion.id === activeId);

  const onKeyDown = (event) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const index = OCCASIONS.findIndex((occasion) => occasion.id === activeId);
    const next = OCCASIONS[(index + step + OCCASIONS.length) % OCCASIONS.length];
    setActiveId(next.id);
    setCopied(false);
    document.getElementById(`occasion-tab-${next.id}`)?.focus();
  };

  const copyWording = async () => {
    if (!active) return;
    const plain = active.wording.replace(/\{([^}]+)\}/g, '[$1]');
    try {
      await navigator.clipboard?.writeText(plain);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore */
    }
  };

  const rememberOccasion = () => {
    try {
      if (active) {
        localStorage.setItem('ma5sos_selected_occasion', active.id);
        localStorage.setItem('ma5sos_selected_wording', active.wording);
      }
    } catch {
      /* ignore */
    }
  };

  const startHref =
    session.status === 'user' ? `/admin/?occasion=${encodeURIComponent(active.id)}` : LINKS.create;

  return (
    <section className="section" id="occasions" aria-labelledby="occasions-title">
      <div className="wrap">
        <SectionHead
          id="occasions-title"
          eyebrow={OCCASIONS_COPY.eyebrow}
          title={OCCASIONS_COPY.title}
          lead={OCCASIONS_COPY.lead}
        />

        <div
          className="otabs"
          role="tablist"
          aria-label={OCCASIONS_COPY.tabsLabel}
          onKeyDown={onKeyDown}
          data-reveal
        >
          {OCCASIONS.map(({ id, name, icon: Icon }) => {
            const selected = id === activeId;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`occasion-tab-${id}`}
                className="otabs__tab"
                aria-selected={selected}
                aria-controls="occasion-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  setActiveId(id);
                  setCopied(false);
                }}
              >
                <Icon size={20} />
                {name}
              </button>
            );
          })}
        </div>

        <div
          className="ocard"
          role="tabpanel"
          id="occasion-panel"
          aria-labelledby={`occasion-tab-${active.id}`}
          data-reveal
        >
          {/* Keyed by occasion, so the new wording eases in when the tab changes. */}
          <div className="ocard__main">
            <div className="ocard__swap" key={active.id}>
              <p className="ocard__kind">
                <span className="pill">{OCCASIONS_COPY.suggested}</span>
                {active.kind}
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ marginInlineStart: 'auto' }}
                  onClick={copyWording}
                >
                  {copied ? (
                    <>
                      <IconCheck size={16} />
                      <span>{OCCASIONS_COPY.copiedWording}</span>
                    </>
                  ) : (
                    <span>{OCCASIONS_COPY.copyWording}</span>
                  )}
                </button>
              </p>
              <blockquote className="ocard__wording">
                {splitWording(active.wording).map((part, index) =>
                  part.blank ? (
                    <span key={index} className="ocard__blank-wrap">
                      <span className="ocard__blank">{part.blank}</span>
                      {part.tail}
                    </span>
                  ) : (
                    part.text
                  ),
                )}
              </blockquote>
            </div>
          </div>

          <div className="ocard__side">
            <h3 className="ocard__side-title">{OCCASIONS_COPY.fieldsTitle}</h3>
            <ul className="ocard__fields ocard__swap" key={active.id}>
              {active.fields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
            <a className="btn btn--primary" href={startHref} onClick={rememberOccasion}>
              {OCCASIONS_COPY.start} {active.kind}
              <IconArrow />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
