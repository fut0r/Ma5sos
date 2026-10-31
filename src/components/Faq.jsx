import { useState } from 'react';
import SectionHead from './ui/SectionHead.jsx';
import { IconChevron } from './ui/Icons.jsx';
import { FAQ_COPY } from '../data/content.js';
import { FAQ } from '../data/faq.js';
import './Faq.css';

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="section" id="faq" aria-labelledby="faq-title">
      <div className="wrap">
        <SectionHead id="faq-title" eyebrow={FAQ_COPY.eyebrow} title={FAQ_COPY.title} />

        <div className="faq" data-reveal>
          {FAQ.map((item, index) => {
            const open = index === openIndex;
            return (
              <div key={item.q} className="faq__item" data-open={open}>
                <h3>
                  <button
                    type="button"
                    className="faq__q"
                    id={`faq-q-${index}`}
                    aria-expanded={open}
                    aria-controls={`faq-a-${index}`}
                    onClick={() => setOpenIndex(open ? -1 : index)}
                  >
                    {item.q}
                    <IconChevron className="faq__chevron" />
                  </button>
                </h3>
                <div className="faq__a" id={`faq-a-${index}`} role="region" aria-labelledby={`faq-q-${index}`}>
                  <div>
                    <p>{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
