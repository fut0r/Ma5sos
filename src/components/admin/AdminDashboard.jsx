import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  IconAlert,
  IconCalendar,
  IconCamera,
  IconChat,
  IconCheck,
  IconClock,
  IconClose,
  IconKeyboard,
  IconLogout,
  IconNote,
  IconPencil,
  IconPin,
  IconPlus,
  IconPrint,
  IconQr,
  IconSend,
  IconShield,
  IconStar,
  IconUsers,
} from '../ui/Icons.jsx';
import QrCode from '../ui/QrCode.jsx';
import { PHOTO_TEMPLATES } from '../../data/photoTemplates.js';
import { PLANS, TRIAL } from '../../data/plans.js';
import { api, clearStoredToken } from '../../lib/api.js';
import { normalizeSaudiMobile } from '../../lib/phone.js';
import { encodeGuestQr, readGuestQr } from '../../lib/qrPayload.js';
import { signOut, useSession } from '../../lib/session.js';
import './AdminDashboard.css';

const OCCASION_TYPES = [
  { id: 'all', label: 'الكل' },
  { id: 'wedding', label: 'زواج' },
  { id: 'milka', label: 'ملكة وخطوبة' },
  { id: 'graduation', label: 'تخرّج' },
  { id: 'baby', label: 'مولود وعقيقة' },
  { id: 'party', label: 'حفلة خاصة' },
  { id: 'general', label: 'مناسبة عامة' },
];

const occasionLabel = (type) => OCCASION_TYPES.find((item) => item.id === type)?.label ?? type;

const GUEST_STATUS = {
  confirmed: { label: 'مؤكد الحضور', className: 'pill--success' },
  declined: { label: 'معتذر', className: 'pill--muted' },
  pending: { label: 'بانتظار الرد', className: 'pill--warning' },
};

const guestStatus = (status) => GUEST_STATUS[status] || GUEST_STATUS.pending;

const SUGGESTED_WORDINGS = {
  wedding: (host, honoree) =>
    `يتشرّف ${host || 'الداعي'} بدعوتكم لحضور حفل زواج ${honoree ? `ابنه ${honoree}` : 'الأبناء'}، وبحضوركم تكتمل بهجتنا وفرحتنا.`,
  milka: (host, honoree) =>
    `بقلوب يغمرها الفرح، يتشرّف ${host || 'الداعي'} بدعوتكم لحضور عقد قران ${honoree || ''}، سائلين الله لهما التوفيق والسعادة.`,
  graduation: (host, honoree) =>
    `بكل فخر واعتزاز، يسعد ${host || 'الداعي'} دعوتكم لمشاركتنا فرحة تخرّج ${honoree || 'الخريج'}، فبحضوركم تزداد فرحتنا.`,
  baby: (host, honoree) =>
    `بقدومه أشرقت فرحتنا، يتشرّف ${host || 'الداعي'} بدعوتكم لحضور حفل استقبال وعقيقة المولود ${honoree || ''}، جعله الله من مواليد السعادة.`,
  party: (host, honoree) =>
    `جهّزنا لكم أمسية تليق بكم، يسعد ${host || 'الداعي'} دعوتكم لحضور ${honoree || 'حفلنا الخاص'}، فوجودكم معنا يكمل الفرحة.`,
  general: (host, honoree) =>
    `يتشرّف ${host || 'الداعي'} بدعوتكم لحضور ${honoree || 'مناسبتنا السعيدة'}، وتشريفكم محل تقديرنا واعتزازنا.`,
};

const TOKEN_FALLBACK_LIMIT = 5000;
const PLUS_PLAN = PLANS.find((plan) => plan.id === 'plus') || PLANS[0];

const text = (value) => String(value ?? '').trim();
const lower = (value) => text(value).toLowerCase();

function localDateTimeValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatEventDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'التاريخ غير محدد';
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function prettyPhone(value) {
  const digits = text(value).replace(/[^\d+]/g, '');
  if (digits.startsWith('+9665') && digits.length === 13) return `0${digits.slice(4)}`;
  if (digits.startsWith('9665') && digits.length === 12) return `0${digits.slice(3)}`;
  return text(value);
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initialTemplateSelection() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('template');
    const fromStorage = localStorage.getItem('ma5sos_selected_template');
    const candidate = fromQuery || fromStorage || 'andalusian';
    if (PHOTO_TEMPLATES.some((t) => t.id === candidate)) return candidate;
  } catch {
    /* ignore */
  }
  return 'andalusian';
}

const emptyEventForm = (limit, templateId = 'andalusian') => ({
  title: '',
  occasion_type: 'wedding',
  host_name: '',
  honoree_name: '',
  event_date: '',
  event_time: '8:30 مساءً',
  venue_name: '',
  venue_address: '',
  location_url: '',
  description: '',
  notes: 'نرجو إبراز رمز QR عند الحضور',
  template_id: templateId,
  max_guests: limit,
});

const emptyGuestForm = () => ({
  guest_name: '',
  phone: '',
  companions_count: 0,
  notes: '',
});

export default function AdminDashboard() {
  const session = useSession();
  const signedIn = session.status === 'user';

  const [admin, setAdmin] = useState(null);
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const authExpired = useRef(false);

  // Filters & search
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Modals
  const [eventModal, setEventModal] = useState({ open: false, mode: 'create', event: null });
  const [modalTab, setModalTab] = useState('info');
  const [templateFilter, setTemplateFilter] = useState('all');
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [guestModal, setGuestModal] = useState({ open: false, event: null, rsvps: [] });
  const [guestSearch, setGuestSearch] = useState('');
  const [guestStatusFilter, setGuestStatusFilter] = useState('all');
  const [guestError, setGuestError] = useState('');
  const [guestFormOpen, setGuestFormOpen] = useState(false);
  const [guestForm, setGuestForm] = useState(emptyGuestForm);
  const [editingGuestId, setEditingGuestId] = useState(null);
  const [guestFormBusy, setGuestFormBusy] = useState(false);
  const [guestFormError, setGuestFormError] = useState('');
  const [qrModal, setQrModal] = useState({ open: false, event: null, rsvp: null });
  const qrPrintRef = useRef(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, event: null });
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // QR scanner
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanEventId, setScanEventId] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [scanMode, setScanMode] = useState('camera');
  const [cameraState, setCameraState] = useState('idle');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const scanEventRef = useRef(null);
  const processingRef = useRef(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState(() => emptyEventForm(100, initialTemplateSelection()));

  const currentUser = admin || session.user || null;
  const isSuperAdmin = Boolean(currentUser?.is_admin);
  const paid = Boolean(currentUser?.has_paid) || isSuperAdmin;
  const isTrial = Boolean(currentUser && !paid);
  const paidPlan =
    PLANS.find((plan) => plan.id === currentUser?.plan_id || plan.legacyId === currentUser?.plan_id) || PLUS_PLAN;
  const planMeta = isSuperAdmin
    ? { id: 'admin', name: 'حساب الإدارة', maxGuests: TOKEN_FALLBACK_LIMIT }
    : paid
      ? paidPlan
      : TRIAL;
  const planLimit = Number(planMeta.maxGuests) || 3;
  const canCreateEvent = !isTrial || events.length < 1;

  useEffect(() => {
    scanEventRef.current = scanEventId;
  }, [scanEventId]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      stopCamera();
    },
    [],
  );

  const showToast = (message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4200);
  };

  const redirectToLogin = () => {
    if (authExpired.current) return;
    authExpired.current = true;
    clearStoredToken();
    const here = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login/?next=${encodeURIComponent(here || '/admin/')}`);
  };

  const apiCall = async (path, options = {}) => {
    try {
      return await api(path, options);
    } catch (problem) {
      if (problem.status === 401) {
        redirectToLogin();
      }
      throw problem;
    }
  };

  const loadDashboardData = async () => {
    if (!signedIn) return;
    setLoading(true);
    setError('');
    try {
      const me = await apiCall('/auth/me');
      const user = me?.user ?? me;
      setAdmin(user);

      const [statsResult, eventsResult] = await Promise.allSettled([
        apiCall('/stats'),
        apiCall('/events'),
      ]);

      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (eventsResult.status === 'fulfilled') setEvents(Array.isArray(eventsResult.value) ? eventsResult.value : []);

      if (statsResult.status === 'rejected' && eventsResult.status === 'rejected') {
        setError(statsResult.reason?.message || 'تعذّر تحميل بيانات لوحة التحكم.');
      }
    } catch (problem) {
      if (problem.status !== 401) {
        setError(problem.message || 'تعذّر تحميل بيانات لوحة التحكم. يرجى المحاولة ثانية.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (signedIn) loadDashboardData();
  }, [signedIn]);

  const logout = () => signOut('/');

  const openCreateModal = () => {
    if (!canCreateEvent) {
      setUpgradeOpen(true);
      return;
    }
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14);
    defaultDate.setHours(20, 30, 0, 0);
    const chosenTemplate = initialTemplateSelection();
    setFormData({
      ...emptyEventForm(planLimit, chosenTemplate),
      event_date: localDateTimeValue(defaultDate.toISOString()),
    });
    setModalTab('info');
    setModalError('');
    setEventModal({ open: true, mode: 'create', event: null });
  };

  const openEditModal = (event) => {
    setFormData({
      title: event.title || '',
      occasion_type: event.occasion_type || 'wedding',
      host_name: event.host_name || '',
      honoree_name: event.honoree_name || '',
      event_date: localDateTimeValue(event.event_date),
      event_time: event.event_time || '',
      venue_name: event.venue_name || '',
      venue_address: event.venue_address || '',
      location_url: event.location_url || '',
      description: event.description || '',
      notes: event.notes || '',
      template_id: event.template_id || 'andalusian',
      max_guests: Math.min(Number(event.max_guests) || planLimit, planLimit),
    });
    setModalTab('info');
    setModalError('');
    setEventModal({ open: true, mode: 'edit', event });
  };

  const closeEventModal = () => setEventModal({ open: false, mode: 'create', event: null });

  const insertSuggestedWording = () => {
    const builder = SUGGESTED_WORDINGS[formData.occasion_type] || SUGGESTED_WORDINGS.general;
    const generated = builder(text(formData.host_name), text(formData.honoree_name));
    setFormData((current) => ({ ...current, description: generated }));
  };

  const handleSaveEvent = async (submitEvent) => {
    submitEvent.preventDefault();
    setModalError('');

    if (text(formData.title).length < 2) {
      setModalTab('info');
      setModalError('يرجى كتابة عنوان المناسبة (حرفان على الأقل).');
      return;
    }
    if (text(formData.host_name).length < 2) {
      setModalTab('info');
      setModalError('يرجى كتابة اسم الداعي / المضيف.');
      return;
    }
    if (!formData.event_date) {
      setModalTab('datetime');
      setModalError('يرجى تحديد تاريخ ووقت المناسبة.');
      return;
    }
    if (text(formData.venue_name).length < 2) {
      setModalTab('datetime');
      setModalError('يرجى كتابة اسم القاعة أو المكان.');
      return;
    }

    const chosenDate = new Date(formData.event_date);
    if (Number.isNaN(chosenDate.getTime())) {
      setModalTab('datetime');
      setModalError('صيغة تاريخ المناسبة غير صحيحة.');
      return;
    }

    setModalBusy(true);
    try {
      const payload = {
        ...formData,
        title: text(formData.title),
        host_name: text(formData.host_name),
        honoree_name: text(formData.honoree_name) || null,
        venue_name: text(formData.venue_name),
        venue_address: text(formData.venue_address) || null,
        location_url: text(formData.location_url) || null,
        description: text(formData.description) || null,
        notes: text(formData.notes) || null,
        event_date: chosenDate.toISOString(),
        max_guests: Math.max(1, Math.min(Number(formData.max_guests) || planLimit, planLimit)),
      };

      if (eventModal.mode === 'create') {
        await apiCall('/events', { method: 'POST', body: payload });
        showToast('تمت إضافة المناسبة وتوليد رابط الدعوة بنجاح.');
      } else {
        await apiCall(`/events/${eventModal.event.id}`, { method: 'PUT', body: payload });
        showToast('تم تحديث بيانات المناسبة بنجاح.');
      }
      closeEventModal();
      await loadDashboardData();
    } catch (problem) {
      if (problem.status === 403 && isTrial) {
        setModalError(problem.message);
        setUpgradeOpen(true);
      } else {
        setModalError(problem.message || 'تعذّر حفظ المناسبة. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setModalBusy(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteModal.event) return;
    setModalBusy(true);
    try {
      await apiCall(`/events/${deleteModal.event.id}`, { method: 'DELETE' });
      showToast('تم حذف المناسبة بنجاح.');
      setDeleteModal({ open: false, event: null });
      await loadDashboardData();
    } catch (problem) {
      showToast(problem.message || 'تعذّر حذف المناسبة.');
    } finally {
      setModalBusy(false);
    }
  };

  const copyInviteLink = async (shareCode) => {
    const url = `${window.location.origin}/invite/?code=${encodeURIComponent(shareCode)}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      showToast('تم نسخ رابط الدعوة العام بنجاح.');
    } catch {
      window.prompt('انسخ رابط الدعوة التالي:', url);
    }
  };

  const guestInviteUrl = (event, guest) =>
    `${window.location.origin}/invite/?code=${encodeURIComponent(event.share_code)}&guest=${encodeURIComponent(guest.invite_token)}`;

  const copyGuestLink = async (event, guest) => {
    if (!guest?.invite_token) {
      showToast('لا يوجد رابط خاص لهذا المدعو. حدّث الصفحة ثم حاول مرة أخرى.');
      return;
    }
    const url = guestInviteUrl(event, guest);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      showToast(`تم نسخ رابط الدعوة الخاص بـ ${guest.guest_name || 'المدعو'}.`);
    } catch {
      window.prompt('انسخ رابط الدعوة الخاص بالمدعو:', url);
    }
  };

  const whatsappGuestLink = (event, guest) => {
    if (!guest?.invite_token) return '#';
    const url = guestInviteUrl(event, guest);
    const normalized = normalizeSaudiMobile(guest.phone);
    const digits = normalized
      ? normalized.replace(/\D/g, '')
      : text(guest.phone).replace(/\D/g, '').replace(/^0/, '966');
    const guestGreeting = guest.guest_name ? `مرحبًا ${guest.guest_name}،` : 'مرحبًا بك،';
    const message = [
      guestGreeting,
      `يتشرّف ${event.host_name || 'صاحب المناسبة'} بدعوتكم لحضور ${event.title}`,
      event.venue_name ? `المكان: ${event.venue_name}` : '',
      '',
      'رابط دعوتك الخاصة لتأكيد الحضور واستلام تذكرة الدخول (QR):',
      url,
      '',
      'مخصوص · لأنك المقصود',
    ]
      .filter((line, idx, arr) => line !== '' || arr[idx - 1] !== '')
      .join('\n');
    const query = encodeURIComponent(message);
    return digits ? `https://wa.me/${digits}?text=${query}` : `https://wa.me/?text=${query}`;
  };

  const exportGuestsCsv = () => {
    const ev = guestModal.event;
    const rows = guestModal.rsvps || [];
    if (!ev || !rows.length) {
      showToast('لا توجد بيانات مدعوين لتصديرها.');
      return;
    }
    const headers = [
      'اسم المدعو',
      'رقم الجوال',
      'الحالة',
      'عدد المرافقين',
      'إجمالي المقاعد',
      'حالة الدخول',
      'وقت الدخول',
      'رمز التذكرة',
      'الملاحظات',
      'رابط الدعوة الخاص',
    ];
    const escapeCsv = (val) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };
    const csvLines = [
      headers.map(escapeCsv).join(','),
      ...rows.map((r) => {
        const statusAr = guestStatus(r.status).label;
        const seats = r.status === 'declined' ? 0 : (Number(r.companions_count) || 0) + 1;
        const checkedAr = r.checked_in ? 'تم الدخول' : 'لم يسجل بعد';
        const checkedTime = r.checked_in_at ? formatTime(r.checked_in_at) : '';
        const link = r.invite_token ? guestInviteUrl(ev, r) : '';
        return [
          r.guest_name || '',
          prettyPhone(r.phone),
          statusAr,
          Number(r.companions_count) || 0,
          seats,
          checkedAr,
          checkedTime,
          r.qr_code || '',
          r.notes || '',
          link,
        ]
          .map(escapeCsv)
          .join(',');
      }),
    ];
    const blob = new Blob([`\uFEFF${csvLines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `guests-${ev.share_code || ev.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('تم تصدير قائمة المدعوين بنجاح (ملف Excel / CSV).');
  };

  const printGuestsSheet = () => {
    const ev = guestModal.event;
    const rows = guestModal.rsvps || [];
    if (!ev || !rows.length) {
      showToast('لا يوجد مدعوون لطباعة الكشف.');
      return;
    }
    const win = window.open('', '_blank', 'width=840,height=720');
    if (!win) {
      showToast('يرجى السماح بالنوافذ المنبثقة لطباعة كشف الحضور.');
      return;
    }
    const tableRows = rows
      .map(
        (r, i) => `<tr>
          <td>${i + 1}</td>
          <td><strong>${escapeHtml(r.guest_name)}</strong></td>
          <td dir="ltr">${escapeHtml(prettyPhone(r.phone))}</td>
          <td>${escapeHtml(guestStatus(r.status).label)}</td>
          <td>${Number(r.companions_count) || 0}</td>
          <td>${r.checked_in ? '✓ حضر' : '—'}</td>
          <td>${escapeHtml(r.notes || '')}</td>
        </tr>`,
      )
      .join('');
    win.document.write(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>كشف المدعوين — ${escapeHtml(ev.title)} — مخصوص</title>
<style>
  body{margin:0;padding:28px;font-family:Tahoma,sans-serif;color:#0f3d32;background:#fff}
  header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f3d32;padding-bottom:14px;margin-bottom:18px}
  h1{margin:0 0 6px;font-size:20px}
  p{margin:2px 0;color:#5a6359;font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{border:1px solid #ccc;padding:8px 10px;text-align:right}
  th{background:#f7f4ee;font-weight:bold}
</style></head><body>
<header>
  <div>
    <h1>كشف المدعوين والحضور: ${escapeHtml(ev.title)}</h1>
    <p>الداعي: ${escapeHtml(ev.host_name)} · المكان: ${escapeHtml(ev.venue_name)}</p>
    <p>التاريخ: ${escapeHtml(formatEventDate(ev.event_date))} ${escapeHtml(ev.event_time || '')}</p>
  </div>
  <div style="text-align:left">
    <strong>مخصوص · MA5SOS</strong>
    <p>إجمالي السجلات: ${rows.length}</p>
  </div>
</header>
<table>
  <thead><tr><th>#</th><th>اسم المدعو</th><th>الجوال</th><th>الحالة</th><th>المرافقون</th><th>البوابة</th><th>ملاحظات</th></tr></thead>
  <tbody>${tableRows}</tbody>
</table>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const refreshGuestModal = async () => {
    if (!guestModal.event) return;
    const details = await apiCall(`/events/${guestModal.event.id}`);
    setGuestModal((previous) => ({
      ...previous,
      event: details,
      rsvps: Array.isArray(details.rsvps) ? details.rsvps : [],
    }));
  };

  const resetGuestForm = () => {
    setGuestFormOpen(false);
    setEditingGuestId(null);
    setGuestForm(emptyGuestForm());
    setGuestFormError('');
  };

  const openAddGuest = () => {
    setGuestForm(emptyGuestForm());
    setEditingGuestId(null);
    setGuestFormError('');
    setGuestFormOpen(true);
  };

  const openEditGuest = (guest) => {
    setGuestForm({
      guest_name: guest.guest_name || '',
      phone: prettyPhone(guest.phone),
      companions_count: Number(guest.companions_count) || 0,
      notes: guest.notes || '',
    });
    setEditingGuestId(guest.id);
    setGuestFormError('');
    setGuestFormOpen(true);
  };

  const saveGuest = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!guestModal.event) return;
    setGuestFormError('');

    const name = text(guestForm.guest_name).replace(/\s+/g, ' ');
    if (name.length < 2) {
      setGuestFormError('يرجى كتابة اسم المدعو (حرفان على الأقل).');
      return;
    }

    const phone = normalizeSaudiMobile(guestForm.phone);
    if (!phone) {
      setGuestFormError('يرجى إدخال رقم جوال سعودي صحيح يبدأ بـ 05.');
      return;
    }

    const companions = Math.max(0, Math.min(Number(guestForm.companions_count) || 0, 10));
    const payload = {
      guest_name: name,
      phone,
      companions_count: companions,
      notes: text(guestForm.notes) || null,
    };

    setGuestFormBusy(true);
    try {
      if (editingGuestId) {
        await apiCall(`/events/${guestModal.event.id}/guests/${editingGuestId}`, {
          method: 'PUT',
          body: payload,
        });
        showToast('تم تحديث بيانات المدعو ورابط دعوته الخاص.');
      } else {
        await apiCall(`/events/${guestModal.event.id}/guests`, {
          method: 'POST',
          body: payload,
        });
        showToast('تمت إضافة المدعو وتجهيز رابط دعوة خاص به.');
      }
      resetGuestForm();
      await refreshGuestModal();
      await loadDashboardData();
    } catch (problem) {
      setGuestFormError(problem.message || 'تعذّر حفظ بيانات المدعو. يرجى المحاولة مرة أخرى.');
    } finally {
      setGuestFormBusy(false);
    }
  };

  const openGuestModal = async (event) => {
    setGuestError('');
    resetGuestForm();
    try {
      const details = await apiCall(`/events/${event.id}`);
      setGuestModal({
        open: true,
        event: details,
        rsvps: Array.isArray(details.rsvps) ? details.rsvps : [],
      });
      setGuestSearch('');
      setGuestStatusFilter('all');
    } catch (problem) {
      showToast(problem.message || 'تعذّر تحميل قائمة المدعوين.');
    }
  };

  const closeGuestModal = () => {
    setGuestModal({ open: false, event: null, rsvps: [] });
    resetGuestForm();
  };

  const closeQrModal = () => setQrModal({ open: false, event: null, rsvp: null });

  const toggleCheckIn = async (rsvpId) => {
    if (!guestModal.event) return;
    setGuestError('');
    try {
      const result = await apiCall(`/events/${guestModal.event.id}/rsvps/${rsvpId}/checkin`, {
        method: 'POST',
      });
      setGuestModal((previous) => ({
        ...previous,
        rsvps: previous.rsvps.map((rsvp) =>
          rsvp.id === rsvpId
            ? { ...rsvp, checked_in: result.checked_in, checked_in_at: result.checked_in_at }
            : rsvp,
        ),
      }));
      showToast(result.checked_in ? 'تم تأكيد حضور الضيف عند البوابة.' : 'تم إلغاء تسجيل الحضور.');
      await loadDashboardData();
    } catch (problem) {
      setGuestError(problem.message || 'تعذّر تحديث حالة الحضور.');
    }
  };

  const deleteGuestRSVP = async (rsvpId) => {
    if (!guestModal.event) return;
    if (!window.confirm('هل أنت متأكد من حذف هذا المدعو ورابط دعوته نهائيًا؟')) return;
    setGuestError('');
    try {
      await apiCall(`/events/${guestModal.event.id}/rsvps/${rsvpId}`, { method: 'DELETE' });
      setGuestModal((previous) => ({
        ...previous,
        rsvps: previous.rsvps.filter((rsvp) => rsvp.id !== rsvpId),
      }));
      if (editingGuestId === rsvpId) resetGuestForm();
      showToast('تم حذف المدعو بنجاح.');
      await loadDashboardData();
    } catch (problem) {
      setGuestError(problem.message || 'تعذّر حذف المدعو.');
    }
  };

  const openGuestQr = (event, rsvp) => setQrModal({ open: true, event, rsvp });

  const printGuestQr = () => {
    const content = qrPrintRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=460,height=680');
    if (!printWindow) {
      showToast('يرجى السماح بالنوافذ المنبثقة لطباعة التذكرة.');
      return;
    }
    const guest = qrModal.rsvp?.guest_name || 'ضيف';
    printWindow.document.write(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>تذكرة ${escapeHtml(guest)} — مخصوص</title>
<style>
  body{margin:0;padding:28px;background:#fff;color:#0f3d32;font-family:Tahoma,sans-serif;text-align:center}
  .card{max-width:360px;margin:0 auto;border:2px solid #0f3d32;border-radius:18px;padding:24px}
  .brand{font-size:14px;letter-spacing:2px;color:#7a5f4b;margin-bottom:8px}
  h1{font-size:22px;margin:0 0 4px}
  .event{font-size:14px;color:#5a6359;margin-bottom:16px}
  .qr{width:260px;height:260px;margin:0 auto 12px}
  .name{font-size:20px;font-weight:bold}
  .meta{font-size:13px;color:#5a6359;margin-top:8px;line-height:1.8}
  .code{direction:ltr;font-family:monospace;font-size:11px;color:#5a6359;margin-top:10px;word-break:break-all}
  @media print{body{padding:0}.card{border-width:1px}}
</style></head><body><div class="card">
  <div class="brand">مخصوص · MA5SOS</div>
  <h1>تذكرة دخول</h1>
  <div class="event">${escapeHtml(qrModal.event?.title || '')}</div>
  <div class="qr">${content.innerHTML}</div>
  <div class="name">${escapeHtml(guest)}</div>
  <div class="meta">${escapeHtml(
    qrModal.rsvp?.companions_count > 0 ? `مع ${qrModal.rsvp.companions_count} مرافقين` : 'دعوة شخصية',
  )}</div>
  <div class="code">${escapeHtml(encodeGuestQr(qrModal.rsvp?.qr_code || ''))}</div>
</div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 350);
  };

  // ---------- QR scanner ----------

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState('idle');
  };

  const scanVideoFrame = () => {
    if (processingRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width && height) {
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(video, 0, 0, width, height);
        const image = context.getImageData(0, 0, width, height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
        if (code?.data?.trim()) {
          handleProcessQrCode(code.data.trim());
          return;
        }
      }
    }
    animFrameRef.current = requestAnimationFrame(scanVideoFrame);
  };

  const startCamera = async () => {
    setScannerError('');
    setCameraState('starting');
    try {
      stopCamera();
      setCameraState('starting');
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('camera-unsupported');
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.setAttribute('playsinline', 'true');
      await videoRef.current.play();
      setCameraState('ready');
      animFrameRef.current = requestAnimationFrame(scanVideoFrame);
    } catch (problem) {
      console.warn('Camera access error:', problem);
      setCameraState('denied');
      setScannerError(
        'تعذّر تشغيل الكاميرا. امنح المتصفح إذن الكاميرا ثم أعد المحاولة، أو ارفع صورة رمز QR، أو أدخل الرمز يدويًا.',
      );
    }
  };

  const openScanner = (eventId = null) => {
    if (!events.length) {
      showToast('أنشئ مناسبة أولًا لتتمكن من مسح تذاكر الضيوف.');
      return;
    }
    const target = eventId || events[0]?.id || null;
    setScanEventId(target);
    scanEventRef.current = target;
    setScanResult(null);
    setScannerError('');
    setManualCode('');
    setScanMode('camera');
    setCameraState('idle');
    processingRef.current = false;
    setScannerOpen(true);
  };

  const closeScanner = () => {
    stopCamera();
    processingRef.current = false;
    setScannerOpen(false);
    setScanResult(null);
    setScanBusy(false);
  };

  const resetScanner = () => {
    processingRef.current = false;
    setScanResult(null);
    setScannerError('');
    setManualCode('');
    setScanBusy(false);
    if (scanMode === 'camera') startCamera();
  };

  const handleProcessQrCode = async (rawInput) => {
    if (processingRef.current) return;

    const raw = text(rawInput);
    const reading = readGuestQr(raw);
    if (!reading.token) {
      stopCamera();
      if (reading.kind === 'empty') {
        setScannerError('لم نتعرّف على أي رمز. وجّه الكاميرا نحو رمز QR أو ارفع صورة واضحة له.');
      } else if (reading.kind === 'invalid') {
        setScannerError('هذا رمز صادر من مخصوص لكنه ليس تذكرة دخول. اطلب من الضيف فتح دعوته وإظهار رمز QR الخاص به.');
      } else {
        setScannerError('تم رفض الرمز: ليس رمز QR صادرًا من منصة مخصوص. اطلب من الداعي إرسال دعوة مخصوص الأصلية للضيف.');
      }
      return;
    }

    processingRef.current = true;
    stopCamera();
    setScanBusy(true);
    setScannerError('');

    try {
      const targetId = scanEventRef.current || events[0]?.id;
      if (!targetId) {
        setScannerError('لم يتم تحديد المناسبة. اختر المناسبة ثم أعد المسح.');
        return;
      }
      const result = await apiCall(`/events/${targetId}/checkin`, {
        method: 'POST',
        body: { qr_token: raw },
      });
      setScanResult(result);
      if (navigator.vibrate) navigator.vibrate([80, 40, 120]);
      await loadDashboardData();
    } catch (problem) {
      setScannerError(problem.message || 'تعذّر التحقق من الرمز. تأكد من أن التذكرة تعود لهذه المناسبة.');
    } finally {
      processingRef.current = false;
      setScanBusy(false);
    }
  };

  const handleFileScan = (changeEvent) => {
    const file = changeEvent.target.files?.[0];
    changeEvent.target.value = '';
    if (!file) return;

    stopCamera();
    setScannerError('');
    setScanResult(null);
    setScanBusy(true);

    const reader = new FileReader();
    reader.onerror = () => {
      setScannerError('تعذّر قراءة الصورة. يرجى اختيار صورة أخرى.');
      setScanBusy(false);
    };
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => {
        setScannerError('صيغة الصورة غير مدعومة. يرجى رفع صورة PNG أو JPG واضحة.');
        setScanBusy(false);
      };
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, 0, 0);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code?.data?.trim()) {
            setScanBusy(false);
            handleProcessQrCode(code.data.trim());
          } else {
            setScannerError('لم نعثر على رمز QR واضح في هذه الصورة. جرّب صورة أقرب أو أدخل الرمز يدويًا.');
            setScanBusy(false);
          }
        } catch {
          setScannerError('تعذّرت قراءة الصورة. يرجى المحاولة بصورة أخرى.');
          setScanBusy(false);
        }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleManualCheckIn = (submitEvent) => {
    submitEvent.preventDefault();
    if (!manualCode.trim() || scanBusy) return;
    handleProcessQrCode(manualCode.trim());
  };

  useEffect(() => {
    if (scannerOpen && scanMode === 'camera' && !scanResult && !scannerError) {
      startCamera();
    } else if (scannerOpen) {
      stopCamera();
    }
    return () => stopCamera();
  }, [scannerOpen, scanMode, scanResult]);

  // ---------- Derived lists ----------

  const filteredEvents = events.filter((event) => {
    const matchesType = filterType === 'all' || event.occasion_type === filterType;
    if (!matchesType) return false;
    const query = lower(search);
    if (!query) return true;
    return [event.title, event.host_name, event.venue_name, event.share_code].some((value) =>
      lower(value).includes(query),
    );
  });

  const filteredGuests = (guestModal.rsvps || []).filter((rsvp) => {
    if (guestStatusFilter === 'checked_in' && !rsvp.checked_in) return false;
    if (guestStatusFilter !== 'all' && guestStatusFilter !== 'checked_in' && rsvp.status !== guestStatusFilter) {
      return false;
    }
    const query = lower(guestSearch);
    if (!query) return true;
    return [rsvp.guest_name, rsvp.phone, rsvp.notes].some((value) => lower(value).includes(query));
  });

  const currentTemplate = PHOTO_TEMPLATES.find((template) => template.id === formData.template_id) || PHOTO_TEMPLATES[0];

  const filteredTemplates = PHOTO_TEMPLATES.filter(
    (template) => templateFilter === 'all' || template.occasion?.includes(templateFilter),
  );

  const confirmedGuests = guestModal.rsvps.filter((rsvp) => rsvp.status === 'confirmed').length;
  const confirmedSeats = guestModal.rsvps
    .filter((rsvp) => rsvp.status === 'confirmed')
    .reduce((sum, rsvp) => sum + (Number(rsvp.companions_count) || 0) + 1, 0);
  const pendingGuests = guestModal.rsvps.filter((rsvp) => rsvp.status === 'pending').length;
  const checkedInGuests = guestModal.rsvps.filter((rsvp) => rsvp.checked_in).length;

  // ---------- Login view ----------

  if (session.status === 'loading') {
    return (
      <section className="section admin-login">
        <div className="wrap">
          <p className="admin-loading">جارٍ التحقق من الحساب...</p>
        </div>
      </section>
    );
  }

  if (!signedIn) {
    return (
      <section className="section admin-login">
        <div className="wrap">
          <div className="admin-login__card">
            <header className="admin-login__header">
              <span className="tile">
                <IconShield size={30} />
              </span>
              <p className="head__eyebrow">مساحتك في مخصوص</p>
              <h1 className="admin-login__title">لوحة تحكم مناسباتك</h1>
              <p className="admin-login__subtitle">
                سجّل دخولك لمتابعة ردود المدعوين، وإدارة تفاصيل الحفل، ومسح تذاكر الدخول.
              </p>
            </header>

            {error && (
              <div className="admin-alert admin-alert--error" role="alert">
                <IconAlert size={18} />
                <span>{error}</span>
              </div>
            )}

            <a className="btn btn--primary btn--block" href="/login/?next=/admin/">
              تسجيل الدخول أو إنشاء حساب
            </a>
            <p className="admin-login__hint">
              ليس لديك حساب؟ يمكنك إنشاء حساب جديد بنفس الصفحة برقم جوالك السعودي.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ---------- Dashboard ----------

  return (
    <section className="section admin-dashboard" aria-label="لوحة تحكم إدارة المناسبات">
      <div className="wrap">
        {toast && (
          <div className="admin-toast" role="status">
            <IconCheck size={18} />
            <span>{toast}</span>
          </div>
        )}

        <header className="admin-head">
          <div className="admin-head__welcome">
            <span className="admin-head__badge">
              <span className="dot dot--live" />
              مساحتك الخاصة لإدارة المناسبات · مخصوص
            </span>
            <h1 className="admin-head__title">مرحبًا، {currentUser?.name || 'بك'}</h1>
            <p className="admin-head__sub">
              تابع ردود المدعوين، وأدر تفاصيل الحفل، وامسح رمز QR عند البوابة.
            </p>
            <div className={`admin-head__plan${isTrial ? ' admin-head__plan--trial' : ''}`}>
              <IconStar size={15} />
              <span>
                {isTrial
                  ? 'التجربة المجانية · حتى 3 مدعوين ومناسبة واحدة'
                  : `${planMeta.name} · حتى ${planLimit.toLocaleString('ar-SA')} مدعوًا`}
              </span>
              {isTrial && (
                <a className="admin-head__upgrade" href="/packages/">
                  ترقية الباقة
                </a>
              )}
            </div>
          </div>

          <div className="admin-head__actions">
            <button
              type="button"
              className="btn btn--secondary admin-scan-btn"
              onClick={() => openScanner()}
              title="مسح رمز QR للضيوف"
            >
              <IconQr size={18} />
              <span>مسح QR للدخول</span>
            </button>
            <button type="button" className="btn btn--primary" onClick={openCreateModal}>
              <IconPlus size={18} />
              <span>إضافة مناسبة جديدة</span>
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={logout} title="تسجيل الخروج">
              <IconLogout size={18} />
              <span>خروج</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="admin-alert admin-alert--error admin-alert--with-action" role="alert">
            <IconAlert size={18} />
            <span>{error}</span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={loadDashboardData}>
              إعادة المحاولة
            </button>
          </div>
        )}

        {stats && (
          <div className="admin-stats">
            <div className="stat-card">
              <span className="stat-card__icon tile">
                <IconCalendar size={22} />
              </span>
              <div>
                <p className="stat-card__label">إجمالي المناسبات</p>
                <h3 className="stat-card__val">{stats.total_events ?? 0}</h3>
              </div>
            </div>

            <div className="stat-card">
              <span className="stat-card__icon tile">
                <IconUsers size={22} />
              </span>
              <div>
                <p className="stat-card__label">إجمالي المدعوين</p>
                <h3 className="stat-card__val">{stats.total_guests ?? 0}</h3>
              </div>
            </div>

            <div className="stat-card stat-card--success">
              <span className="stat-card__icon tile">
                <IconCheck size={22} />
              </span>
              <div>
                <p className="stat-card__label">الحضور المؤكد</p>
                <h3 className="stat-card__val">{stats.confirmed_guests ?? 0}</h3>
              </div>
            </div>

            <div className="stat-card stat-card--muted">
              <span className="stat-card__icon tile">
                <IconClose size={22} />
              </span>
              <div>
                <p className="stat-card__label">الاعتذارات</p>
                <h3 className="stat-card__val">{stats.declined_guests ?? 0}</h3>
              </div>
            </div>
          </div>
        )}

        <div className="admin-controls">
          <div className="admin-search">
            <input
              type="search"
              placeholder="ابحث باسم المناسبة، الداعي، القاعة أو كود الدعوة..."
              value={search}
              onChange={(changeEvent) => setSearch(changeEvent.target.value)}
              aria-label="بحث في المناسبات"
            />
          </div>

          <div className="admin-filters" role="tablist" aria-label="تصفية حسب نوع المناسبة">
            {OCCASION_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                role="tab"
                aria-selected={filterType === type.id}
                className="admin-filter-pill"
                data-active={filterType === type.id}
                onClick={() => setFilterType(type.id)}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="admin-loading">جارٍ جلب وتحديث البيانات...</p>}

        {!loading && filteredEvents.length === 0 && (
          <div className="admin-empty">
            <span className="tile">
              <IconCalendar size={30} />
            </span>
            <h3>{events.length ? 'لا توجد مناسبات مطابقة للبحث' : 'لا توجد مناسبات مسجلة حاليًا'}</h3>
            <p>
              {events.length
                ? 'جرّب كلمة بحث أخرى أو اختر «الكل» لعرض جميع المناسبات.'
                : 'ابدأ بإنشاء أول مناسبة إلكترونية وشارك رابطها مع الضيوف بكل سهولة.'}
            </p>
            {!events.length && (
              <button type="button" className="btn btn--primary" onClick={openCreateModal}>
                <IconPlus size={18} />
                <span>إضافة مناسبة الآن</span>
              </button>
            )}
          </div>
        )}

        {!loading && filteredEvents.length > 0 && (
          <div className="admin-events-grid">
            {filteredEvents.map((event) => {
              const totalRsvps = Number(event.total_rsvps ?? event.rsvps?.length ?? 0);
              const confirmed = Number(event.confirmed_count ?? 0);
              const seats = Number(event.total_guests ?? confirmed);
              const maxSeats = Math.max(Number(event.max_guests) || 1, 1);
              const percentage = Math.min(100, Math.round((seats / maxSeats) * 100));

              return (
                <article key={event.id} className="event-card">
                  <div className="event-card__head">
                    <div>
                      <span className="pill">{occasionLabel(event.occasion_type)}</span>
                      <h3 className="event-card__title">{event.title || 'مناسبة'}</h3>
                      <p className="event-card__host">الداعي: {event.host_name || '—'}</p>
                    </div>
                    <span className="event-card__code" title="كود الدعوة الفريد">
                      {event.share_code || '—'}
                    </span>
                  </div>

                  <div className="event-card__body">
                    <ul className="event-card__meta">
                      <li>
                        <IconCalendar size={16} />
                        <span>{formatEventDate(event.event_date)}</span>
                      </li>
                      {event.event_time && (
                        <li>
                          <IconClock size={16} />
                          <span>{event.event_time}</span>
                        </li>
                      )}
                      <li>
                        <IconPin size={16} />
                        <span>{event.venue_name || 'المكان غير محدد'}</span>
                      </li>
                    </ul>

                    {event.description && <p className="event-card__desc">{event.description}</p>}

                    <div className="event-card__progress">
                      <div className="event-card__counts">
                        <span>
                          الحضور المؤكد: <strong>{seats}</strong> ضيف ({confirmed} دعوة)
                        </span>
                        <span>
                          الحد الأقصى: <strong>{event.max_guests ?? planLimit}</strong>
                        </span>
                      </div>
                      <div className="progress-bar" aria-hidden="true">
                        <div className="progress-bar__fill" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  </div>

                  <footer className="event-card__footer">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => openScanner(event.id)}
                      title="مسح رمز QR لضيوف هذه المناسبة"
                    >
                      <IconQr size={16} />
                      <span>مسح QR</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => openGuestModal(event)}
                    >
                      المدعوون ({totalRsvps})
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => copyInviteLink(event.share_code)}
                      title="نسخ رابط الدعوة"
                    >
                      نسخ الرابط
                    </button>
                    <a
                      className="btn btn--ghost btn--sm"
                      href={`/invite/?code=${encodeURIComponent(event.share_code || '')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      معاينة
                    </a>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => openEditModal(event)}
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => setDeleteModal({ open: true, event })}
                    >
                      حذف
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {/* Create / edit event */}
        {eventModal.open && (
          <div className="admin-modal-backdrop" onClick={closeEventModal}>
            <div className="admin-modal admin-modal--editor" onClick={(clickEvent) => clickEvent.stopPropagation()}>
              <div className="admin-modal__head">
                <div>
                  <span className="pill">{eventModal.mode === 'create' ? 'مناسبة جديدة' : 'تعديل المناسبة'}</span>
                  <h2>
                    {eventModal.mode === 'create'
                      ? 'إنشاء وتجهيز دعوة إلكترونية'
                      : `تعديل: ${formData.title || 'المناسبة'}`}
                  </h2>
                </div>
                <button type="button" className="icon-btn" onClick={closeEventModal} aria-label="إغلاق">
                  <IconClose size={20} />
                </button>
              </div>

              <div className="modal-tabs" role="tablist" aria-label="خطوات إنشاء المناسبة">
                {[
                  { id: 'info', label: 'معلومات المناسبة', Icon: IconCalendar },
                  { id: 'datetime', label: 'الموعد والمكان', Icon: IconClock },
                  { id: 'template', label: 'اختيار القالب', Icon: IconStar },
                  { id: 'guests', label: 'المدعوون والملاحظات', Icon: IconUsers },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={modalTab === id}
                    className="modal-tab-btn"
                    data-active={modalTab === id}
                    onClick={() => setModalTab(id)}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={handleSaveEvent} className="admin-modal__form" noValidate>
                {modalError && (
                  <div className="admin-alert admin-alert--error" role="alert">
                    <IconAlert size={18} />
                    <span>{modalError}</span>
                  </div>
                )}

                {modalTab === 'info' && (
                  <div className="modal-tab-pane">
                    <div className="field">
                      <label htmlFor="event-title">عنوان المناسبة *</label>
                      <div className="field__box">
                        <input
                          id="event-title"
                          required
                          value={formData.title}
                          onChange={(changeEvent) => setFormData({ ...formData, title: changeEvent.target.value })}
                          placeholder="مثال: حفل زفاف فيصل بن عبدالله"
                          maxLength={200}
                        />
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor="event-type">نوع المناسبة</label>
                        <div className="field__box">
                          <select
                            id="event-type"
                            value={formData.occasion_type}
                            onChange={(changeEvent) =>
                              setFormData({ ...formData, occasion_type: changeEvent.target.value })
                            }
                          >
                            <option value="wedding">حفل زواج</option>
                            <option value="milka">عقد قران وملكة</option>
                            <option value="graduation">حفل تخرّج</option>
                            <option value="baby">مولود وعقيقة</option>
                            <option value="party">حفلة خاصة</option>
                            <option value="general">مناسبة عامة</option>
                          </select>
                        </div>
                      </div>

                      <div className="field">
                        <label htmlFor="host-name">اسم الداعي / أسرة الداعي *</label>
                        <div className="field__box">
                          <input
                            id="host-name"
                            required
                            value={formData.host_name}
                            onChange={(changeEvent) => setFormData({ ...formData, host_name: changeEvent.target.value })}
                            placeholder="مثال: عبدالله بن عبدالعزيز القحطاني"
                            maxLength={150}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="honoree-name">اسم المحتفى به (العريس / العروس / الخريج / المولود)</label>
                      <div className="field__box">
                        <input
                          id="honoree-name"
                          value={formData.honoree_name}
                          onChange={(changeEvent) =>
                            setFormData({ ...formData, honoree_name: changeEvent.target.value })
                          }
                          placeholder="مثال: فيصل"
                          maxLength={100}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {modalTab === 'datetime' && (
                  <div className="modal-tab-pane">
                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor="event-date">تاريخ ووقت المناسبة *</label>
                        <div className="field__box">
                          <input
                            id="event-date"
                            type="datetime-local"
                            required
                            value={formData.event_date}
                            onChange={(changeEvent) =>
                              setFormData({ ...formData, event_date: changeEvent.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="field">
                        <label htmlFor="event-time">وقت الحفل (نصي يظهر على البطاقة)</label>
                        <div className="field__box">
                          <input
                            id="event-time"
                            value={formData.event_time}
                            onChange={(changeEvent) => setFormData({ ...formData, event_time: changeEvent.target.value })}
                            placeholder="مثال: 8:30 مساءً"
                            maxLength={50}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="venue-name">اسم القاعة أو المكان *</label>
                      <div className="field__box">
                        <input
                          id="venue-name"
                          required
                          value={formData.venue_name}
                          onChange={(changeEvent) => setFormData({ ...formData, venue_name: changeEvent.target.value })}
                          placeholder="مثال: قاعة ليلتي للاحتفالات، الرياض"
                          maxLength={200}
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="venue-address">العنوان التفصيلي (اختياري)</label>
                      <div className="field__box">
                        <input
                          id="venue-address"
                          value={formData.venue_address}
                          onChange={(changeEvent) =>
                            setFormData({ ...formData, venue_address: changeEvent.target.value })
                          }
                          placeholder="الحي، الشارع، المدينة"
                          maxLength={250}
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="location-url">رابط الموقع على خرائط Google</label>
                      <div className="field__box" dir="ltr">
                        <input
                          id="location-url"
                          type="url"
                          value={formData.location_url}
                          onChange={(changeEvent) =>
                            setFormData({ ...formData, location_url: changeEvent.target.value })
                          }
                          placeholder="https://maps.google.com/?q=..."
                        />
                      </div>
                    </div>

                    <div className="field">
                      <div className="field__label-row">
                        <label htmlFor="event-description">نص الدعوة (عبارة الترحيب)</label>
                        <button type="button" className="guest-qr-btn" onClick={insertSuggestedWording}>
                          إدراج صيغة مقترحة تلقائيًا
                        </button>
                      </div>
                      <div className="field__box">
                        <textarea
                          id="event-description"
                          rows={3}
                          value={formData.description}
                          onChange={(changeEvent) =>
                            setFormData({ ...formData, description: changeEvent.target.value })
                          }
                          placeholder="يتشرف الداعي بدعوتكم لحضور هذه المناسبة السعيدة..."
                          maxLength={2000}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {modalTab === 'template' && (
                  <div className="modal-tab-pane">
                    <div className="template-selected-summary">
                      <div className="template-selected-thumb">
                        <img src={currentTemplate?.thumb} alt={currentTemplate?.name || 'القالب المختار'} />
                      </div>
                      <div>
                        <span className="pill">{currentTemplate?.occasion}</span>
                        <h4>القالب المختار: {currentTemplate?.name}</h4>
                        <p>{currentTemplate?.description}</p>
                      </div>
                    </div>

                    <div className="template-filters-row">
                      {['all', 'زواج', 'أفراح رجالية', 'ملكة', 'حنّاء', 'تخرّج', 'مولود', 'خطوبة', 'اجتماع عائلي'].map(
                        (category) => (
                          <button
                            key={category}
                            type="button"
                            className="template-filter-btn"
                            data-active={templateFilter === category}
                            onClick={() => setTemplateFilter(category)}
                          >
                            {category === 'all' ? `جميع القوالب (${PHOTO_TEMPLATES.length})` : category}
                          </button>
                        ),
                      )}
                    </div>

                    <div className="template-picker-grid">
                      {filteredTemplates.map((template) => {
                        const selected = formData.template_id === template.id;
                        return (
                          <button
                            key={template.id}
                            type="button"
                            className={`template-picker-item${selected ? ' template-picker-item--active' : ''}`}
                            onClick={() => setFormData({ ...formData, template_id: template.id })}
                            aria-pressed={selected}
                          >
                            <span className="template-picker-item__preview">
                              <img src={template.thumb} alt={template.name} loading="lazy" />
                              {selected && (
                                <span className="template-picker-item__badge">
                                  <IconCheck size={18} />
                                </span>
                              )}
                            </span>
                            <span className="template-picker-item__info">
                              <strong className="template-picker-item__name">{template.name}</strong>
                              <span className="pill pill--xs">{template.occasion}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {modalTab === 'guests' && (
                  <div className="modal-tab-pane">
                    <div className="field">
                      <label htmlFor="max-guests">الحد الأقصى لعدد المدعوين</label>
                      <div className="field__box">
                        <input
                          id="max-guests"
                          type="number"
                          min="1"
                          max={planLimit}
                          value={formData.max_guests}
                          onChange={(changeEvent) =>
                            setFormData({
                              ...formData,
                              max_guests: Math.max(
                                1,
                                Math.min(Number(changeEvent.target.value) || 1, planLimit),
                              ),
                            })
                          }
                        />
                      </div>
                      <p className="field__hint">
                        {isTrial
                          ? `التجربة المجانية تسمح حتى ${planLimit} مدعوين.`
                          : `${planMeta.name} تسمح حتى ${planLimit.toLocaleString('ar-SA')} مدعوًا.`}
                      </p>
                    </div>

                    <div className="field">
                      <label htmlFor="event-notes">ملاحظات وتعليمات الحضور للضيوف</label>
                      <div className="field__box">
                        <textarea
                          id="event-notes"
                          rows={3}
                          value={formData.notes}
                          onChange={(changeEvent) => setFormData({ ...formData, notes: changeEvent.target.value })}
                          placeholder="مثال: نرجو إبراز رمز QR عند الدخول"
                          maxLength={2000}
                        />
                      </div>
                    </div>

                    {isTrial && (
                      <div className="admin-alert admin-alert--warning">
                        <IconAlert size={18} />
                        <span>
                          أنت على التجربة المجانية: مناسبة واحدة وحتى {planLimit} مدعوين.{' '}
                          <a href="/packages/">ترقية الباقة</a>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="admin-modal__foot">
                  <div className="admin-modal__foot-nav">
                    {modalTab !== 'info' && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          const tabs = ['info', 'datetime', 'template', 'guests'];
                          const index = tabs.indexOf(modalTab);
                          if (index > 0) setModalTab(tabs[index - 1]);
                        }}
                      >
                        السابق
                      </button>
                    )}
                    {modalTab !== 'guests' && (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => {
                          const tabs = ['info', 'datetime', 'template', 'guests'];
                          const index = tabs.indexOf(modalTab);
                          if (index < tabs.length - 1) setModalTab(tabs[index + 1]);
                        }}
                      >
                        التالي
                      </button>
                    )}
                  </div>

                  <div className="admin-modal__foot-actions">
                    <button type="button" className="btn btn--ghost" onClick={closeEventModal}>
                      إلغاء
                    </button>
                    <button type="submit" className="btn btn--primary" disabled={modalBusy}>
                      {modalBusy
                        ? 'جارٍ الحفظ...'
                        : eventModal.mode === 'create'
                          ? 'إنشاء المناسبة وحفظ القالب'
                          : 'حفظ التعديلات'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Guest list */}
        {guestModal.open && guestModal.event && (
          <div className="admin-modal-backdrop" onClick={closeGuestModal}>
            <div className="admin-modal admin-modal--large" onClick={(clickEvent) => clickEvent.stopPropagation()}>
              <div className="admin-modal__head">
                <div>
                  <span className="pill">إدارة المدعوين والدعوات الخاصة</span>
                  <h2>{guestModal.event.title}</h2>
                  <p className="admin-modal__sub">
                    الدعوات: <strong>{guestModal.rsvps.length}</strong> · الحضور المؤكد (شاملة المرافقين):{' '}
                    <strong>{confirmedSeats}</strong> ({confirmedGuests} دعوة) · بانتظار الرد:{' '}
                    <strong>{pendingGuests}</strong> · دخل البوابة: <strong>{checkedInGuests}</strong>
                  </p>
                </div>
                <div className="admin-modal__head-tools">
                  <button type="button" className="btn btn--primary btn--sm" onClick={openAddGuest}>
                    <IconPlus size={16} />
                    <span>إضافة مدعو</span>
                  </button>
                  {guestModal.rsvps.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={exportGuestsCsv}
                        title="تصدير قائمة المدعوين إلى ملف Excel / CSV"
                      >
                        <span>تصدير CSV</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={printGuestsSheet}
                        title="طباعة كشف الحضور للاستقبال"
                      >
                        <IconPrint size={16} />
                        <span>طباعة الكشف</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => {
                      const eventId = guestModal.event?.id;
                      closeGuestModal();
                      openScanner(eventId);
                    }}
                  >
                    <IconQr size={16} />
                    <span>مسح QR</span>
                  </button>
                  <button type="button" className="icon-btn" onClick={closeGuestModal} aria-label="إغلاق">
                    <IconClose size={20} />
                  </button>
                </div>
              </div>

              {guestFormOpen && (
                <form className="guest-form" onSubmit={saveGuest} noValidate>
                  <div className="guest-form__head">
                    <div>
                      <strong>{editingGuestId ? 'تعديل بيانات المدعو' : 'إضافة مدعو جديد'}</strong>
                      <p>أدخل بيانات المدعو، وسيُجهّز النظام رابط دعوة خاصًا به مع رمز QR بعد تأكيده.</p>
                    </div>
                    <button type="button" className="icon-btn" onClick={resetGuestForm} aria-label="إغلاق النموذج">
                      <IconClose size={18} />
                    </button>
                  </div>

                  <div className="guest-form__grid">
                    <div className="field">
                      <label htmlFor="guest-form-name">اسم المدعو *</label>
                      <div className="field__box">
                        <input
                          id="guest-form-name"
                          required
                          value={guestForm.guest_name}
                          onChange={(changeEvent) =>
                            setGuestForm({ ...guestForm, guest_name: changeEvent.target.value })
                          }
                          placeholder="مثال: سعد بن محمد المطيري"
                          maxLength={150}
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="guest-form-phone">رقم الجوال *</label>
                      <div className="field__box" dir="ltr">
                        <input
                          id="guest-form-phone"
                          type="tel"
                          inputMode="numeric"
                          required
                          value={guestForm.phone}
                          onChange={(changeEvent) =>
                            setGuestForm({ ...guestForm, phone: changeEvent.target.value })
                          }
                          placeholder="05XXXXXXXX"
                          maxLength={16}
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="guest-form-companions">عدد المرافقين</label>
                      <div className="field__box">
                        <select
                          id="guest-form-companions"
                          value={guestForm.companions_count}
                          onChange={(changeEvent) =>
                            setGuestForm({ ...guestForm, companions_count: Number(changeEvent.target.value) })
                          }
                        >
                          {Array.from({ length: 11 }, (_, count) => (
                            <option key={count} value={count}>
                              {count === 0
                                ? 'بدون مرافقين'
                                : count === 1
                                  ? 'مرافق واحد (+1)'
                                  : `${count} مرافقين (+${count})`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="guest-form-notes">ملاحظات خاصة</label>
                      <div className="field__box">
                        <input
                          id="guest-form-notes"
                          value={guestForm.notes}
                          onChange={(changeEvent) =>
                            setGuestForm({ ...guestForm, notes: changeEvent.target.value })
                          }
                          placeholder="مثال: من كبار العائلة، أو ملاحظة للاستقبال"
                          maxLength={2000}
                        />
                      </div>
                    </div>
                  </div>

                  {guestFormError && (
                    <div className="admin-alert admin-alert--error guest-form__error" role="alert">
                      <IconAlert size={18} />
                      <span>{guestFormError}</span>
                    </div>
                  )}

                  <div className="guest-form__actions">
                    <button type="submit" className="btn btn--primary btn--sm" disabled={guestFormBusy}>
                      <IconCheck size={16} />
                      <span>{guestFormBusy ? 'جارٍ الحفظ...' : editingGuestId ? 'حفظ التعديل' : 'إضافة المدعو'}</span>
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={resetGuestForm}>
                      إلغاء
                    </button>
                  </div>
                </form>
              )}

              <div className="guest-search-bar">
                <input
                  type="search"
                  placeholder="ابحث باسم المدعو أو رقم الجوال..."
                  value={guestSearch}
                  onChange={(changeEvent) => setGuestSearch(changeEvent.target.value)}
                  aria-label="بحث في المدعوين"
                />
                <div className="guest-status-filters" role="tablist" aria-label="تصفية حالات المدعوين">
                  {[
                    { id: 'all', label: `الكل (${guestModal.rsvps.length})` },
                    { id: 'confirmed', label: `مؤكد (${confirmedGuests})` },
                    { id: 'pending', label: `بانتظار الرد (${pendingGuests})` },
                    { id: 'declined', label: 'معتذر' },
                    { id: 'checked_in', label: `حضر (${checkedInGuests})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={guestStatusFilter === tab.id}
                      className="admin-filter-pill"
                      data-active={guestStatusFilter === tab.id}
                      onClick={() => setGuestStatusFilter(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {guestError && (
                <div className="admin-alert admin-alert--error guest-alert" role="alert">
                  <IconAlert size={18} />
                  <span>{guestError}</span>
                </div>
              )}

              <div className="guest-table-wrap">
                {filteredGuests.length === 0 ? (
                  <p className="guest-empty">
                    {guestModal.rsvps.length
                      ? 'لا توجد نتائج مطابقة لهذا البحث.'
                      : 'لا يوجد مدعوون بعد. اضغط «إضافة مدعو» وأدخل الاسم والجوال وعدد المرافقين، ثم أرسل لكل مدعو رابطه الخاص.'}
                  </p>
                ) : (
                  <table className="guest-table">
                    <thead>
                      <tr>
                        <th>المدعو</th>
                        <th>الجوال</th>
                        <th>الحالة</th>
                        <th>المرافقون</th>
                        <th>الدعوة الخاصة</th>
                        <th>التذكرة</th>
                        <th>الدخول</th>
                        <th>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGuests.map((rsvp) => {
                        const state = guestStatus(rsvp.status);
                        return (
                          <tr key={rsvp.id} className={rsvp.checked_in ? 'guest-checked-in' : ''}>
                            <td>
                              <strong>{rsvp.guest_name || 'ضيف'}</strong>
                              {rsvp.notes && <span className="guest-notes">«{rsvp.notes}»</span>}
                            </td>
                            <td dir="ltr">{prettyPhone(rsvp.phone)}</td>
                            <td>
                              <span className={`pill ${state.className}`}>{state.label}</span>
                            </td>
                            <td>{rsvp.companions_count > 0 ? `+${rsvp.companions_count}` : 'بدون'}</td>
                            <td>
                              {rsvp.invite_token ? (
                                <div className="guest-invite-actions">
                                  <button
                                    type="button"
                                    className="guest-qr-btn"
                                    onClick={() => copyGuestLink(guestModal.event, rsvp)}
                                    title="نسخ رابط الدعوة الخاص بهذا المدعو"
                                  >
                                    <IconSend size={14} />
                                    <span>نسخ الرابط</span>
                                  </button>
                                  <a
                                    className="guest-qr-btn guest-wa-btn"
                                    href={whatsappGuestLink(guestModal.event, rsvp)}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="إرسال الدعوة عبر واتساب"
                                  >
                                    <IconChat size={14} />
                                    <span>واتساب</span>
                                  </a>
                                </div>
                              ) : (
                                <span className="guest-qr-missing">—</span>
                              )}
                            </td>
                            <td>
                              {rsvp.status === 'confirmed' && rsvp.qr_code ? (
                                <button
                                  type="button"
                                  className="guest-qr-btn"
                                  onClick={() => openGuestQr(guestModal.event, rsvp)}
                                >
                                  <IconQr size={16} />
                                  <span>عرض الرمز</span>
                                </button>
                              ) : (
                                <span className="guest-qr-missing">
                                  {rsvp.status === 'pending' ? 'بانتظار التأكيد' : '—'}
                                </span>
                              )}
                            </td>
                            <td>
                              {rsvp.status === 'confirmed' ? (
                                <>
                                  <button
                                    type="button"
                                    className={`btn btn--sm ${rsvp.checked_in ? 'btn--success' : 'btn--ghost'}`}
                                    onClick={() => toggleCheckIn(rsvp.id)}
                                  >
                                    <IconCheck size={16} />
                                    <span>{rsvp.checked_in ? 'تم الدخول' : 'تسجيل دخول'}</span>
                                  </button>
                                  {rsvp.checked_in && rsvp.checked_in_at && (
                                    <small className="guest-checked-time">{formatTime(rsvp.checked_in_at)}</small>
                                  )}
                                </>
                              ) : (
                                <span className="guest-qr-missing">—</span>
                              )}
                            </td>
                            <td>
                              <div className="guest-row-actions">
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm guest-edit-btn"
                                  onClick={() => openEditGuest(rsvp)}
                                  title="تعديل بيانات المدعو"
                                  aria-label={`تعديل بيانات ${rsvp.guest_name || 'المدعو'}`}
                                >
                                  <IconPencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--danger btn--sm guest-delete-btn"
                                  onClick={() => deleteGuestRSVP(rsvp.id)}
                                  title="حذف المدعو"
                                  aria-label={`حذف ${rsvp.guest_name || 'المدعو'}`}
                                >
                                  <IconClose size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Guest QR ticket */}
        {qrModal.open && qrModal.rsvp && (
          <div className="admin-modal-backdrop" onClick={closeQrModal}>
            <div className="admin-modal admin-modal--qr" onClick={(clickEvent) => clickEvent.stopPropagation()}>
              <div className="admin-modal__head">
                <div>
                  <span className="pill">تذكرة الضيف</span>
                  <h2>{qrModal.rsvp.guest_name}</h2>
                </div>
                <button type="button" className="icon-btn" onClick={closeQrModal} aria-label="إغلاق">
                  <IconClose size={20} />
                </button>
              </div>

              <div className="guest-qr-body">
                <div className="guest-qr-card" ref={qrPrintRef}>
                  <span className="guest-qr-brand">مخصوص · تذكرة دخول</span>
                  <p className="guest-qr-event">{qrModal.event?.title}</p>
                  <div className="guest-qr-image">
                    <QrCode
                      value={encodeGuestQr(qrModal.rsvp.qr_code)}
                      label={`رمز QR للضيف ${qrModal.rsvp.guest_name}`}
                    />
                  </div>
                  <strong className="guest-qr-name">{qrModal.rsvp.guest_name}</strong>
                  <p className="guest-qr-meta">
                    {qrModal.rsvp.companions_count > 0
                      ? `مع ${qrModal.rsvp.companions_count} مرافقين`
                      : 'دعوة شخصية بدون مرافقين'}
                  </p>
                  <code className="guest-qr-token" dir="ltr">
                    {qrModal.rsvp.qr_code}
                  </code>
                  <p className="guest-qr-venue">
                    <IconPin size={14} /> {qrModal.event?.venue_name}
                  </p>
                </div>

                <div className="guest-qr-actions">
                  <button type="button" className="btn btn--primary" onClick={printGuestQr}>
                    طباعة التذكرة
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={closeQrModal}>
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scanner */}
        {scannerOpen && (
          <div className="admin-modal-backdrop" onClick={closeScanner}>
            <div className="admin-modal admin-modal--scanner" onClick={(clickEvent) => clickEvent.stopPropagation()}>
              <div className="admin-modal__head">
                <div>
                  <span className="pill">تأكيد الحضور الذكي</span>
                  <h2>مسح رمز QR عند البوابة</h2>
                </div>
                <button type="button" className="icon-btn" onClick={closeScanner} aria-label="إغلاق">
                  <IconClose size={20} />
                </button>
              </div>

              <div className="scanner-body">
                {events.length > 1 && (
                  <div className="scanner-event-select">
                    <label htmlFor="scan-event">المناسبة الحالية للمسح:</label>
                    <select
                      id="scan-event"
                      value={scanEventId || events[0]?.id}
                      onChange={(changeEvent) => {
                        const value = Number(changeEvent.target.value);
                        setScanEventId(value);
                        scanEventRef.current = value;
                        setScanResult(null);
                        setScannerError('');
                      }}
                    >
                      {events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.title} ({event.confirmed_count ?? 0} مؤكد)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="scanner-mode-tabs" role="tablist" aria-label="طريقة قراءة الرمز">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scanMode === 'camera'}
                    className="scanner-mode-btn"
                    data-active={scanMode === 'camera'}
                    onClick={() => {
                      setScanMode('camera');
                      setScanResult(null);
                      setScannerError('');
                      processingRef.current = false;
                    }}
                  >
                    <IconCamera size={18} /> كاميرا الجوال
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scanMode === 'manual'}
                    className="scanner-mode-btn"
                    data-active={scanMode === 'manual'}
                    onClick={() => {
                      setScanMode('manual');
                      stopCamera();
                    }}
                  >
                    <IconKeyboard size={18} />
                    <span>إدخال يدوي</span>
                  </button>
                </div>

                {scanMode === 'camera' && !scanResult && (
                  <div className="scanner-viewport-wrap">
                    <div className="scanner-viewport">
                      <video ref={videoRef} className="scanner-video" muted playsInline />
                      <canvas ref={canvasRef} style={{ display: 'none' }} />
                      {cameraState === 'ready' ? (
                        <div className="scanner-overlay">
                          <div className="scanner-frame">
                            <div className="scanner-laser" />
                            <span className="scanner-corner scanner-corner--tl" />
                            <span className="scanner-corner scanner-corner--tr" />
                            <span className="scanner-corner scanner-corner--bl" />
                            <span className="scanner-corner scanner-corner--br" />
                          </div>
                          <p className="scanner-tip">وجّه الكاميرا نحو رمز QR على جوال الضيف أو تذكرته</p>
                        </div>
                      ) : (
                        <div className="scanner-placeholder">
                          {cameraState === 'starting' ? (
                            <>
                              <span className="scanner-spinner" />
                              <p>جارٍ تشغيل الكاميرا...</p>
                            </>
                          ) : (
                            <>
                              <IconCamera size={34} />
                              <p>الكاميرا متوقفة</p>
                              <button type="button" className="btn btn--secondary btn--sm" onClick={startCamera}>
                                تشغيل الكاميرا
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {scanBusy && <div className="scanner-loading">جارٍ قراءة الرمز وتأكيد الدخول...</div>}
                  </div>
                )}

                {scanMode === 'camera' && !scanResult && (
                  <div className="scanner-file-row">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileScan}
                      hidden
                    />
                    <button
                      type="button"
                      className="btn btn--ghost btn--block"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={scanBusy}
                    >
                      <IconQr size={18} />
                      <span>رفع صورة رمز QR بدل الكاميرا</span>
                    </button>
                    <p className="scanner-help">
                      يمكنك تصوير شاشة الضيف أو رفع صورة التذكرة، وسنتحقق من الرمز مباشرة.
                    </p>
                  </div>
                )}

                {scanMode === 'manual' && !scanResult && (
                  <form onSubmit={handleManualCheckIn} className="scanner-manual-form">
                    <div className="field">
                      <label htmlFor="manual-code">رمز الدخول أو رقم QR الخاص بالضيف:</label>
                      <div className="field__box" dir="ltr">
                        <input
                          id="manual-code"
                          required
                          placeholder="MA5SOS:TICKET:QR-..."
                          value={manualCode}
                          onChange={(changeEvent) => setManualCode(changeEvent.target.value)}
                          autoComplete="off"
                          spellCheck="false"
                        />
                      </div>
                      <p className="field__hint">
                        يمكنك أيضًا رفع صورة الرمز من تبويب الكاميرا إذا كان الرمز على شاشة أخرى.
                      </p>
                    </div>
                    <button type="submit" className="btn btn--primary btn--block" disabled={scanBusy}>
                      {scanBusy ? 'جارٍ التحقق...' : 'تأكيد دخول الضيف'}
                    </button>
                  </form>
                )}

                {scannerError && (
                  <div className="scanner-error-card" role="alert">
                    <IconAlert size={20} />
                    <div>
                      <p>{scannerError}</p>
                      <button type="button" className="scanner-retry-btn" onClick={resetScanner}>
                        {scanMode === 'camera' ? 'إعادة تشغيل الكاميرا' : 'محاولة أخرى'}
                      </button>
                    </div>
                  </div>
                )}

                {scanResult && (
                  <div
                    className={`scanner-result-card ${
                      scanResult.already_checked_in ? 'scanner-result-card--warn' : 'scanner-result-card--success'
                    }`}
                  >
                    <div className="scanner-result-icon">
                      {scanResult.already_checked_in ? <IconNote size={32} /> : <IconCheck size={36} />}
                    </div>
                    <span className="scanner-result-status">
                      {scanResult.already_checked_in ? 'تم الدخول مسبقًا' : 'تم تأكيد الدخول بنجاح'}
                    </span>
                    <h3 className="scanner-result-name">{scanResult.guest_name}</h3>
                    {scanResult.phone && <p className="scanner-result-phone" dir="ltr">{prettyPhone(scanResult.phone)}</p>}
                    <p className="scanner-result-companions">
                      {scanResult.companions_count > 0
                        ? `مع ${scanResult.companions_count} مرافقين`
                        : 'بدون مرافقين'}
                    </p>
                    <p className="scanner-result-msg">{scanResult.message}</p>
                    {scanResult.checked_in_at && (
                      <small className="scanner-result-time">
                        وقت التسجيل: {formatTime(scanResult.checked_in_at)}
                      </small>
                    )}
                    <button type="button" className="btn btn--primary btn--block scanner-next-btn" onClick={resetScanner}>
                      مسح ضيف آخر
                    </button>
                  </div>
                )}

                <p className="scanner-note">
                  تُقبل فقط تذاكر مخصوص الصادرة من هذه المنصة. أي رمز آخر (خرائط، واتساب، بطاقة متجر...) سيُرفض
                  تلقائيًا.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upgrade */}
        {upgradeOpen && (
          <div className="admin-modal-backdrop" onClick={() => setUpgradeOpen(false)}>
            <div className="admin-modal admin-modal--upgrade" onClick={(clickEvent) => clickEvent.stopPropagation()}>
              <div className="admin-modal__head">
                <div>
                  <span className="pill pill--gold">باقات مخصوص</span>
                  <h2>{isTrial ? 'وسّع مناسبتك مع باقة مخصوص' : 'اختر الباقة المناسبة'}</h2>
                </div>
                <button type="button" className="icon-btn" onClick={() => setUpgradeOpen(false)} aria-label="إغلاق">
                  <IconClose size={20} />
                </button>
              </div>

              <div className="upgrade-modal__body">
                <p className="upgrade-modal__intro">
                  {isTrial ? (
                    <>
                      التجربة المجانية تتيح <strong>مناسبة واحدة</strong> وحتى <strong>{TRIAL.maxGuests} مدعوين</strong>.
                      اختر إحدى الباقات لمزيد من المدعوين والمزايا الكاملة.
                    </>
                  ) : (
                    <>كل باقة تمنحك دعوات إلكترونية أنيقة مع متابعة الردود وتذاكر QR للضيوف.</>
                  )}
                </p>

                <div className="upgrade-cards-grid">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      className={`upgrade-card${plan.recommended ? ' upgrade-card--featured' : ''}`}
                    >
                      {plan.recommended && <span className="upgrade-card__badge">الموصى بها</span>}
                      <span className="upgrade-card__num">{plan.index}</span>
                      <h4 className="upgrade-card__title">{plan.name}</h4>
                      <p className="upgrade-card__target">{plan.tagline}</p>
                      <div className="upgrade-card__price">
                        <strong>{plan.price}</strong>
                        <span>ريال</span>
                      </div>
                      <ul className="upgrade-card__list">
                        {plan.features.slice(0, 6).map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                      <a
                        className={`btn btn--block btn--sm ${plan.recommended ? 'btn--primary' : 'btn--secondary'}`}
                        href={`/packages/?plan=${plan.id}`}
                      >
                        اختر الباقة ({plan.price} ر.س)
                      </a>
                    </div>
                  ))}
                </div>

                <div className="upgrade-modal__foot">
                  <a href="/packages/" className="btn btn--primary">
                    عرض الباقات والترقية
                  </a>
                  <button type="button" className="btn btn--ghost" onClick={() => setUpgradeOpen(false)}>
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {deleteModal.open && deleteModal.event && (
          <div className="admin-modal-backdrop" onClick={() => setDeleteModal({ open: false, event: null })}>
            <div className="admin-modal admin-modal--small" onClick={(clickEvent) => clickEvent.stopPropagation()}>
              <div className="admin-modal__head">
                <h2>تأكيد حذف المناسبة</h2>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setDeleteModal({ open: false, event: null })}
                  aria-label="إغلاق"
                >
                  <IconClose size={20} />
                </button>
              </div>

              <div className="admin-modal__content">
                <p>
                  هل أنت متأكد من حذف المناسبة: <strong>«{deleteModal.event.title}»</strong>؟
                </p>
                <p className="admin-alert admin-alert--warning">
                  <IconAlert size={18} />
                  <span>
                    سيؤدي هذا الإجراء إلى حذف بيانات المناسبة وجميع ردود المدعوين ورموز QR المرتبطة بها نهائيًا.
                  </span>
                </p>
              </div>

              <div className="admin-modal__actions">
                <button type="button" className="btn btn--danger" onClick={handleDeleteEvent} disabled={modalBusy}>
                  {modalBusy ? 'جارٍ الحذف...' : 'نعم، احذف المناسبة'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setDeleteModal({ open: false, event: null })}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
