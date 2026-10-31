import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SectionHead from './ui/SectionHead.jsx';
import PhotoInvite from './ui/PhotoInvite.jsx';
import TemplatePreview from './TemplatePreview.jsx';
import { IconArrow } from './ui/Icons.jsx';
import { LINKS, TEMPLATES_COPY } from '../data/content.js';
import { PHOTO_TEMPLATES } from '../data/photoTemplates.js';
import { formatEventDate, sampleEventDate } from '../lib/dates.js';
import { useSession } from '../lib/session.js';
import './Templates.css';

const CATEGORIES = [
  { id: 'all', label: 'الكل', count: PHOTO_TEMPLATES.length },
  { id: 'زواج', label: 'زواج وأفراح', match: ['زواج', 'أفراح رجالية'] },
  { id: 'ملكة', label: 'ملكة وخطوبة وحنّاء', match: ['ملكة', 'خطوبة', 'حنّاء'] },
  { id: 'تخرّج', label: 'تخرّج', match: ['تخرّج'] },
  { id: 'مولود', label: 'مواليد واجتماعات', match: ['مولود', 'اجتماع عائلي'] },
];

export function selectTemplateHref(templateId, isSignedIn) {
  const target = isSignedIn
    ? `/admin/?template=${encodeURIComponent(templateId)}`
    : `${LINKS.create}?template=${encodeURIComponent(templateId)}`;
  return target;
}

export function rememberTemplate(templateId) {
  try {
    if (templateId) localStorage.setItem('ma5sos_selected_template', templateId);
  } catch {
    /* ignore storage errors */
  }
}

function PhotoCard({ template, date, onPreview, isSignedIn }) {
  const label = `${TEMPLATES_COPY.previewOf} ${template.name}`;
  const useHref = selectTemplateHref(template.id, isSignedIn);

  return (
    <li className="tcard tcard--photo">
      <button type="button" className="tcard__stage tcard__stage--photo" onClick={onPreview} aria-label={label}>
        <PhotoInvite template={template} date={date} />
      </button>
      <div className="tcard__body">
        <div className="tcard__top">
          <h3 className="tcard__name">{template.name}</h3>
          <span className="pill">{template.occasion}</span>
        </div>
        <p className="tcard__text">{template.description}</p>
        <div className="tcard__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={onPreview}>
            {TEMPLATES_COPY.preview}
          </button>
          <a
            className="btn btn--ghost btn--sm"
            href={useHref}
            onClick={() => rememberTemplate(template.id)}
          >
            {TEMPLATES_COPY.use}
          </a>
        </div>
      </div>
    </li>
  );
}

export default function Templates() {
  const trackRef = useRef(null);
  const session = useSession();
  const isSignedIn = session.status === 'user';
  const [preview, setPreview] = useState(null);
  const [category, setCategory] = useState('all');
  const [edge, setEdge] = useState({ start: true, end: false, scrollable: true });
  const date = useMemo(() => formatEventDate(sampleEventDate()), []);

  const visibleTemplates = useMemo(() => {
    if (category === 'all') return PHOTO_TEMPLATES;
    const activeCat = CATEGORIES.find((c) => c.id === category);
    if (!activeCat?.match) return PHOTO_TEMPLATES;
    return PHOTO_TEMPLATES.filter((t) => activeCat.match.includes(t.occasion));
  }, [category]);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const travelled = Math.abs(track.scrollLeft);
    const total = track.scrollWidth - track.clientWidth;
    setEdge({ start: travelled < 8, end: travelled > total - 8, scrollable: total > 8 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, visibleTemplates]);

  const move = (direction) => {
    const track = trackRef.current;
    const card = track?.querySelector('.tcard');
    if (!card) return;
    const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap);
    const rtl = getComputedStyle(track).direction === 'rtl';
    track.scrollBy({ left: direction * step * (rtl ? -1 : 1), behavior: 'smooth' });
  };

  return (
    <section className="section" id="templates" aria-labelledby="templates-title">
      <div className="wrap">
        <SectionHead
          id="templates-title"
          eyebrow={TEMPLATES_COPY.eyebrow}
          title={TEMPLATES_COPY.title}
          lead={TEMPLATES_COPY.lead}
        />

        <div className="ttabs" data-reveal>
          <div className="otabs" role="tablist" aria-label="تصفية القوالب حسب المناسبة">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                className="otabs__tab"
                aria-selected={category === cat.id}
                onClick={() => {
                  setCategory(cat.id);
                  trackRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <p className="ttabs__hint">اختر من القوالب الاثني عشر الفاخرة، وسيظهر القالب الذي تختاره وحده في رابط الدعوة.</p>
        </div>
      </div>

      <ul
        className="tcarousel tcarousel--photo"
        id="tlist"
        ref={trackRef}
        onScroll={measure}
        tabIndex={edge.scrollable ? 0 : undefined}
        data-reveal
      >
        {visibleTemplates.map((template) => (
          <PhotoCard
            key={template.id}
            template={template}
            date={date}
            isSignedIn={isSignedIn}
            onPreview={() => setPreview(template)}
          />
        ))}
      </ul>

      <div className="wrap tcarousel__nav" data-reveal>
        <button
          type="button"
          className="icon-btn tcarousel__prev"
          onClick={() => move(-1)}
          disabled={edge.start}
          aria-label={TEMPLATES_COPY.prev}
        >
          <IconArrow />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => move(1)}
          disabled={edge.end}
          aria-label={TEMPLATES_COPY.next}
        >
          <IconArrow />
        </button>
      </div>

      <TemplatePreview
        template={preview}
        date={date}
        isSignedIn={isSignedIn}
        onClose={() => setPreview(null)}
      />
    </section>
  );
}
