import { useEffect, useRef, useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { Emblem } from './ui/Brand.jsx';
import { IconEye, IconEyeOff } from './ui/Icons.jsx';
import { AUTH_COPY } from '../data/account.js';
import { HERO, LINKS } from '../data/content.js';
import { api, setStoredToken } from '../lib/api.js';
import { firebaseAuth } from '../lib/firebase.js';
import { normalizeSaudiMobile } from '../lib/phone.js';
import { safeNext, setSignedIn, useSession } from '../lib/session.js';
import './AuthPage.css';

const MODES = ['login', 'signup'];
const OTP_LENGTH = 6;

const FIREBASE_ERRORS = {
  'auth/invalid-phone-number': 'رقم الجوال غير صحيح. تأكد من كتابته بالصيغة 05XXXXXXXX.',
  'auth/too-many-requests': 'محاولات كثيرة على هذا الرقم. انتظر قليلًا ثم أعد المحاولة.',
  'auth/quota-exceeded': 'تم تجاوز حد إرسال الرسائل مؤقتًا. حاول لاحقًا.',
  'auth/captcha-check-failed': 'فشل التحقق الأمني. أعد تحميل الصفحة وحاول مرة أخرى.',
  'auth/unauthorized-domain': 'هذا النطاق غير مصرّح به في Firebase. أضف نطاق موقعك إلى Authorized domains.',
  'auth/operation-not-allowed': 'تسجيل الدخول برمز الهاتف غير مفعّل في Firebase. فعّل Phone من Sign-in method.',
  'auth/billing-not-enabled': 'إرسال رسائل Firebase يحتاج تفعيل الفوترة في مشروع Firebase.',
  'auth/invalid-verification-code': 'رمز التحقق غير صحيح. راجع الرمز وحاول مرة أخرى.',
  'auth/code-expired': 'انتهت صلاحية الرمز. أرسل رمزًا جديدًا.',
  'auth/missing-verification-code': 'أدخل رمز التحقق أولًا.',
  'auth/invalid-verification-id': 'انتهت جلسة التحقق. أرسل رمزًا جديدًا.',
  'auth/network-request-failed': 'تعذّر الاتصال بخدمة التحقق. تأكد من الإنترنت وحاول مرة أخرى.',
  'auth/app-not-authorized': 'مفتاح Firebase غير مصرّح لهذا النطاق. راجع إعدادات Google Cloud.',
  'auth/web-storage-unsupported': 'متصفحك يمنع التخزين المطلوب للتحقق. جرّب متصفحًا آخر.',
  'auth/internal-error': 'حدث خطأ داخلي في خدمة التحقق. أعد المحاولة بعد قليل.',
};

function firebaseErrorMessage(error) {
  return (
    FIREBASE_ERRORS[String(error?.code || '')] ||
    'تعذّر إرسال أو تأكيد رمز التحقق. تحقق من الرقم وحاول مرة أخرى.'
  );
}

function readParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    mode: params.get('mode') === 'signup' ? 'signup' : 'login',
    next: safeNext(params.get('next')),
  };
}

function PasswordField({ id, label, hint, value, onChange, autoComplete, error }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__box field__box--password">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          dir="ltr"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          className="field__toggle"
          onClick={() => setVisible((shown) => !shown)}
          aria-label={visible ? AUTH_COPY.fields.hidePassword : AUTH_COPY.fields.showPassword}
          aria-pressed={visible}
        >
          {visible ? <IconEyeOff size={20} /> : <IconEye size={20} />}
        </button>
      </div>
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="field__hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/**
 * Sign-in and sign-up. The default path is a Saudi mobile number plus an SMS
 * code sent by Firebase; the password path stays available for the existing
 * administrator account. On success the visitor goes to ?next=.
 */
export default function AuthPage() {
  const [{ mode: startMode, next }] = useState(readParams);
  const [mode, setMode] = useState(startMode);
  const [method, setMethod] = useState('otp');
  const [form, setForm] = useState({ name: '', phone: '', password: '', confirm: '', consent: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const recaptchaRef = useRef(null);
  const session = useSession();
  const copy = AUTH_COPY.modes[mode];
  const signup = mode === 'signup';

  useEffect(
    () => () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    },
    [],
  );

  const set = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const resetOtp = () => {
    setOtp('');
    setOtpSent(false);
    setOtpError('');
    setConfirmation(null);
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrors({});
    setFormError('');
    resetOtp();
    const url = new URL(window.location.href);
    if (nextMode === 'signup') url.searchParams.set('mode', 'signup');
    else url.searchParams.delete('mode');
    window.history.replaceState(null, '', url);
  };

  const switchMethod = (nextMethod) => {
    if (nextMethod === method) return;
    setMethod(nextMethod);
    setErrors({});
    setFormError('');
    resetOtp();
  };

  const onTabKey = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const other = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    switchMode(other);
    document.getElementById(`auth-tab-${other}`)?.focus();
  };

  const validateOtp = () => {
    const found = {};
    if (signup && form.name.trim().length < 2) found.name = AUTH_COPY.errors.name;
    if (!normalizeSaudiMobile(form.phone)) found.phone = AUTH_COPY.errors.phone;
    if (signup && !form.consent) found.consent = AUTH_COPY.errors.consent;
    return found;
  };

  const validatePassword = () => {
    const found = validateOtp();
    if (form.password.length < 8) found.password = AUTH_COPY.errors.password;
    if (signup && form.confirm !== form.password) found.confirm = AUTH_COPY.errors.confirm;
    return found;
  };

  const focusFirstError = (found) => {
    const field = Object.keys(found)[0];
    document.getElementById(`auth-${field}`)?.focus();
  };

  const sendOtp = async () => {
    setFormError('');
    setOtpError('');
    const found = validateOtp();
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstError(found);
      return;
    }

    setOtpBusy(true);
    try {
      const phone = normalizeSaudiMobile(form.phone);
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
          size: 'invisible',
        });
      }
      const result = await signInWithPhoneNumber(firebaseAuth, phone, recaptchaRef.current);
      setConfirmation(result);
      setOtpSent(true);
      setOtp('');
    } catch (error) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setOtpError(firebaseErrorMessage(error));
    } finally {
      setOtpBusy(false);
    }
  };

  const resendOtp = async () => {
    resetOtp();
    await sendOtp();
  };

  const confirmOtp = async (event) => {
    event.preventDefault();
    const code = otp.trim();
    if (code.length !== OTP_LENGTH) {
      setOtpError(`أدخل الرمز المكوّن من ${OTP_LENGTH} أرقام.`);
      return;
    }
    if (!confirmation) {
      setOtpError('انتهت جلسة التحقق. أرسل رمزًا جديدًا.');
      return;
    }

    setOtpBusy(true);
    setOtpError('');
    try {
      const credential = await confirmation.confirm(code);
      const idToken = await credential.user.getIdToken(true);
      const { user, access_token } = await api('/auth/firebase', {
        method: 'POST',
        body: { idToken, name: signup ? form.name : undefined },
      });
      if (access_token) setStoredToken(access_token);
      setSignedIn(user);
      window.location.assign(next);
    } catch (error) {
      if (String(error?.code || '').startsWith('auth/')) setOtpError(firebaseErrorMessage(error));
      else setOtpError(error.message || AUTH_COPY.errors.network);
      setOtpBusy(false);
    }
  };

  const onPasswordSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    const found = validatePassword();
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstError(found);
      return;
    }

    setBusy(true);
    try {
      const body = signup
        ? { name: form.name, phone: form.phone, password: form.password }
        : { phone: form.phone, password: form.password };
      const { user, access_token } = await api(signup ? '/auth/register' : '/auth/login', { method: 'POST', body });
      if (access_token) setStoredToken(access_token);
      setSignedIn(user);
      window.location.assign(next);
    } catch (error) {
      setFormError(error.message || AUTH_COPY.errors.network);
      setBusy(false);
    }
  };

  const onFormSubmit = (event) => {
    if (method === 'otp') {
      if (otpSent) {
        confirmOtp(event);
      } else {
        event.preventDefault();
        sendOtp();
      }
      return;
    }
    onPasswordSubmit(event);
  };

  return (
    <section className="auth" aria-labelledby="auth-title">
      <div className="wrap auth__grid">
        <div className="auth__panel">
          <p className="head__eyebrow">{AUTH_COPY.eyebrow}</p>
          <h1 className="auth__title" id="auth-title">
            {copy.title}
          </h1>
          <p className="auth__lead">{copy.lead}</p>

          {session.status === 'user' ? (
            <div className="auth__signed">
              <p>
                {AUTH_COPY.signedInAs} <strong>{session.user.name}</strong>
              </p>
              <a className="btn btn--primary btn--block" href={next}>
                {AUTH_COPY.continue}
              </a>
            </div>
          ) : (
            <>
              <div className="auth__tabs" role="tablist" aria-label={AUTH_COPY.eyebrow} onKeyDown={onTabKey}>
                {MODES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="tab"
                    id={`auth-tab-${name}`}
                    aria-selected={mode === name}
                    aria-controls="auth-form"
                    tabIndex={mode === name ? 0 : -1}
                    onClick={() => switchMode(name)}
                  >
                    {AUTH_COPY.modes[name].tab}
                  </button>
                ))}
              </div>

              <div className="auth__methods" role="group" aria-label="طريقة الدخول">
                <button
                  type="button"
                  className={method === 'otp' ? 'is-active' : undefined}
                  aria-pressed={method === 'otp'}
                  onClick={() => switchMethod('otp')}
                >
                  رمز الهاتف
                </button>
                <button
                  type="button"
                  className={method === 'password' ? 'is-active' : undefined}
                  aria-pressed={method === 'password'}
                  onClick={() => switchMethod('password')}
                >
                  كلمة المرور
                </button>
              </div>

              <form
                className="auth__form"
                id="auth-form"
                role="tabpanel"
                aria-labelledby={`auth-tab-${mode}`}
                onSubmit={onFormSubmit}
                noValidate
              >
                {signup && (
                  <div className="field">
                    <label htmlFor="auth-name">{AUTH_COPY.fields.name}</label>
                    <div className="field__box">
                      <input
                        id="auth-name"
                        value={form.name}
                        onChange={(event) => set('name')(event.target.value)}
                        autoComplete="name"
                        placeholder={AUTH_COPY.fields.namePlaceholder}
                        maxLength={60}
                        aria-invalid={errors.name ? 'true' : undefined}
                        aria-describedby={errors.name ? 'auth-name-error' : undefined}
                      />
                    </div>
                    {errors.name && (
                      <p className="field__error" id="auth-name-error">
                        {errors.name}
                      </p>
                    )}
                  </div>
                )}

                <div className="field">
                  <label htmlFor="auth-phone">{AUTH_COPY.fields.phone}</label>
                  <div className="field__box field__box--phone" dir="ltr">
                    <span className="field__prefix">+966</span>
                    <input
                      id="auth-phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={form.phone}
                      onChange={(event) => set('phone')(event.target.value)}
                      placeholder={AUTH_COPY.fields.phonePlaceholder}
                      maxLength={16}
                      disabled={method === 'otp' && otpSent}
                      aria-invalid={errors.phone ? 'true' : undefined}
                      aria-describedby={errors.phone ? 'auth-phone-error' : undefined}
                    />
                  </div>
                  {errors.phone && (
                    <p className="field__error" id="auth-phone-error">
                      {errors.phone}
                    </p>
                  )}
                  {method === 'otp' && otpSent && (
                    <p className="field__hint">
                      تم إرسال الرمز إلى {normalizeSaudiMobile(form.phone) || form.phone}
                    </p>
                  )}
                </div>

                {signup && (
                  <div className="field">
                    <label className="check" htmlFor="auth-consent">
                      <input
                        id="auth-consent"
                        type="checkbox"
                        checked={form.consent}
                        onChange={(event) => set('consent')(event.target.checked)}
                        aria-invalid={errors.consent ? 'true' : undefined}
                        aria-describedby={errors.consent ? 'auth-consent-error' : undefined}
                      />
                      <span>
                        {AUTH_COPY.consent[0]}{' '}
                        <a href={LINKS.terms} target="_blank" rel="noreferrer">
                          {AUTH_COPY.consent[1]}
                        </a>{' '}
                        {AUTH_COPY.consent[2]}
                        <a href={LINKS.privacy} target="_blank" rel="noreferrer">
                          {AUTH_COPY.consent[3]}
                        </a>
                      </span>
                    </label>
                    {errors.consent && (
                      <p className="field__error" id="auth-consent-error">
                        {errors.consent}
                      </p>
                    )}
                  </div>
                )}

                {method === 'otp' ? (
                  <>
                    {!otpSent ? (
                      <div className="auth__otp-cta">
                        <button
                          type="button"
                          className="btn btn--primary btn--block"
                          onClick={sendOtp}
                          disabled={otpBusy}
                        >
                          {otpBusy ? 'جارٍ إرسال الرمز…' : 'إرسال رمز التحقق'}
                        </button>
                        <p className="auth__hint">
                          سنرسل رمزًا مكوّنًا من 6 أرقام إلى جوالك عبر رسالة SMS.
                        </p>
                      </div>
                    ) : (
                      <div className="auth__otp">
                        <div className="field">
                          <label htmlFor="auth-otp">رمز التحقق</label>
                          <div className="field__box field__box--otp" dir="ltr">
                            <input
                              id="auth-otp"
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              value={otp}
                              onChange={(event) =>
                                setOtp(event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))
                              }
                              placeholder="000000"
                              maxLength={OTP_LENGTH}
                              aria-invalid={otpError ? 'true' : undefined}
                              aria-describedby={otpError ? 'auth-otp-error' : undefined}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn--primary btn--block"
                          onClick={confirmOtp}
                          disabled={otpBusy}
                        >
                          {otpBusy ? 'جارٍ التحقق…' : 'تأكيد الرمز'}
                        </button>

                        <div className="auth__otp-links">
                          <button type="button" onClick={resendOtp} disabled={otpBusy}>
                            إعادة إرسال الرمز
                          </button>
                          <button type="button" onClick={resetOtp} disabled={otpBusy}>
                            تغيير الرقم
                          </button>
                        </div>
                      </div>
                    )}
                    {otpError && (
                      <p className="auth__error" id="auth-otp-error" role="alert">
                        {otpError}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <PasswordField
                      id="auth-password"
                      label={AUTH_COPY.fields.password}
                      hint={signup ? AUTH_COPY.fields.passwordHint : null}
                      value={form.password}
                      onChange={set('password')}
                      autoComplete={signup ? 'new-password' : 'current-password'}
                      error={errors.password}
                    />

                    {signup && (
                      <PasswordField
                        id="auth-confirm"
                        label={AUTH_COPY.fields.confirm}
                        value={form.confirm}
                        onChange={set('confirm')}
                        autoComplete="new-password"
                        error={errors.confirm}
                      />
                    )}
                  </>
                )}

                <p className="auth__error" role="alert">
                  {formError}
                </p>

                {method === 'password' && (
                  <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
                    {busy ? AUTH_COPY.busy : copy.submit}
                  </button>
                )}

                <div id="recaptcha-container" />

                <p className="auth__switch">
                  {copy.switchText}{' '}
                  <button type="button" onClick={() => switchMode(signup ? 'login' : 'signup')}>
                    {copy.switchLink}
                  </button>
                </p>
              </form>
            </>
          )}
        </div>

        <aside className="auth__side brand-surface" aria-hidden="true">
          <Emblem large alt="" />
          <p className="auth__side-title">{AUTH_COPY.side.title}</p>
          <p className="auth__side-text">{AUTH_COPY.side.text}</p>
          <ul className="auth__facts">
            {HERO.facts.map(({ icon: Icon, label }) => (
              <li key={label}>
                <span className="tile">
                  <Icon />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
