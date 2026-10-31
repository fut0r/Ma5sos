import { useEffect, useState } from 'react';
import { IconAlert, IconCheck, IconClock, IconClose } from './ui/Icons.jsx';
import { PACKAGES_COPY, PAYMENT_COPY } from '../data/account.js';
import { LINKS } from '../data/content.js';
import { PLANS, TRIAL } from '../data/plans.js';
import { api } from '../lib/api.js';
import './PaymentPage.css';

const planName = (id) =>
  [...PLANS, TRIAL].find((plan) => plan.id === id || (plan.legacyId && plan.legacyId === id))?.name ?? id;

// Paylink returns the visitor here with ?TransactionNo=…&OrderNumber=…
function readParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    orderNumber: params.get('OrderNumber') || params.get('order') || '',
    cancelled: params.has('cancelled') || params.get('status') === 'canceled',
  };
}

const POLL_MS = 2800;
const POLL_TRIES = 6;

const goToLogin = () => {
  const here = window.location.pathname + window.location.search;
  window.location.replace(`${LINKS.login}?next=${encodeURIComponent(here)}`);
};

/**
 * Where Paylink sends the visitor back. The page asks the server, which asks
 * Paylink, so what it shows is Paylink's word and not the address bar's.
 */
export default function PaymentPage() {
  const [{ orderNumber, cancelled }] = useState(readParams);
  const [state, setState] = useState(orderNumber ? 'checking' : 'missing');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!orderNumber) {
      setState('missing');
      return undefined;
    }

    let stopped = false;
    let timer;

    const check = async (tries) => {
      try {
        const data = await api(`/orders/${encodeURIComponent(orderNumber)}`);
        if (stopped) return;
        const current = data?.order;
        setOrder(current);
        setError('');
        const status = current?.status;

        if (status === 'paid') {
          setState('paid');
          return;
        }

        if (status === 'pending' && !cancelled && tries > 1) {
          timer = setTimeout(() => check(tries - 1), POLL_MS);
          return;
        }

        if (status === 'pending') {
          setState(cancelled ? 'canceled' : 'pending');
          return;
        }

        if (status === 'canceled') {
          setState('canceled');
          return;
        }

        setState(status || 'missing');
      } catch (problem) {
        if (stopped) return;
        if (problem.status === 401) {
          goToLogin();
          return;
        }
        if (problem.status === 404) {
          setState('missing');
          setError('لم نجد هذا الطلب في حسابك. تأكد من فتح رابط العودة الصحيح أو ابدأ عملية دفع جديدة.');
          return;
        }
        setState('error');
        setError(problem.message || PAYMENT_COPY.error);
      }
    };

    setState('checking');
    check(POLL_TRIES);

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [orderNumber, cancelled, round]);

  const copy = PAYMENT_COPY[state] ?? PAYMENT_COPY.missing;
  const Icon = state === 'paid' ? IconCheck : state === 'canceled' || state === 'error' ? IconClose : IconClock;

  return (
    <section className="payresult" aria-labelledby="payresult-title">
      <div className="wrap">
        <div className={`payresult__card payresult__card--${state}`}>
          <span className="payresult__icon" aria-hidden="true">
            {state === 'checking' ? <span className="payresult__spinner" /> : <Icon size={34} />}
          </span>

          <p className="head__eyebrow">{PAYMENT_COPY.eyebrow}</p>
          <h1 className="payresult__title" id="payresult-title" aria-live="polite">
            {copy.title}
          </h1>
          <p className="payresult__text">{copy.text}</p>

          {state === 'checking' && (
            <div className="payresult__checking" role="status">
              <span className="payresult__dot" />
              <span>جارٍ التحقق مع Paylink…</span>
            </div>
          )}

          {error && (
            <div className="payresult__error" role="alert">
              <IconAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          {order && (
            <dl className="payresult__details">
              <div>
                <dt>{PAYMENT_COPY.plan}</dt>
                <dd>{planName(order.planId)}</dd>
              </div>
              <div>
                <dt>{PAYMENT_COPY.amount}</dt>
                <dd>
                  {order.amount} {PACKAGES_COPY.currency}
                </dd>
              </div>
              <div>
                <dt>{PAYMENT_COPY.order}</dt>
                <dd dir="ltr">{order.orderNumber}</dd>
              </div>
              <div>
                <dt>حالة الطلب</dt>
                <dd>{PAYMENT_COPY.statuses[order.status] || order.status}</dd>
              </div>
            </dl>
          )}

          {state === 'paid' && (
            <p className="payresult__note">
              <IconCheck size={18} />
              <span>تم تفعيل باقتك على حسابك. يمكنك الآن إنشاء مناسبتك الأولى ومشاركة دعوتها مع الضيوف.</span>
            </p>
          )}

          <div className="payresult__actions">
            {state === 'pending' && (
              <button type="button" className="btn btn--primary" onClick={() => setRound((count) => count + 1)}>
                {PAYMENT_COPY.refresh}
              </button>
            )}

            {state === 'error' && (
              <button type="button" className="btn btn--primary" onClick={() => setRound((count) => count + 1)}>
                إعادة المحاولة
              </button>
            )}

            {(state === 'canceled' || state === 'pending') && (
              <a className="btn btn--ghost" href={`${LINKS.create}?plan=${order?.planId ?? ''}`}>
                {PAYMENT_COPY.retry}
              </a>
            )}

            {state === 'paid' && (
              <>
                <a className="btn btn--primary" href="/admin/">
                  الانتقال إلى لوحة التحكم وإنشاء مناسبتك
                </a>
                <a className="btn btn--ghost" href={LINKS.create}>
                  {PAYMENT_COPY.packages}
                </a>
              </>
            )}

            {(state === 'missing' || state === 'canceled' || state === 'error') && (
              <a className="btn btn--ghost" href={LINKS.create}>
                {PAYMENT_COPY.packages}
              </a>
            )}

            {state !== 'checking' && state !== 'paid' && (
              <a className="btn btn--ghost" href="/">
                {PAYMENT_COPY.home}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
