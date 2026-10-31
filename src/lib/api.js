/*
 * Talks to the site's own server (/api). Errors carry one Arabic sentence that
 * can be shown to the visitor as it is. FastAPI may answer with `detail` as a
 * string, a list of validation errors, or (rarely) an object, so all three
 * shapes are turned into readable Arabic here instead of leaking English.
 */

const FIELD_LABELS = {
  name: 'الاسم',
  phone: 'رقم الجوال',
  email: 'البريد الإلكتروني',
  password: 'كلمة المرور',
  guest_name: 'اسم الضيف',
  companions_count: 'عدد المرافقين',
  event_date: 'تاريخ المناسبة',
  event_time: 'وقت المناسبة',
  venue_name: 'مكان المناسبة',
  title: 'عنوان المناسبة',
  host_name: 'اسم الداعي',
  max_guests: 'عدد المدعوين',
  planId: 'الباقة',
  qr_token: 'رمز الدخول',
};

const STATUS_MESSAGES = {
  401: 'انتهت جلسة الدخول أو أنت غير مسجّل. يرجى تسجيل الدخول من جديد.',
  403: 'لا تملك صلاحية لتنفيذ هذا الإجراء.',
  404: 'لم يتم العثور على البيانات المطلوبة.',
  409: 'هذه البيانات مسجّلة بالفعل.',
  422: 'بعض البيانات المدخلة غير صحيحة. يرجى مراجعتها والمحاولة ثانية.',
  429: 'عدد المحاولات كبير. يرجى الانتظار قليلًا ثم المحاولة.',
  500: 'حدث خطأ غير متوقع في الخادم. يرجى المحاولة بعد قليل.',
  502: 'تعذّر الاتصال بخدمة الدفع. يرجى المحاولة بعد قليل.',
  503: 'الخدمة غير متاحة حاليًا. يرجى المحاولة بعد قليل.',
};

function validationMessage(item) {
  if (!item || typeof item !== 'object') return '';
  const location = Array.isArray(item.loc) ? item.loc.filter((part) => !['body', 'query', 'path'].includes(part)) : [];
  const field = location.length ? location[location.length - 1] : '';
  const label = FIELD_LABELS[field] || '';
  const raw = String(item.msg || '').trim();

  let readable = raw;
  if (/field required/i.test(raw)) readable = 'مطلوب';
  else if (/at least (\d+) character/i.test(raw)) {
    const count = raw.match(/at least (\d+) character/i)?.[1];
    readable = `يجب ألا يقل عن ${count} أحرف`;
  } else if (/valid datetime/i.test(raw)) readable = 'صيغة التاريخ غير صحيحة';
  else if (/valid integer/i.test(raw)) readable = 'يجب أن يكون رقمًا صحيحًا';
  else if (/valid string/i.test(raw)) readable = 'يجب أن يكون نصًا';
  else if (/greater than or equal to (\d+)/i.test(raw)) {
    const count = raw.match(/greater than or equal to (\d+)/i)?.[1];
    readable = `يجب ألا يقل عن ${count}`;
  } else if (/less than or equal to (\d+)/i.test(raw)) {
    const count = raw.match(/less than or equal to (\d+)/i)?.[1];
    readable = `يجب ألا يزيد عن ${count}`;
  } else if (/valid (email|url)/i.test(raw)) readable = 'الصيغة غير صحيحة';

  if (label) return `${label}: ${readable}`;
  return readable;
}

export function formatApiDetail(detail) {
  if (typeof detail === 'string') return detail.trim() || null;

  if (Array.isArray(detail)) {
    const messages = detail
      .map(validationMessage)
      .filter(Boolean)
      .slice(0, 3);
    return messages.length ? messages.join(' · ') : null;
  }

  if (detail && typeof detail === 'object') {
    return formatApiDetail(detail.message ?? detail.detail ?? detail.error ?? null);
  }

  return null;
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getStoredToken() {
  try {
    return localStorage.getItem('ma5sos_access_token') || localStorage.getItem('mazom_access_token');
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem('ma5sos_access_token', token);
      localStorage.setItem('mazom_access_token', token);
    }
  } catch {
    /* ignore storage errors */
  }
}

export function clearStoredToken() {
  try {
    localStorage.removeItem('ma5sos_access_token');
    localStorage.removeItem('mazom_access_token');
  } catch {
    /* ignore storage errors */
  }
}

export async function api(path, { method = 'GET', body, headers: extraHeaders } = {}) {
  let response;
  try {
    const token = getStoredToken();
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      'network',
      'تعذّر الاتصال بالخادم. تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى.',
    );
  }

  const text = await response.text().catch(() => '');
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      formatApiDetail(data?.message) ||
      formatApiDetail(data?.detail) ||
      formatApiDetail(data?.error) ||
      STATUS_MESSAGES[response.status] ||
      `تعذّر إكمال الطلب (رمز ${response.status}). يرجى المحاولة ثانية.`;
    throw new ApiError(response.status, data?.error ?? data?.code ?? 'server', message);
  }

  return data;
}
