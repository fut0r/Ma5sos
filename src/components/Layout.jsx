import { useCallback, useEffect, useState } from 'react';
import { ACTIONS, CONTACT_INFO, PENDING_PAGES } from '../data/content.js';
import { useReveal } from '../lib/motion.js';
import { useTheme } from '../lib/theme.js';
import { IconChat, IconCheck, IconClose, IconSend } from './ui/Icons.jsx';
import Header from './Header.jsx';
import Footer from './Footer.jsx';

const NOTICE_MS = 2800;

function ContactModal({ open, onClose }) {
  const [name, setName] = useState('');
  const [guests, setGuests] = useState('300');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const builtText = [
    `مرحبًا فريق مخصوص،`,
    name.trim() ? `معكم: ${name.trim()}` : '',
    guests.trim() ? `العدد المتوقع للمدعوين: ${guests.trim()} ضيف` : '',
    message.trim() ? `الاستفسار: ${message.trim()}` : 'أرغب في الاستفسار عن باقات مخصوص المخصصة.',
  ]
    .filter(Boolean)
    .join('\n');

  const waUrl = `https://wa.me/${CONTACT_INFO.whatsappNumber}?text=${encodeURIComponent(builtText)}`;
  const mailUrl = `mailto:${CONTACT_INFO.email}?subject=${encodeURIComponent('استفسار عبر منصة مخصوص')}&body=${encodeURIComponent(builtText)}`;

  const copyEmail = async () => {
    try {
      await navigator.clipboard?.writeText(CONTACT_INFO.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="contact-backdrop" onClick={onClose} role="presentation">
      <div
        className="contact-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="contact-modal__head">
          <div>
            <p className="head__eyebrow">{CONTACT_INFO.eyebrow}</p>
            <h2 id="contact-modal-title">{CONTACT_INFO.title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <IconClose size={20} />
          </button>
        </div>

        <div className="contact-modal__body">
          <p className="contact-modal__lead">{CONTACT_INFO.lead}</p>

          <div className="contact-modal__grid">
            <div className="field">
              <label htmlFor="contact-name">اسمك الكريم (اختياري)</label>
              <div className="field__box">
                <input
                  id="contact-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: عبدالله القحطاني"
                  maxLength={80}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="contact-guests">عدد المدعوين المتوقع</label>
              <div className="field__box">
                <input
                  id="contact-guests"
                  type="number"
                  min="10"
                  max="10000"
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  placeholder="300"
                />
              </div>
            </div>
          </div>

          <div className="field">
            <label htmlFor="contact-msg">تفاصيل مناسبتك أو استفسارك</label>
            <div className="field__box">
              <textarea
                id="contact-msg"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب استفسارك أو نوع المناسبة والخدمات الإضافية المطلوبة..."
                maxLength={800}
              />
            </div>
          </div>

          <div className="contact-modal__actions">
            <a className="btn btn--primary" href={waUrl} target="_blank" rel="noreferrer">
              <IconChat size={18} />
              <span>محادثة مباشرة عبر واتساب</span>
            </a>
            <a className="btn btn--secondary" href={mailUrl}>
              <IconSend size={18} />
              <span>إرسال بريد إلكتروني</span>
            </a>
          </div>

          <div className="contact-modal__meta">
            <span>أوقات العمل: {CONTACT_INFO.hours}</span>
            <button type="button" className="contact-modal__copy" onClick={copyEmail} dir="ltr">
              {copied ? (
                <>
                  <IconCheck size={14} /> تم نسخ البريد
                </>
              ) : (
                CONTACT_INFO.email
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Arriving with an address like "/#pricing" from another page: the browser
// looked for the section before React drew it, so go there once it exists, and
// again once the fonts have settled the layout (unless the visitor has scrolled).
function useHashTarget() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id && document.getElementById(id);
    if (!target) return;

    const go = () => target.scrollIntoView({ block: 'start', behavior: 'instant' });
    go();
    const landed = window.scrollY;
    document.fonts?.ready.then(() => {
      if (window.scrollY === landed) go();
    });
  }, []);
}

// What every page shares: header, footer, theme, scroll reveal and contact dialog.
export default function Layout({ children }) {
  const [theme, toggleTheme] = useTheme();
  const [notice, setNotice] = useState({ count: 0, visible: false });
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    if (!notice.visible) return undefined;
    const timer = window.setTimeout(() => setNotice((current) => ({ ...current, visible: false })), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const onRootClick = useCallback((event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (href === '#contact' || href === '/#contact') {
      event.preventDefault();
      setContactOpen(true);
      return;
    }
    if (PENDING_PAGES.hrefs.includes(href)) {
      event.preventDefault();
      setNotice((current) => ({ count: current.count + 1, visible: true }));
    }
  }, []);

  useReveal();
  useHashTarget();

  return (
    <div id="top" onClick={onRootClick}>
      <a className="skip" href="#main">
        {ACTIONS.skipToContent}
      </a>
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <main id="main">{children}</main>
      <Footer />
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
      <p className="notice" role="status" data-show={notice.visible}>
        {notice.count > 0 && <span key={notice.count}>{PENDING_PAGES.message}</span>}
      </p>
    </div>
  );
}
