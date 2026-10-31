import { Router } from 'express';
import { config } from './config.js';

/*
 * The parts of Paylink's REST API the site uses (developer.paylink.sa):
 *   POST /api/auth                       → id_token
 *   POST /api/addInvoice                 → transactionNo and the payment page url
 *   GET  /api/getInvoice/{transactionNo} → orderStatus (Pending | Paid | Canceled), amount
 */

const { baseUrl, apiId, secretKey } = config.paylink;

let token = null;
let tokenExpires = 0;

async function call(path, { method = 'GET', body, auth = true } = {}) {
  // Paylink's Cloudflare layer rejects the default Node/Python client
  // signature with "Error 1010". Send the same browser-like headers the
  // production FastAPI client uses.
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'accept-language': 'ar,en;q=0.9',
    origin: config.siteUrl,
    referer: `${config.siteUrl}/`,
  };
  if (auth) headers.authorization = `Bearer ${await getToken()}`;

  const response = await fetch(baseUrl + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON; reported below */
  }

  if (!response.ok) {
    // An expired token: forget it so the next call signs in again.
    if (response.status === 401) token = null;
    const detail = data?.detail || data?.title || text.slice(0, 200);
    throw new Error(`Paylink ${method} ${path} → ${response.status}: ${detail}`);
  }
  return data;
}

// "persistToken: true" gives a 30-hour token; it is renewed a little early.
async function getToken() {
  if (token && Date.now() < tokenExpires) return token;
  const data = await call('/api/auth', {
    method: 'POST',
    auth: false,
    body: { apiId, secretKey, persistToken: true },
  });
  if (!data?.id_token) throw new Error('Paylink /api/auth returned no id_token');
  token = data.id_token;
  tokenExpires = Date.now() + 29 * 60 * 60 * 1000;
  return token;
}

/**
 * Creates the invoice for one order. `callBackUrl` receives the visitor after
 * paying, with ?TransactionNo=…&OrderNumber=… added by Paylink.
 */
export function addInvoice({ orderNumber, amount, clientName, clientMobile, product, callBackUrl, cancelUrl }) {
  if (MOCK) return mockAddInvoice({ orderNumber, amount, product, callBackUrl, cancelUrl });
  return call('/api/addInvoice', {
    method: 'POST',
    body: {
      orderNumber,
      amount,
      currency: 'SAR',
      callBackUrl,
      cancelUrl,
      clientName,
      clientMobile,
      products: [{ title: product.title, description: product.description, price: amount, qty: 1, isDigital: true }],
      displayPending: true,
      note: `${product.title} — ${orderNumber}`,
    },
  });
}

/** Signs in to Paylink with the configured keys; throws when they are refused. */
export async function checkConnection() {
  if (MOCK) return 'mock';
  token = null;
  await getToken();
  return 'ok';
}

export function getInvoice(transactionNo) {
  if (MOCK) return mockGetInvoice(transactionNo);
  return call(`/api/getInvoice/${encodeURIComponent(transactionNo)}`);
}

/* ---------- PAYLINK_ENV=mock: a stand-in for local work ---------- */

/*
 * Answers like Paylink but keeps invoices in memory and draws its own payment
 * page, with "pay" and "cancel" buttons that return to the site the way
 * Paylink does. Refused in production by config.js.
 */
const MOCK = config.paylink.mode === 'mock';
const mockInvoices = new Map();

function mockAddInvoice({ orderNumber, amount, product, callBackUrl, cancelUrl }) {
  const transactionNo = `MOCK${Date.now()}${Math.floor(Math.random() * 1000)}`;
  mockInvoices.set(transactionNo, { transactionNo, orderNumber, amount, product, callBackUrl, cancelUrl, orderStatus: 'Pending' });
  return { transactionNo, orderStatus: 'Pending', url: `${config.siteUrl}/api/mock-paylink/${transactionNo}` };
}

function mockGetInvoice(transactionNo) {
  const invoice = mockInvoices.get(transactionNo);
  if (!invoice) throw new Error(`Unknown mock invoice ${transactionNo} (mock invoices are lost when the server restarts)`);
  const paid = invoice.orderStatus === 'Paid';
  return { ...invoice, paymentReceipt: paid ? { paymentMethod: 'mock' } : undefined };
}

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const mockPaylink = Router();

mockPaylink.get('/:transactionNo', (req, res) => {
  const invoice = mockInvoices.get(req.params.transactionNo);
  if (!invoice) return res.status(404).send('Unknown mock invoice');

  const { action } = req.query;
  if (action === 'pay' || action === 'cancel') {
    const back = new URL(action === 'pay' ? invoice.callBackUrl : invoice.cancelUrl);
    if (action === 'pay') invoice.orderStatus = 'Paid';
    back.searchParams.set('TransactionNo', invoice.transactionNo);
    back.searchParams.set('OrderNumber', invoice.orderNumber);
    return res.redirect(back.toString());
  }

  res.type('html').send(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>محاكاة الدفع</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f2f2f4; font: 16px/1.7 Tahoma, sans-serif; color: #222; }
  main { width: min(92vw, 420px); padding: 28px; border-radius: 16px; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
  .tag { display: inline-block; padding: 2px 10px; border-radius: 99px; background: #fff3cd; color: #7a5a00; font-size: 13px; }
  h1 { margin: 12px 0 4px; font-size: 22px; }
  .amount { margin: 16px 0; font-size: 34px; font-weight: 700; }
  a { display: block; margin-top: 10px; padding: 12px; border-radius: 10px; text-align: center; text-decoration: none; font-weight: 700; }
  .pay { background: #4b3fd8; color: #fff; } .cancel { background: #eee; color: #333; }
  p { color: #666; font-size: 14px; }
</style></head><body><main>
  <span class="tag">محاكاة محلية — لا تُدفع أي أموال</span>
  <h1>${escape(invoice.product.title)}</h1>
  <div>طلب ${escape(invoice.orderNumber)}</div>
  <div class="amount">${escape(invoice.amount)} ريال</div>
  <a class="pay" href="?action=pay">ادفع (محاكاة)</a>
  <a class="cancel" href="?action=cancel">إلغاء الدفع</a>
  <p>هذه الصفحة تظهر فقط عند PAYLINK_ENV=mock، وتأخذ مكان صفحة دفع Paylink أثناء التطوير.</p>
</main></body></html>`);
});
