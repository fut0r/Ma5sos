import { useMemo } from 'react';
import { Emblem } from './ui/Brand.jsx';
import {
  IconArrow,
  IconCalendar,
  IconCheck,
  IconClock,
  IconPin,
} from './ui/Icons.jsx';
import { SaduBand } from './ui/Sadu.jsx';
import QrCode from './ui/QrCode.jsx';
import { ACTIONS, BRAND, HERO, LINKS, SAMPLE_INVITE } from '../data/content.js';
import frame from '../assets/device/iphone-14-pro.svg';
import { formatEventDate, sampleEventDate } from '../lib/dates.js';
import './Hero.css';

// The invitation as a guest sees it on their phone: an iPhone 14 Pro, its
// frame drawn over the screen. The screen keeps its own paper colours in both
// themes, because it shows an invitation, not the site.
function Phone() {
  const date = useMemo(() => formatEventDate(sampleEventDate()), []);
  const invite = SAMPLE_INVITE;

  return (
    <figure className="phone" aria-label={`${invite.label} كما تظهر على جوال المدعو`}>
      <div className="phone__screen">
        <Emblem alt="" className="inv__emblem" />

        <p className="inv__status">
          <span className="inv__status-icon">
            <IconCheck size={14} />
          </span>
          تم تأكيد حضورك
        </p>

        <article className="inv__card">
          <SaduBand tiles={12} a="#d4af7c" b="#0f3d32" c="#fdfcf9" />
          <div className="inv__body">
            <p className="inv__kicker">{invite.kind}</p>
            <p className="inv__line">
              {invite.lines[0]}
              <br />
              {invite.lines[1]}
            </p>
            <p className="inv__name">{invite.name}</p>
          </div>
          <ul className="inv__meta">
            <li>
              <IconCalendar size={18} />
              <span>
                {date.weekday}، {date.gregorian}
                <small>{date.hijri}</small>
              </span>
            </li>
            <li>
              <IconClock size={18} />
              <span>{date.time}</span>
            </li>
            <li>
              <IconPin size={18} />
              <span>{invite.venue}</span>
            </li>
          </ul>
        </article>

        <div className="inv__pass">
          <div>
            <span className="inv__label">{invite.guestLabel}</span>
            <strong className="inv__guest">{invite.guest}</strong>
            <span className="inv__code">
              {invite.companions} · <span dir="ltr">{invite.code}</span>
            </span>
          </div>
          <QrCode className="inv__qr" value={invite.code} label={`رمز QR خاص بالمدعو ${invite.guest}`} />
        </div>

        <span className="phone__home" aria-hidden="true" />
      </div>
      <img className="phone__frame" src={frame} alt="" width="1339" height="2716" decoding="async" />
    </figure>
  );
}

export default function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero__grid">
        <div className="hero__copy">
          <p className="hero__chip">
            <span className="hero__chip-dot" aria-hidden="true" />
            {HERO.chip}
          </p>

          <p className="hero__brand">{BRAND.name}</p>

          <h1 className="hero__title" id="hero-title">
            {HERO.title}
          </h1>

          <p className="hero__sub">{HERO.text}</p>

          <div className="hero__actions">
            <a className="btn btn--primary" href={LINKS.create}>
              {ACTIONS.createNow}
              <IconArrow />
            </a>
            <a className="btn btn--ghost" href={LINKS.templates}>
              {ACTIONS.browseTemplates}
            </a>
          </div>

          <p className="hero__note">
            {HERO.note} <a href={LINKS.pricing}>{HERO.noteLink}</a>
          </p>

          <ul className="hero__facts">
            {HERO.facts.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon size={20} />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="hero__device">
          <Phone />
        </div>
      </div>
    </section>
  );
}
