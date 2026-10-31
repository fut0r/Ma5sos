import { useEffect, useState } from 'react';
import { IconAlert, IconCheck, IconGift, IconLogout, IconShield, IconStar } from './ui/Icons.jsx';
import { ACCOUNT_COPY, PACKAGES_COPY } from '../data/account.js';
import { LINKS, PRICING } from '../data/content.js';
import { PLANS, TRIAL } from '../data/plans.js';
import { api } from '../lib/api.js';
import { signOut, useSession } from '../lib/session.js';
import './PackagesPage.css';

const OPTIONS = [...PLANS, TRIAL];
const byId = (id) => OPTIONS.find((plan) => plan.id === id || (plan.legacyId && plan.legacyId === id));

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'بك';
}

function startingPlan() {
  const params = new URLSearchParams(window.location.search);
  const wanted = params.get('plan');
  const template = params.get('template');
  if (template) {
    try {
      localStorage.setItem('ma5sos_selected_template', template);
    } catch {
      /* ignore */
    }
  }
  return byId(wanted)?.id ?? PLANS.find((plan) => plan.recommended)?.id ?? PLANS[0].id;
}

const goToLogin = () => {
  const here = window.location.pathname + window.location.search;
  window.location.replace(`${LINKS.login}?next=${encodeURIComponent(here)}`);
};

/**
 * "Choose your package": the packages as a list to pick from, a summary of the
 * chosen one, and the button that opens Paylink's payment page (or starts the
 * free trial). Visitors who are not signed in are sent to sign in first.
 */
export default function PackagesPage() {
  const session = useSession();
  const [selected, setSelected] = useState(startingPlan);
  const [orders, setOrders] = useState(null);
  const [ordersError, setOrdersError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (session.status === 'guest') {
      goToLogin();
      return;
    }
    if (session.status !== 'user') return;

    let active = true;
    api('/orders')
      .then((data) => {
        if (active) setOrders(Array.isArray(data?.orders) ? data.orders : []);
      })
      .catch((problem) => {
        if (!active) return;
        setOrders([]);
        if (problem.status === 401) {
          goToLogin();
          return;
        }
        setOrdersError('تعذّر تحميل سجل طلباتك الآن. يمكنك اختيار باقتك والمتابعة، وسيتحقق الخادم من حالة التجربة.');
      });
    return () => {
      active = false;
    };
  }, [session.status]);

  if (session.status !== 'user') {
    return (
      <section className="checkout">
        <p className="wrap checkout__loading">{PACKAGES_COPY.loading}</p>
      </section>
    );
  }

  const plan = byId(selected) || PLANS[0];
  const free = plan.price === 0;
  const paidUser = Boolean(session.user?.has_paid);
  const currentPlanId = byId(session.user?.plan_id)?.id || session.user?.plan_id;
  const trialUsed = orders?.some((order) => order.planId === TRIAL.id) ?? false;
  const owned = (orders ?? []).filter((order) => order.status === 'paid' && order.planId !== TRIAL.id);
  const alreadyOwned = !free && paidUser && currentPlanId === plan.id;
  const disabled = (free && (trialUsed || paidUser)) || alreadyOwned;

  const choose = (id) => {
    setSelected(id);
    setError('');
    setNotice('');
    const url = new URL(window.location.href);
    url.searchParams.set('plan', id);
    window.history.replaceState(null, '', url);
  };

  const checkout = async () => {
    if (disabled || busy) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const result = await api('/orders', { method: 'POST', body: { planId: plan.id } });

      if (result?.paymentUrl) {
        window.location.assign(result.paymentUrl);
        return;
      }

      if (!result?.trial && result?.status !== 'paid') {
        throw new Error('لم يصل رابط الدفع من الخادم. يرجى المحاولة مرة أخرى.');
      }

      setNotice(`${PACKAGES_COPY.trialStarted} جارٍ تحويلك إلى لوحة التحكم لإدارة مناسبتك...`);
      setOrders((previous) => [
        {
          orderNumber: result.orderNumber,
          planId: plan.id,
          amount: 0,
          status: 'paid',
        },
        ...(previous ?? []),
      ]);
      setTimeout(() => {
        window.location.assign('/admin/');
      }, 1400);
    } catch (problem) {
      if (problem.status === 401) {
        goToLogin();
        return;
      }
      if (problem.status === 409) {
        setOrders((previous) => previous ?? []);
      }
      setError(problem.message || PACKAGES_COPY.error);
      setBusy(false);
    }
  };

  const buttonLabel = alreadyOwned
    ? 'هذه الباقة مفعّلة على حسابك'
    : free && paidUser
      ? 'لديك باقة مفعّلة بالفعل'
      : free && trialUsed
        ? 'استخدمت التجربة المجانية من قبل'
        : busy
          ? PACKAGES_COPY.loading
          : free
            ? PACKAGES_COPY.startTrial
            : `${PACKAGES_COPY.pay} ${plan.price} ${PACKAGES_COPY.currency}`;

  return (
    <section className="checkout" aria-labelledby="checkout-title">
      <div className="wrap">
        <header className="checkout__head">
          <div>
            <p className="head__eyebrow">{PACKAGES_COPY.eyebrow}</p>
            <h1 className="checkout__title" id="checkout-title">
              {PACKAGES_COPY.greeting} {firstName(session.user?.name)}، {PACKAGES_COPY.title}
            </h1>
            <p className="checkout__lead">{PACKAGES_COPY.lead}</p>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => signOut('/')}>
            <IconLogout size={18} />
            {ACCOUNT_COPY.logout}
          </button>
        </header>

        {owned.length > 0 && (
          <div className="owned">
            <div className="owned__row">
              <div>
                <p className="owned__title">{PACKAGES_COPY.owned}</p>
                <ul>
                  {owned.map((order) => (
                    <li key={order.orderNumber}>
                      <IconCheck size={18} />
                      {byId(order.planId)?.name ?? order.planId}
                      <span className="pill">{PACKAGES_COPY.ownedStatus[order.status]}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a className="btn btn--primary btn--sm" href="/admin/">
                الانتقال إلى لوحة التحكم وإدارة مناسبتك
              </a>
            </div>
          </div>
        )}

        {ordersError && (
          <div className="checkout__banner" role="alert">
            <IconAlert size={18} />
            <span>{ordersError}</span>
          </div>
        )}

        <div className="checkout__grid">
          <div className="choices" role="radiogroup" aria-label={PACKAGES_COPY.choicesLabel}>
            {OPTIONS.map((option) => {
              const optionIsTrial = option.price === 0;
              const optionDisabled = optionIsTrial && (trialUsed || paidUser);
              return (
                <label
                  key={option.id}
                  className={`choice${option.surface ? ` choice--${option.surface}` : ''}${optionIsTrial ? ' choice--trial' : ''}`}
                  data-selected={selected === option.id}
                  data-disabled={optionDisabled || undefined}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={option.id}
                    checked={selected === option.id}
                    disabled={optionDisabled}
                    onChange={() => choose(option.id)}
                  />
                  <span className="choice__mark" aria-hidden="true" />
                  <span className="choice__main">
                    <span className="choice__name">
                      {optionIsTrial && <IconGift size={18} />}
                      {option.name}
                      {option.recommended && <IconStar className="choice__star" size={16} />}
                    </span>
                    <span className="choice__tagline">{option.tagline}</span>
                    <span className="choice__features">
                      {option.features.slice(0, 3).join(' · ')}
                      {option.features.length > 3 && ` ${PACKAGES_COPY.more}`}
                    </span>
                    {optionDisabled && (
                      <span className="choice__disabled-note">
                        {paidUser ? 'لديك باقة مفعّلة بالفعل' : 'استخدمت التجربة المجانية من قبل'}
                      </span>
                    )}
                  </span>
                  <span className="choice__price">
                    {optionIsTrial ? (
                      PACKAGES_COPY.free
                    ) : (
                      <>
                        <strong>{option.price}</strong> {PACKAGES_COPY.currency}
                      </>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          <aside className="summary" aria-labelledby="summary-title">
            <p className="summary__eyebrow" id="summary-title">
              {PACKAGES_COPY.summary}
            </p>
            <h2 className="summary__name">{plan.name}</h2>
            <p className="summary__tagline">{plan.tagline}</p>

            <ul className="summary__list">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <IconCheck size={18} />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="summary__total">
              <span>{PACKAGES_COPY.total}</span>
              <strong>{free ? PACKAGES_COPY.free : `${plan.price} ${PACKAGES_COPY.currency}`}</strong>
            </div>

            {alreadyOwned && (
              <p className="summary__note">
                <IconCheck size={18} />
                <span>هذه الباقة مفعّلة على حسابك، ويمكنك مباشرة إدارة مناسبتك من لوحة التحكم.</span>
              </p>
            )}

            {free && paidUser && (
              <p className="summary__note">
                <IconAlert size={18} />
                <span>لا تحتاج إلى التجربة المجانية لأن لديك باقة مفعّلة بالفعل.</span>
              </p>
            )}

            <p className="summary__error" role="alert">
              {error}
            </p>
            <div className="summary__notice" role="status">
              {notice && (
                <>
                  <p>{notice}</p>
                  <a className="btn btn--primary btn--sm" href="/admin/">
                    الانتقال إلى لوحة التحكم
                  </a>
                </>
              )}
            </div>

            <button type="button" className="btn btn--primary btn--block" onClick={checkout} disabled={busy || disabled}>
              {buttonLabel}
            </button>

            {alreadyOwned && (
              <a className="btn btn--ghost btn--block summary__admin-link" href="/admin/">
                الانتقال إلى لوحة التحكم
              </a>
            )}

            {!free && (
              <>
                <ul className="summary__methods" aria-label={PRICING.methodsLabel}>
                  {PRICING.methods.map((method) => (
                    <li key={method}>{method}</li>
                  ))}
                </ul>
                <p className="summary__secure">
                  <IconShield size={18} />
                  {PACKAGES_COPY.secure}
                </p>
              </>
            )}

            <p className="summary__consent">
              {PACKAGES_COPY.consent[0]}{' '}
              <a href={LINKS.terms} target="_blank" rel="noreferrer">
                {PACKAGES_COPY.consent[1]}
              </a>
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
