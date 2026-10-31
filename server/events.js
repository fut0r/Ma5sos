import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { normalizeSaudiMobile } from '../src/lib/phone.js';
import { db } from './db.js';
import { requireUser } from './security.js';

export const eventsRouter = Router();
export const statsRouter = Router();
export const publicRouter = Router();

function generateShareCode() {
  const p1 = randomBytes(2).toString('hex').toUpperCase();
  const p2 = randomBytes(2).toString('hex').toUpperCase();
  return `MK-${p1}-${p2}`;
}

function generateInviteToken() {
  return randomBytes(18).toString('base64url');
}

function normalizeRsvpRow(r) {
  const companions = Number(r.companions_count ?? r.companion_count ?? 0) || 0;
  const qr = r.qr_code || r.qr_token || '';
  return {
    ...r,
    qr_code: qr,
    qr_token: qr,
    qr_payload: qr ? `MA5SOS:TICKET:${qr}` : null,
    invite_token: r.invite_token || null,
    companions_count: companions,
    companion_count: companions,
    checked_in: Boolean(r.checked_in),
  };
}

function formatEvent(event, rawRsvps = []) {
  const rsvps = rawRsvps.map(normalizeRsvpRow);
  const confirmed = rsvps.filter((r) => r.status === 'confirmed').length;
  const declined = rsvps.filter((r) => r.status === 'declined').length;
  const totalGuests = rsvps
    .filter((r) => r.status === 'confirmed')
    .reduce((sum, r) => sum + (r.companions_count || 0) + 1, 0);
  return {
    id: event.id,
    title: event.title,
    occasion_type: event.occasion_type,
    host_name: event.host_name,
    honoree_name: event.honoree_name,
    event_date: event.event_date,
    event_time: event.event_time,
    venue_name: event.venue_name,
    venue_address: event.venue_address,
    location_url: event.location_url,
    description: event.description,
    notes: event.notes,
    template_id: event.template_id,
    share_code: event.share_code,
    is_public: Boolean(event.is_public),
    max_guests: event.max_guests,
    created_at: event.created_at,
    updated_at: event.updated_at,
    total_rsvps: rsvps.length,
    confirmed_count: confirmed,
    declined_count: declined,
    total_guests: totalGuests,
    rsvps,
  };
}

function isSuperAdmin(user) {
  return (
    user.id === 1 ||
    user.phone === '+966500000000' ||
    ['admin@ma5sos.com', 'admin@mazom.net'].includes(String(user.email || '').toLowerCase())
  );
}

function ownedEvent(eventId, user) {
  if (isSuperAdmin(user)) {
    return db
      .prepare('SELECT * FROM events WHERE id = ? AND (user_id = ? OR user_id IS NULL)')
      .get(eventId, user.id);
  }
  return db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').get(eventId, user.id);
}

/* ==================== EVENTS ROUTER ==================== */

eventsRouter.use(requireUser);

eventsRouter.get('/', (req, res) => {
  const isAdmin = isSuperAdmin(req.user);
  const events = isAdmin
    ? db.prepare('SELECT * FROM events WHERE user_id = ? OR user_id IS NULL ORDER BY event_date ASC').all(req.user.id)
    : db.prepare('SELECT * FROM events WHERE user_id = ? ORDER BY event_date ASC').all(req.user.id);

  const allRsvps = isAdmin
    ? db.prepare('SELECT * FROM rsvps').all()
    : db
        .prepare('SELECT rsvps.* FROM rsvps JOIN events ON events.id = rsvps.event_id WHERE events.user_id = ?')
        .all(req.user.id);

  const formatted = events.map((ev) => {
    const evRsvps = allRsvps.filter((r) => r.event_id === ev.id);
    return formatEvent(ev, evRsvps);
  });
  res.json(formatted);
});

eventsRouter.post('/', (req, res) => {
  const userEventCount = db.prepare('SELECT COUNT(*) AS c FROM events WHERE user_id = ?').get(req.user.id)?.c ?? 0;
  const isPaid = Boolean(req.user.has_paid) || isSuperAdmin(req.user);
  if (!isPaid && userEventCount >= 1) {
    return res.status(403).json({
      detail: 'تتيح لك التجربة المجانية إنشاء مناسبة واحدة فقط. يُرجى الترقية إلى إحدى باقات مخصوص لإضافة المزيد من المناسبات.',
    });
  }

  const b = req.body || {};
  let share_code = generateShareCode();
  while (db.prepare('SELECT 1 FROM events WHERE share_code = ?').get(share_code)) {
    share_code = generateShareCode();
  }

  const maxGuests = !isPaid ? Math.min(Number(b.max_guests) || 3, 3) : Number(b.max_guests) || 100;
  const now = new Date().toISOString();

  const result = db
    .prepare(`
      INSERT INTO events (
        user_id, title, occasion_type, host_name, honoree_name, event_date, event_time,
        venue_name, venue_address, location_url, description, notes, template_id,
        share_code, is_public, max_guests, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      req.user.id,
      b.title || 'مناسبة جديدة',
      b.occasion_type || 'wedding',
      b.host_name || '',
      b.honoree_name || '',
      b.event_date || now,
      b.event_time || '8:30 مساءً',
      b.venue_name || 'قاعة الاحتفال',
      b.venue_address || '',
      b.location_url || '',
      b.description || '',
      b.notes || '',
      b.template_id || 'andalusian',
      share_code,
      b.is_public !== false ? 1 : 0,
      maxGuests,
      now,
      now,
    );

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(formatEvent(event, []));
});

eventsRouter.get('/:id', (req, res) => {
  const event = ownedEvent(req.params.id, req.user);
  if (!event) return res.status(404).json({ detail: 'المناسبة المطلوبة غير موجودة.' });
  const rsvps = db.prepare('SELECT * FROM rsvps WHERE event_id = ? ORDER BY id DESC').all(event.id);
  res.json(formatEvent(event, rsvps));
});

eventsRouter.put('/:id', (req, res) => {
  const event = ownedEvent(req.params.id, req.user);
  if (!event) return res.status(404).json({ detail: 'المناسبة المطلوبة غير موجودة.' });

  const b = req.body || {};
  db.prepare(`
    UPDATE events SET
      title = ?, occasion_type = ?, host_name = ?, honoree_name = ?, event_date = ?,
      event_time = ?, venue_name = ?, venue_address = ?, location_url = ?,
      description = ?, notes = ?, template_id = ?, is_public = ?, max_guests = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    b.title ?? event.title,
    b.occasion_type ?? event.occasion_type,
    b.host_name ?? event.host_name,
    b.honoree_name ?? event.honoree_name,
    b.event_date ?? event.event_date,
    b.event_time ?? event.event_time,
    b.venue_name ?? event.venue_name,
    b.venue_address ?? event.venue_address,
    b.location_url ?? event.location_url,
    b.description ?? event.description,
    b.notes ?? event.notes,
    b.template_id ?? event.template_id,
    b.is_public !== undefined ? (b.is_public ? 1 : 0) : event.is_public,
    b.max_guests ?? event.max_guests,
    event.id,
  );

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(event.id);
  const rsvps = db.prepare('SELECT * FROM rsvps WHERE event_id = ?').all(event.id);
  res.json(formatEvent(updated, rsvps));
});

eventsRouter.delete('/:id', (req, res) => {
  const event = ownedEvent(req.params.id, req.user);
  if (!event) return res.status(404).json({ detail: 'المناسبة المطلوبة غير موجودة.' });

  db.prepare('DELETE FROM events WHERE id = ?').run(event.id);
  res.json({ ok: true, message: 'تم حذف المناسبة بنجاح.' });
});

eventsRouter.post('/:id/guests', (req, res) => {
  const event = ownedEvent(req.params.id, req.user);
  if (!event) return res.status(404).json({ detail: 'المناسبة غير موجودة.' });

  const b = req.body || {};
  const guestName = String(b.guest_name || '').trim();
  const phone = normalizeSaudiMobile(b.phone);
  if (guestName.length < 2) return res.status(400).json({ detail: 'يرجى كتابة اسم المدعو (حرفان على الأقل).' });
  if (!phone) return res.status(400).json({ detail: 'يرجى إدخال رقم جوال سعودي صحيح يبدأ بـ 05.' });

  const existing = db.prepare('SELECT * FROM rsvps WHERE event_id = ? AND phone = ?').get(event.id, phone);
  if (existing) {
    return res.status(409).json({ detail: `هذا الرقم مسجل بالفعل للمدعو ${existing.guest_name}.` });
  }

  const companions = Math.max(0, Math.min(Number(b.companions_count) || 0, 10));
  const qrToken = `QR-${event.share_code}-${randomBytes(6).toString('hex').toUpperCase()}`;
  const inviteToken = generateInviteToken();
  const now = new Date().toISOString();

  const result = db
    .prepare(`
      INSERT INTO rsvps (event_id, guest_name, phone, status, companion_count, notes, qr_token, invite_token, checked_in, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, 0, ?, ?)
    `)
    .run(event.id, guestName, phone, companions, b.notes || null, qrToken, inviteToken, now, now);

  const row = db.prepare('SELECT * FROM rsvps WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(normalizeRsvpRow(row));
});

eventsRouter.put('/:id/guests/:guestId', (req, res) => {
  const event = ownedEvent(req.params.id, req.user);
  if (!event) return res.status(404).json({ detail: 'المناسبة غير موجودة.' });

  const guest = db.prepare('SELECT * FROM rsvps WHERE id = ? AND event_id = ?').get(req.params.guestId, event.id);
  if (!guest) return res.status(404).json({ detail: 'المدعو غير موجود في هذه المناسبة.' });

  const b = req.body || {};
  const name = b.guest_name !== undefined ? String(b.guest_name).trim() : guest.guest_name;
  const phone = b.phone !== undefined ? normalizeSaudiMobile(b.phone) : guest.phone;
  if (name.length < 2) return res.status(400).json({ detail: 'يرجى كتابة اسم المدعو (حرفان على الأقل).' });
  if (!phone) return res.status(400).json({ detail: 'يرجى إدخال رقم جوال سعودي صحيح يبدأ بـ 05.' });

  const companions =
    b.companions_count !== undefined
      ? Math.max(0, Math.min(Number(b.companions_count) || 0, 10))
      : guest.companion_count;
  const notes = b.notes !== undefined ? String(b.notes || '').trim() || null : guest.notes;
  const inviteToken = guest.invite_token || generateInviteToken();

  db.prepare(`
    UPDATE rsvps
    SET guest_name = ?, phone = ?, companion_count = ?, notes = ?, invite_token = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(name, phone, companions, notes, inviteToken, guest.id);

  const updated = db.prepare('SELECT * FROM rsvps WHERE id = ?').get(guest.id);
  res.json(normalizeRsvpRow(updated));
});

eventsRouter.post('/:id/rsvps/:rsvpId/checkin', (req, res) => {
  const event = ownedEvent(req.params.id, req.user);
  if (!event) return res.status(404).json({ detail: 'المناسبة المطلوبة غير موجودة.' });

  const rsvp = db.prepare('SELECT * FROM rsvps WHERE id = ? AND event_id = ?').get(req.params.rsvpId, event.id);
  if (!rsvp) return res.status(404).json({ detail: 'سجل الضيف غير موجود.' });

  const nextChecked = rsvp.checked_in ? 0 : 1;
  const nowIso = nextChecked ? new Date().toISOString() : null;
  db.prepare('UPDATE rsvps SET checked_in = ?, checked_in_at = ? WHERE id = ?').run(nextChecked, nowIso, rsvp.id);
  res.json({
    ok: true,
    checked_in: Boolean(nextChecked),
    checked_in_at: nowIso,
    guest_name: rsvp.guest_name,
  });
});

eventsRouter.delete('/:id/rsvps/:rsvpId', (req, res) => {
  const event = ownedEvent(req.params.id, req.user);
  if (!event) return res.status(404).json({ detail: 'المناسبة المطلوبة غير موجودة.' });

  const rsvp = db.prepare('SELECT * FROM rsvps WHERE id = ? AND event_id = ?').get(req.params.rsvpId, event.id);
  if (!rsvp) return res.status(404).json({ detail: 'سجل الضيف غير موجود.' });

  db.prepare('DELETE FROM rsvps WHERE id = ?').run(rsvp.id);
  res.json({ ok: true, message: 'تم حذف الرد بنجاح.' });
});

eventsRouter.post('/:id/checkin', (req, res) => {
  const currentEvent = ownedEvent(req.params.id, req.user);
  if (!currentEvent) {
    return res.status(404).json({ detail: 'المناسبة المطلوبة غير موجودة.' });
  }
  const rawInput = (req.body?.qr_token || req.body?.qr_code || '').trim();
  const guestId = req.body?.guest_id || req.body?.rsvp_id;

  const tokenMatch = rawInput.match(/(QR-[A-Za-z0-9_-]+)/i);
  const qrToken = tokenMatch ? tokenMatch[1].toUpperCase() : rawInput;

  let rsvp = null;
  if (qrToken) {
    rsvp = db.prepare('SELECT * FROM rsvps WHERE UPPER(qr_token) = ?').get(qrToken.toUpperCase());
    if (!rsvp) {
      if (!qrToken.toUpperCase().startsWith('QR-') && !/(ma5sos|mazom)/i.test(rawInput)) {
        return res.status(400).json({
          detail: 'عذرًا، هذا الرمز ليس رمز QR صادرًا من منصة مخصوص (تم رفض الرمز).',
          is_ma5sos: false,
        });
      }
      return res.status(404).json({
        detail: 'رمز مخصوص غير مسجل أو لم يتم العثور على اسم الضيف في قائمة هذه المناسبة.',
        is_ma5sos: true,
      });
    }
  } else if (guestId) {
    rsvp = db.prepare('SELECT * FROM rsvps WHERE id = ?').get(guestId);
  }

  if (!rsvp) {
    return res.status(404).json({ detail: 'رمز الدخول غير صحيح أو لم يتم العثور على اسم الضيف.' });
  }

  if (rsvp.event_id !== currentEvent.id) {
    const otherEvent = db.prepare('SELECT title FROM events WHERE id = ?').get(rsvp.event_id);
    return res.status(400).json({
      detail: `هذا الرمز صادر من مخصوص ولكنه مسجل لمناسبة أخرى (${otherEvent?.title || 'أخرى'}) وليس لهذه المناسبة!`,
      is_ma5sos: true,
    });
  }

  if (rsvp.checked_in) {
    return res.json({
      ok: true,
      already_checked_in: true,
      guest_id: rsvp.id,
      guest_name: rsvp.guest_name,
      phone: rsvp.phone,
      companion_count: rsvp.companion_count || 0,
      companions_count: rsvp.companion_count || 0,
      status: rsvp.status,
      checked_in: true,
      checked_in_at: rsvp.checked_in_at,
      event_title: currentEvent.title,
      notes: rsvp.notes,
      message: `تنبيه: تم تسجيل دخول الضيف (${rsvp.guest_name}) مسبقًا!`,
    });
  }

  const nowIso = new Date().toISOString();
  db.prepare(`UPDATE rsvps SET checked_in = 1, checked_in_at = ? WHERE id = ?`).run(nowIso, rsvp.id);
  const updated = db.prepare('SELECT * FROM rsvps WHERE id = ?').get(rsvp.id);

  res.json({
    ok: true,
    already_checked_in: false,
    guest_id: updated.id,
    guest_name: updated.guest_name,
    phone: updated.phone,
    companion_count: updated.companion_count || 0,
    companions_count: updated.companion_count || 0,
    status: updated.status,
    checked_in: true,
    checked_in_at: updated.checked_in_at,
    event_title: currentEvent.title,
    notes: updated.notes,
    message: `تم تسجيل وتأكيد حضور ${updated.guest_name} بنجاح!`,
  });
});

/* ==================== STATS ROUTER ==================== */

statsRouter.get('/', requireUser, (req, res) => {
  const now = new Date().toISOString();
  const isAdmin = isSuperAdmin(req.user);
  const totalEvents = isAdmin
    ? db.prepare('SELECT COUNT(*) AS c FROM events WHERE user_id = ? OR user_id IS NULL').get(req.user.id)?.c ?? 0
    : db.prepare('SELECT COUNT(*) AS c FROM events WHERE user_id = ?').get(req.user.id)?.c ?? 0;
  const totalGuests = isAdmin
    ? db.prepare('SELECT COUNT(*) AS c FROM rsvps JOIN events ON events.id = rsvps.event_id WHERE events.user_id = ? OR events.user_id IS NULL').get(req.user.id)?.c ?? 0
    : db.prepare('SELECT COUNT(*) AS c FROM rsvps JOIN events ON events.id = rsvps.event_id WHERE events.user_id = ?').get(req.user.id)?.c ?? 0;
  const confirmedGuests = isAdmin
    ? db.prepare("SELECT COUNT(*) AS c FROM rsvps JOIN events ON events.id = rsvps.event_id WHERE (events.user_id = ? OR events.user_id IS NULL) AND rsvps.status = 'confirmed'").get(req.user.id)?.c ?? 0
    : db.prepare("SELECT COUNT(*) AS c FROM rsvps JOIN events ON events.id = rsvps.event_id WHERE events.user_id = ? AND rsvps.status = 'confirmed'").get(req.user.id)?.c ?? 0;
  const declinedGuests = isAdmin
    ? db.prepare("SELECT COUNT(*) AS c FROM rsvps JOIN events ON events.id = rsvps.event_id WHERE (events.user_id = ? OR events.user_id IS NULL) AND rsvps.status = 'declined'").get(req.user.id)?.c ?? 0
    : db.prepare("SELECT COUNT(*) AS c FROM rsvps JOIN events ON events.id = rsvps.event_id WHERE events.user_id = ? AND rsvps.status = 'declined'").get(req.user.id)?.c ?? 0;
  const upcomingEvents = isAdmin
    ? db.prepare('SELECT COUNT(*) AS c FROM events WHERE (user_id = ? OR user_id IS NULL) AND event_date >= ?').get(req.user.id, now)?.c ?? 0
    : db.prepare('SELECT COUNT(*) AS c FROM events WHERE user_id = ? AND event_date >= ?').get(req.user.id, now)?.c ?? 0;

  res.json({
    total_events: totalEvents,
    total_guests: totalGuests,
    confirmed_guests: confirmedGuests,
    declined_guests: declinedGuests,
    upcoming_events: upcomingEvents,
  });
});

/* ==================== PUBLIC ROUTER ==================== */

publicRouter.get('/invite/:code', (req, res) => {
  const code = (req.params.code || '').trim();
  const event = db.prepare('SELECT * FROM events WHERE UPPER(share_code) = ?').get(code.toUpperCase());
  if (!event) {
    return res.status(404).json({ detail: 'عذرًا، لم يتم العثور على هذه الدعوة. يرجى التأكد من صحة الرابط.' });
  }

  const confirmedRows = db
    .prepare("SELECT companion_count FROM rsvps WHERE event_id = ? AND status = 'confirmed'")
    .all(event.id);
  const confirmedCount = confirmedRows.length;
  const attendingCount = confirmedRows.reduce((sum, r) => sum + (Number(r.companion_count) || 0) + 1, 0);

  res.json({
    title: event.title,
    occasion_type: event.occasion_type,
    host_name: event.host_name,
    honoree_name: event.honoree_name,
    event_date: event.event_date,
    event_time: event.event_time,
    venue_name: event.venue_name,
    venue_address: event.venue_address,
    location_url: event.location_url,
    description: event.description,
    notes: event.notes,
    template_id: event.template_id,
    share_code: event.share_code,
    max_guests: event.max_guests,
    confirmed_count: confirmedCount,
    attending_count: attendingCount,
  });
});

publicRouter.get('/invite/:code/guest/:token', (req, res) => {
  const code = (req.params.code || '').trim();
  const token = (req.params.token || '').trim();
  const event = db.prepare('SELECT * FROM events WHERE UPPER(share_code) = ?').get(code.toUpperCase());
  if (!event) {
    return res.status(404).json({ detail: 'لم نجد هذه الدعوة. تأكد من الرابط الذي أرسله لك الداعي.' });
  }
  const guest = db.prepare('SELECT * FROM rsvps WHERE event_id = ? AND invite_token = ?').get(event.id, token);
  if (!guest) {
    return res.status(404).json({ detail: 'رابط الدعوة غير صالح أو تم إلغاؤه.' });
  }
  const normalizedGuest = normalizeRsvpRow(guest);
  if (normalizedGuest.status !== 'confirmed') {
    normalizedGuest.qr_code = null;
    normalizedGuest.qr_payload = null;
  }
  const confirmedRows = db
    .prepare("SELECT companion_count FROM rsvps WHERE event_id = ? AND status = 'confirmed'")
    .all(event.id);

  res.json({
    title: event.title,
    occasion_type: event.occasion_type,
    host_name: event.host_name,
    honoree_name: event.honoree_name,
    event_date: event.event_date,
    event_time: event.event_time,
    venue_name: event.venue_name,
    venue_address: event.venue_address,
    location_url: event.location_url,
    description: event.description,
    notes: event.notes,
    template_id: event.template_id,
    share_code: event.share_code,
    max_guests: event.max_guests,
    confirmed_count: confirmedRows.length,
    attending_count: confirmedRows.reduce((s, r) => s + (Number(r.companion_count) || 0) + 1, 0),
    guest: normalizedGuest,
  });
});

publicRouter.post('/invite/:code/guest/:token/respond', (req, res) => {
  const code = (req.params.code || '').trim();
  const token = (req.params.token || '').trim();
  const event = db.prepare('SELECT * FROM events WHERE UPPER(share_code) = ?').get(code.toUpperCase());
  if (!event) return res.status(404).json({ detail: 'لم نجد هذه الدعوة.' });

  const guest = db.prepare('SELECT * FROM rsvps WHERE event_id = ? AND invite_token = ?').get(event.id, token);
  if (!guest) return res.status(404).json({ detail: 'رابط الدعوة غير صالح.' });

  const name = String(req.body?.guest_name || '').trim();
  const status = req.body?.status === 'declined' ? 'declined' : 'confirmed';
  if (name.length < 2) return res.status(400).json({ detail: 'يرجى كتابة اسمك الكريم (حرفان على الأقل).' });

  const qrToken = guest.qr_token || `QR-${event.share_code}-${randomBytes(6).toString('hex').toUpperCase()}`;
  db.prepare(`
    UPDATE rsvps SET guest_name = ?, status = ?, qr_token = ?, updated_at = datetime('now') WHERE id = ?
  `).run(name, status, qrToken, guest.id);

  const updated = db.prepare('SELECT * FROM rsvps WHERE id = ?').get(guest.id);
  const message =
    status === 'confirmed'
      ? `تم تأكيد حضورك بنجاح يا ${name}! تذكرتك ورمز QR الخاص بك ظاهران أدناه.`
      : `تم استلام اعتذارك يا ${name}، نشكرك على إبلاغنا ونتمنى لك دوام الأفراح.`;

  res.json({
    ok: true,
    success: true,
    message,
    rsvp: normalizeRsvpRow(updated),
    event_title: event.title,
    event_date: event.event_date,
    event_time: event.event_time,
    venue_name: event.venue_name,
    host_name: event.host_name,
  });
});

publicRouter.post('/invite/:code/rsvp', (req, res) => {
  const code = (req.params.code || '').trim();
  const event = db.prepare('SELECT * FROM events WHERE UPPER(share_code) = ?').get(code.toUpperCase());
  if (!event) {
    return res.status(404).json({ detail: 'عذرًا، لم يتم العثور على هذه الدعوة.' });
  }

  const b = req.body || {};
  const guestName = String(b.guest_name || '').trim();
  if (!guestName) return res.status(400).json({ detail: 'يرجى إدخال اسم الضيف.' });

  const status = b.status || 'confirmed';
  const cleanPhone = normalizeSaudiMobile(b.phone) || String(b.phone || '').replace(/[\s-]/g, '').trim();
  const companionsCount = Number(b.companions_count ?? b.companion_count ?? 0) || 0;

  if (status === 'confirmed') {
    const confirmedCount =
      db.prepare("SELECT COUNT(*) AS c FROM rsvps WHERE event_id = ? AND status = 'confirmed'").get(event.id)?.c ?? 0;
    if (confirmedCount >= event.max_guests) {
      return res.status(400).json({
        detail: `عذرًا، اكتمل الحد الأقصى للمدعوين لهذه المناسبة (${event.max_guests} مدعوين).`,
      });
    }
  }

  let existing = null;
  if (cleanPhone) {
    existing = db.prepare('SELECT * FROM rsvps WHERE event_id = ? AND phone = ?').get(event.id, cleanPhone);
  }

  let rsvp;
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE rsvps
      SET guest_name = ?, status = ?, companion_count = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(guestName, status, companionsCount, b.notes || '', now, existing.id);
    rsvp = db.prepare('SELECT * FROM rsvps WHERE id = ?').get(existing.id);
  } else {
    const qrToken = `QR-${event.share_code}-${randomBytes(6).toString('hex').toUpperCase()}`;
    const inviteToken = generateInviteToken();
    const result = db
      .prepare(`
        INSERT INTO rsvps (event_id, guest_name, phone, status, companion_count, notes, qr_token, invite_token, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        event.id,
        guestName,
        cleanPhone,
        status,
        companionsCount,
        b.notes || '',
        qrToken,
        inviteToken,
        now,
        now,
      );
    rsvp = db.prepare('SELECT * FROM rsvps WHERE id = ?').get(result.lastInsertRowid);
  }

  const normalizedRsvp = normalizeRsvpRow(rsvp);

  const message =
    rsvp.status === 'confirmed'
      ? 'تم تأكيد حضورك بنجاح! نتشرف بلقائك وبحضورك تكتمل فرحتنا ومسرتنا.'
      : 'نشكرك على إبلاغنا، ونأمل رؤيتك في مناسبات قادمة بإذن الله.';

  res.json({
    ok: true,
    success: true,
    message,
    event_title: event.title,
    event_date: event.event_date,
    event_time: event.event_time,
    venue_name: event.venue_name,
    host_name: event.host_name,
    rsvp: normalizedRsvp,
  });
});

publicRouter.get('/invite/:code/ticket/:qr', (req, res) => {
  const code = (req.params.code || '').trim();
  const qr = (req.params.qr || '').trim();
  const event = db.prepare('SELECT * FROM events WHERE UPPER(share_code) = ?').get(code.toUpperCase());
  if (!event) return res.status(404).json({ detail: 'لم يتم العثور على هذه الدعوة.' });
  const rsvp = db
    .prepare('SELECT * FROM rsvps WHERE event_id = ? AND UPPER(qr_token) = ?')
    .get(event.id, qr.toUpperCase());
  if (!rsvp) return res.status(404).json({ detail: 'لم يتم العثور على تذكرة هذا الضيف.' });
  res.json({ ok: true, rsvp: normalizeRsvpRow(rsvp), event_title: event.title });
});

publicRouter.get('/ticket/:qr', (req, res) => {
  const qr = (req.params.qr || '').trim();
  const rsvp = db.prepare('SELECT * FROM rsvps WHERE UPPER(qr_token) = ?').get(qr.toUpperCase());
  if (!rsvp) return res.status(404).json({ detail: 'رمز الدخول أو بطاقة الدعوة غير صالحة.' });
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(rsvp.event_id);
  res.json({
    valid: true,
    ...normalizeRsvpRow(rsvp),
    event_title: event?.title,
    event_date: event?.event_date,
    event_time: event?.event_time,
    venue_name: event?.venue_name,
    host_name: event?.host_name,
    share_code: event?.share_code,
  });
});
