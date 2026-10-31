import { useEffect, useMemo, useRef, useState } from 'react';
import { PHOTO_TEMPLATES } from '../../data/photoTemplates.js';
import { formatEventDate } from '../../lib/dates.js';
import { normalizeSaudiMobile } from '../../lib/phone.js';
import { encodeGuestQr } from '../../lib/qrPayload.js';
import PhotoInvite from '../ui/PhotoInvite.jsx';
import QrCode from '../ui/QrCode.jsx';
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconClose,
  IconClock,
  IconNote,
  IconPin,
  IconPrint,
  IconQr,
  IconSend,
  IconUsers,
} from '../ui/Icons.jsx';
import './PublicInvitePage.css';

const OCCASION_KICKERS = {
  wedding: 'دعوة زواج',
  milka: 'عقد قران وملكة',
  graduation: 'حفل تخرّج',
  baby: 'استقبال مولود',
  party: 'حفلة خاصة',
  general: 'دعوة خاصة',
};

function prettyPhone(value) {
  const normalized = normalizeSaudiMobile(value);
  return normalized ? `0${normalized.slice(4)}` : value || '';
}

function buildGoogleCalendarUrl(eventData) {
  if (!eventData?.event_date) return '';
  const start = new Date(eventData.event_date);
  if (Number.isNaN(start.getTime())) return '';
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventData.title || 'مناسبة',
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `${eventData.description || ''}\nالداعي: ${eventData.host_name || ''}`.trim(),
    location: [eventData.venue_name, eventData.venue_address].filter(Boolean).join(' - '),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function useCountdown(targetDateStr) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    if (!targetDateStr) return null;
    const target = new Date(targetDateStr).getTime();
    if (Number.isNaN(target)) return null;
    const diff = target - now;
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    return { days, hours, minutes };
  }, [targetDateStr, now]);
}

export default function PublicInvitePage() {
  const [shareCode, setShareCode] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [eventData, setEventData] = useState(null);
  const [guest, setGuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form fields (used for both private guest token response and public RSVP submission)
  const [status, setStatus] = useState('confirmed');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [companionsCount, setCompanionsCount] = useState(0);
  const [guestNotes, setGuestNotes] = useState('');
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [passMessage, setPassMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const passRef = useRef(null);

  const countdown = useCountdown(eventData?.event_date);
  const calendarUrl = useMemo(() => buildGoogleCalendarUrl(eventData), [eventData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('code') || params.get('c') || '').trim();
    const token = (params.get('guest') || params.get('g') || '').trim();
    setShareCode(code);
    setInviteToken(token);

    if (!code) {
      setError('رابط الدعوة غير مكتمل. اطلب من صاحب المناسبة إرسال الرابط الكامل.');
      setLoading(false);
      return;
    }

    let active = true;

    const load = async () => {
      const endpoint = token
        ? `/api/public/invite/${encodeURIComponent(code)}/guest/${encodeURIComponent(token)}`
        : `/api/public/invite/${encodeURIComponent(code)}`;

      try {
        const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.detail || data?.message || 'لم نتمكن من العثور على تفاصيل هذه الدعوة.');
        }
        if (!active) return;

        if (token) {
          if (!data?.guest) {
            throw new Error('رابط الدعوة غير صالح. تواصل مع صاحب المناسبة للحصول على رابط جديد.');
          }
          setGuest(data.guest);
          setGuestName(data.guest.guest_name || '');
          setGuestPhone(prettyPhone(data.guest.phone));
          setCompanionsCount(Number(data.guest.companions_count) || 0);
          setGuestNotes(data.guest.notes || '');
          setStatus(data.guest.status === 'declined' ? 'declined' : 'confirmed');
        } else {
          // Check if the visitor previously confirmed on this device
          try {
            const savedQr = localStorage.getItem(`ma5sos_ticket_${code.toUpperCase()}`);
            if (savedQr) {
              const ticketRes = await fetch(
                `/api/public/invite/${encodeURIComponent(code)}/ticket/${encodeURIComponent(savedQr)}`,
                { headers: { accept: 'application/json' } },
              );
              if (ticketRes.ok) {
                const ticketData = await ticketRes.json().catch(() => null);
                if (active && ticketData?.rsvp) {
                  setGuest(ticketData.rsvp);
                  setGuestName(ticketData.rsvp.guest_name || '');
                  setGuestPhone(prettyPhone(ticketData.rsvp.phone));
                  setCompanionsCount(Number(ticketData.rsvp.companions_count) || 0);
                  setGuestNotes(ticketData.rsvp.notes || '');
                  setStatus(ticketData.rsvp.status === 'declined' ? 'declined' : 'confirmed');
                }
              }
            }
          } catch {
            /* ignore storage or network errors on ticket restore */
          }
        }
        setEventData(data);
      } catch (problem) {
        if (!active) return;
        setError(problem.message || 'لم نتمكن من تحميل الدعوة. تحقق من اتصالك وحاول ثانية.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (submitEvent) => {
    submitEvent.preventDefault();
    setFormError('');

    const name = guestName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      setFormError('يرجى كتابة اسمك الكريم (حرفان على الأقل).');
      return;
    }

    // If this is a public link (no private inviteToken), validate phone number too
    let normalizedPhone = null;
    if (!inviteToken) {
      normalizedPhone = normalizeSaudiMobile(guestPhone);
      if (!normalizedPhone) {
        setFormError('يرجى إدخال رقم جوال سعودي صحيح يبدأ بـ 05 لإصدار تذكرة الدخول الخاصة بك.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint = inviteToken
        ? `/api/public/invite/${encodeURIComponent(shareCode)}/guest/${encodeURIComponent(inviteToken)}/respond`
        : `/api/public/invite/${encodeURIComponent(shareCode)}/rsvp`;

      const payload = inviteToken
        ? { guest_name: name, status }
        : {
            guest_name: name,
            phone: normalizedPhone,
            status,
            companions_count: status === 'confirmed' ? Math.max(0, Math.min(Number(companionsCount) || 0, 10)) : 0,
            notes: guestNotes.trim() || null,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || 'حدث خطأ أثناء إرسال الرد، يرجى المحاولة ثانية.');
      }

      const nextGuest = data?.rsvp || null;
      if (nextGuest) {
        setGuest(nextGuest);
        setGuestName(nextGuest.guest_name || name);
        setStatus(nextGuest.status || status);
        if (!inviteToken && nextGuest.qr_code) {
          try {
            localStorage.setItem(`ma5sos_ticket_${shareCode.toUpperCase()}`, nextGuest.qr_code);
          } catch {
            /* ignore */
          }
        }
      }
      setPassMessage(data?.message || '');
      setEditing(false);
      setFormError('');
      window.setTimeout(() => {
        passRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (problem) {
      setFormError(problem.message || 'تعذّر إرسال الرد. تحقق من اتصالك وحاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditResponse = () => {
    if (!guest) return;
    setGuestName(guest.guest_name || '');
    setGuestPhone(prettyPhone(guest.phone));
    setCompanionsCount(Number(guest.companions_count) || 0);
    setGuestNotes(guest.notes || '');
    setStatus(guest.status === 'declined' ? 'declined' : 'confirmed');
    setPassMessage('');
    setFormError('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setFormError('');
    setPassMessage('');
    if (guest) {
      setGuestName(guest.guest_name || '');
      setGuestPhone(prettyPhone(guest.phone));
      setCompanionsCount(Number(guest.companions_count) || 0);
      setGuestNotes(guest.notes || '');
      setStatus(guest.status === 'declined' ? 'declined' : 'confirmed');
    }
  };

  const copyTicketCode = async () => {
    const code = guest?.qr_code;
    if (!code) return;
    const payload = encodeGuestQr(code);
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt('انسخ رمز التذكرة:', payload);
    }
  };

  if (loading) {
    return (
      <section className="section invite-page">
        <div className="wrap">
          <div className="invite-loading">
            <span className="tile">
              <IconCalendar size={28} />
            </span>
            <p>جارٍ تحميل بطاقة الدعوة الإلكترونية...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !eventData) {
    return (
      <section className="section invite-page">
        <div className="wrap">
          <div className="invite-error">
            <span className="tile">
              <IconClose size={28} />
            </span>
            <h2>عذرًا، لم نتمكن من فتح الدعوة</h2>
            <p>{error || 'يرجى التحقق من الرابط المرسل إليك عبر واتساب أو الاتصال بصاحب المناسبة.'}</p>
            <a href="/" className="btn btn--primary">
              العودة للرئيسية
            </a>
          </div>
        </div>
      </section>
    );
  }

  const eventDate = new Date(eventData.event_date);
  const formattedDates = formatEventDate(Number.isNaN(eventDate.getTime()) ? new Date() : eventDate);
  if (eventData.event_time) formattedDates.time = eventData.event_time;

  const activeTemplate =
    PHOTO_TEMPLATES.find((template) => template.id === eventData.template_id) || PHOTO_TEMPLATES[0];
  const customTemplate = {
    ...activeTemplate,
    invite: {
      ...activeTemplate.invite,
      kicker: OCCASION_KICKERS[eventData.occasion_type] || activeTemplate.invite?.kicker || 'دعوة خاصة',
      name: eventData.honoree_name || eventData.title,
      lead: `يتشرف ${eventData.host_name} بدعوتكم لحضور`,
      text: eventData.description || activeTemplate.invite?.text || 'نتشرف بلقائكم في هذه المناسبة المباركة',
      venue: eventData.venue_name,
      note: eventData.notes || '',
    },
  };

  const attending = Number(eventData.attending_count ?? eventData.confirmed_count ?? 0);
  const maxGuests = Number(eventData.max_guests) || 0;
  const isFull = maxGuests > 0 && attending >= maxGuests;
  const confirmed = guest?.status === 'confirmed';
  const pending = !guest || guest?.status === 'pending';
  const showForm = Boolean(pending || editing);
  const showPass = Boolean(guest && !pending && !editing);
  const qrValue = guest?.qr_payload || (guest?.qr_code ? encodeGuestQr(guest.qr_code) : '');
  const passText =
    passMessage ||
    (confirmed
      ? 'تم تأكيد حضورك بنجاح! شكرًا لك، وبحضورك تكتمل فرحتنا. تذكرة الدخول ورمز QR الخاص بك ظاهران أدناه.'
      : 'تم استلام اعتذارك، نشكرك على إبلاغنا ونتمنى لك دوام الأفراح.');

  return (
    <section className="section invite-page" aria-label="بطاقة الدعوة">
      <div className="wrap invite-container">
        <div className="invite-main-column">
          <div className="invite-photo-stage">
            <PhotoInvite template={customTemplate} date={formattedDates} large opening />
          </div>

          {countdown && (
            <div className="invite-countdown" aria-label="الوقت المتبقي للمناسبة">
              <div>
                <strong>{countdown.days}</strong>
                <span>يوم</span>
              </div>
              <div>
                <strong>{countdown.hours}</strong>
                <span>ساعة</span>
              </div>
              <div>
                <strong>{countdown.minutes}</strong>
                <span>دقيقة</span>
              </div>
            </div>
          )}

          <div className="invite-extra-actions">
            {eventData.location_url && (
              <a
                className="btn btn--secondary btn--block invite-map-btn"
                href={eventData.location_url}
                target="_blank"
                rel="noreferrer"
              >
                <IconPin size={18} />
                <span>عرض موقع الحفل على خرائط Google</span>
              </a>
            )}

            {calendarUrl && (
              <a
                className="btn btn--ghost btn--block invite-map-btn"
                href={calendarUrl}
                target="_blank"
                rel="noreferrer"
              >
                <IconCalendar size={18} />
                <span>إضافة موعد المناسبة إلى تقويم Google</span>
              </a>
            )}

            {eventData.notes && (
              <div className="invite-notes-banner">
                <IconNote size={18} />
                <p>{eventData.notes}</p>
              </div>
            )}
          </div>
        </div>

        <aside className="rsvp-card">
          {showForm ? (
            <div>
              <div className="rsvp-head">
                <span className="tile">
                  <IconSend size={22} />
                </span>
                <h2>{editing ? 'تعديل ردك' : inviteToken ? 'دعوة خاصة لك' : 'تأكيد الحضور واستلام التذكرة'}</h2>
                <p>
                  {inviteToken
                    ? `مرحبًا ${guest?.guest_name || ''}، يرجى تأكيد اسمك وحضورك لاستلام رمز الدخول الخاص بك.`
                    : `مرحبًا بك في دعوة «${eventData.title}». سجّل ردك أدناه لتستلم تذكرة الدخول الرقمية ورمز QR الخاص بك فورًا.`}
                </p>
              </div>

              {isFull && status === 'confirmed' && (
                <div className="rsvp-full-alert">
                  <IconAlert size={18} />
                  <span>
                    اكتمل العدد المتاح لهذه المناسبة ({maxGuests} مدعوين). إذا تعذّر تأكيد حضورك، تواصل مع صاحب
                    المناسبة.
                  </span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="rsvp-form" noValidate>
                <div className="rsvp-toggle" role="radiogroup" aria-label="تحديد الحضور">
                  <button
                    type="button"
                    className="rsvp-toggle__btn"
                    data-active={status === 'confirmed'}
                    onClick={() => setStatus('confirmed')}
                    aria-pressed={status === 'confirmed'}
                  >
                    <IconCheck size={18} />
                    <span>يشرفني الحضور</span>
                  </button>
                  <button
                    type="button"
                    className="rsvp-toggle__btn rsvp-toggle__btn--decline"
                    data-active={status === 'declined'}
                    onClick={() => setStatus('declined')}
                    aria-pressed={status === 'declined'}
                  >
                    <IconClose size={18} />
                    <span>أعتذر عن الحضور</span>
                  </button>
                </div>

                <div className="field">
                  <label htmlFor="guest-name">اسمك الكريم *</label>
                  <div className="field__box">
                    <input
                      id="guest-name"
                      required
                      value={guestName}
                      onChange={(changeEvent) => setGuestName(changeEvent.target.value)}
                      placeholder="الاسم الثلاثي"
                      autoComplete="name"
                      maxLength={150}
                    />
                  </div>
                </div>

                {inviteToken ? (
                  <>
                    <div className="rsvp-readonly-grid">
                      <div>
                        <span>رقم الجوال المسجل</span>
                        <strong dir="ltr">{prettyPhone(guest?.phone)}</strong>
                      </div>
                      <div>
                        <span>عدد المرافقين</span>
                        <strong>
                          {(guest?.companions_count || 0) > 0
                            ? `${guest.companions_count} مرافقين`
                            : 'بدون مرافقين'}
                        </strong>
                      </div>
                    </div>

                    {guest?.notes && (
                      <div className="rsvp-private-box">
                        <IconNote size={18} />
                        <p>ملاحظة من الداعي: {guest.notes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor="guest-phone">رقم الجوال السعودي *</label>
                      <div className="field__box" dir="ltr">
                        <input
                          id="guest-phone"
                          type="tel"
                          inputMode="numeric"
                          required
                          value={guestPhone}
                          onChange={(changeEvent) => setGuestPhone(changeEvent.target.value)}
                          placeholder="05XXXXXXXX"
                          autoComplete="tel"
                          maxLength={16}
                        />
                      </div>
                    </div>

                    {status === 'confirmed' && (
                      <div className="field">
                        <label htmlFor="guest-companions">عدد المرافقين</label>
                        <div className="field__box">
                          <select
                            id="guest-companions"
                            value={companionsCount}
                            onChange={(changeEvent) => setCompanionsCount(Number(changeEvent.target.value))}
                          >
                            {Array.from({ length: 6 }, (_, count) => (
                              <option key={count} value={count}>
                                {count === 0
                                  ? 'دعوة شخصية (بدون مرافقين)'
                                  : count === 1
                                    ? 'مرافق واحد (+1)'
                                    : `${count} مرافقين (+${count})`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="field">
                      <label htmlFor="guest-notes">كلمة تهنئة أو ملاحظة للداعي (اختياري)</label>
                      <div className="field__box">
                        <input
                          id="guest-notes"
                          value={guestNotes}
                          onChange={(changeEvent) => setGuestNotes(changeEvent.target.value)}
                          placeholder="مثال: بارك الله لكما وبارك عليكما وجمع بينكما في خير"
                          maxLength={500}
                        />
                      </div>
                    </div>
                  </>
                )}

                {formError && (
                  <p className="rsvp-form__error" role="alert">
                    {formError}
                  </p>
                )}

                <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
                  {submitting
                    ? 'جارٍ إرسال الرد...'
                    : status === 'confirmed'
                      ? 'تأكيد الحضور واستلام التذكرة'
                      : 'إرسال الاعتذار'}
                </button>

                {editing && (
                  <button type="button" className="btn btn--ghost btn--block" onClick={cancelEdit}>
                    إلغاء التعديل
                  </button>
                )}
              </form>
            </div>
          ) : showPass ? (
            <div className="pass-card" ref={passRef}>
              <div className={`pass-badge ${confirmed ? '' : 'pass-badge--declined'}`}>
                {confirmed ? <IconCheck size={20} /> : <IconClose size={20} />}
                <span>{confirmed ? 'تذكرة حضور معتمدة · مخصوص' : 'تم استلام اعتذارك'}</span>
              </div>

              <h2 className="pass-title">
                {confirmed ? `شكرًا ${guest.guest_name}!` : 'نشكرك على إبلاغنا'}
              </h2>
              <p className="pass-msg">{passText}</p>

              <dl className="pass-details">
                <div>
                  <dt>
                    <IconCalendar size={16} /> المناسبة
                  </dt>
                  <dd>{eventData.title}</dd>
                </div>
                <div>
                  <dt>
                    <IconClock size={16} /> الموعد
                  </dt>
                  <dd>
                    {formattedDates.weekday}، {formattedDates.gregorian}
                    <br />
                    {formattedDates.time}
                  </dd>
                </div>
                <div>
                  <dt>
                    <IconPin size={16} /> المكان
                  </dt>
                  <dd>{eventData.venue_name || 'يحدده الداعي'}</dd>
                </div>
                <div>
                  <dt>
                    <IconUsers size={16} /> الضيف
                  </dt>
                  <dd>
                    {guest.guest_name}
                    {confirmed && (
                      <span className="pass-detail-note">
                        {(guest.companions_count || 0) > 0
                          ? `مع ${guest.companions_count} مرافقين`
                          : 'بدون مرافقين'}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              {confirmed && (
                <div className="pass-qr-box">
                  {qrValue ? (
                    <>
                      <div className="pass-qr-wrap">
                        <QrCode
                          value={qrValue}
                          label={`رمز QR خاص بالمدعو ${guest.guest_name}`}
                          className="pass-qr-image"
                        />
                      </div>
                      <strong className="pass-guest-name">{guest.guest_name}</strong>
                      <p className="pass-companions">
                        {(guest.companions_count || 0) > 0
                          ? `مع ${guest.companions_count} مرافقين`
                          : 'دعوة شخصية (بدون مرافقين)'}
                      </p>
                      <button type="button" className="pass-code" dir="ltr" onClick={copyTicketCode}>
                        {copied ? 'تم نسخ الرمز ✓' : guest.qr_code}
                      </button>
                      <p className="pass-instruction">
                        <IconQr size={16} />
                        <span>يُرجى إبراز هذا الرمز عند بوابة الدخول لتأكيد حضورك عبر المنظمين.</span>
                      </p>
                      {guest.checked_in && (
                        <p className="pass-checked">
                          <IconCheck size={16} /> تم تسجيل دخولك عند البوابة.
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="pass-qr-missing" role="alert">
                      <IconAlert size={22} />
                      <p>لم يصل رمز التذكرة من الخادم. حدّث الصفحة أو أعد تأكيد حضورك للحصول على رمز جديد.</p>
                    </div>
                  )}
                </div>
              )}

              {!confirmed && (
                <div className="pass-declined-note">
                  <IconNote size={18} />
                  <p>وصلنا اعتذارك، وسنبلغ أصحاب المناسبة. شكرًا لحرصك على إبلاغهم.</p>
                </div>
              )}

              <div className="pass-actions">
                {confirmed && qrValue && (
                  <button type="button" className="btn btn--primary btn--block" onClick={() => window.print()}>
                    <IconPrint size={18} />
                    <span>طباعة / حفظ التذكرة</span>
                  </button>
                )}
                <button type="button" className="btn btn--ghost btn--block" onClick={handleEditResponse}>
                  تعديل ردي
                </button>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
