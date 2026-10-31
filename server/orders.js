import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { PLANS, TRIAL } from '../src/data/plans.js';
import { localSaudiMobile } from '../src/lib/phone.js';
import { config } from './config.js';
import { db } from './db.js';
import { MESSAGES } from './messages.js';
import { addInvoice, getInvoice } from './paylink.js';
import { requireUser, safeEqual } from './security.js';

export const orders = Router();
export const paylinkWebhook = Router();

const PLAN_BY_ID = new Map();
for (const plan of [TRIAL, ...PLANS]) {
  PLAN_BY_ID.set(plan.id, plan);
  if (plan.legacyId) PLAN_BY_ID.set(plan.legacyId, plan);
}

const fail = (res, status, error) => res.status(status).json({ error, message: MESSAGES[error] });

const newOrderNumber = () =>
  `MK${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString('hex').toUpperCase()}`;

const publicOrder = (order) => ({
  orderNumber: order.order_number,
  planId: order.plan_id,
  amount: order.amount,
  status: order.status,
  paymentMethod: order.payment_method,
  createdAt: order.created_at,
  paidAt: order.paid_at,
});

export async function refreshOrder(order) {
  if (order.status !== 'pending' || !order.transaction_no) return order;

  const invoice = await getInvoice(order.transaction_no);
  const status = String(invoice?.orderStatus ?? '').toLowerCase();

  if (status === 'paid' && Math.abs(Number(invoice.amount) - order.amount) < 0.01) {
    db.prepare(
      `UPDATE orders SET status = 'paid', paid_at = datetime('now'), payment_method = ?
        WHERE id = ? AND status = 'pending'`,
    ).run(invoice.paymentReceipt?.paymentMethod ?? null, order.id);
  } else if (status === 'canceled') {
    db.prepare(`UPDATE orders SET status = 'canceled' WHERE id = ? AND status = 'pending'`).run(order.id);
  }
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
}

orders.use(requireUser);

orders.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json({ orders: rows.map(publicOrder) });
});

orders.post('/', async (req, res) => {
  const plan = PLAN_BY_ID.get(String(req.body?.planId ?? ''));
  if (!plan) return fail(res, 400, 'planInvalid');

  const orderNumber = newOrderNumber();

  if (plan.price === 0) {
    const used = db.prepare(`SELECT 1 FROM orders WHERE user_id = ? AND plan_id = ?`).get(req.user.id, plan.id);
    if (used) return fail(res, 409, 'trialUsed');
    db.prepare(
      `INSERT INTO orders (order_number, user_id, plan_id, amount, status, paid_at)
       VALUES (?, ?, ?, 0, 'paid', datetime('now'))`,
    ).run(orderNumber, req.user.id, plan.id);
    return res.status(201).json({ orderNumber, status: 'paid', trial: true });
  }

  const { lastInsertRowid } = db
    .prepare(`INSERT INTO orders (order_number, user_id, plan_id, amount, status) VALUES (?, ?, ?, ?, 'pending')`)
    .run(orderNumber, req.user.id, plan.id, plan.price);

  const returnUrl = `${config.siteUrl}/payment/`;
  let invoice;
  try {
    invoice = await addInvoice({
      orderNumber,
      amount: plan.price,
      clientName: req.user.name,
      clientMobile: localSaudiMobile(req.user.phone || '+966500000000'),
      product: { title: plan.name, description: plan.tagline },
      callBackUrl: returnUrl,
      cancelUrl: `${returnUrl}?OrderNumber=${orderNumber}&cancelled=1`,
    });
  } catch (error) {
    console.error(error);
    db.prepare(`UPDATE orders SET status = 'canceled' WHERE id = ?`).run(lastInsertRowid);
    return fail(res, 502, 'paymentUnavailable');
  }

  if (!invoice?.url || !invoice?.transactionNo) {
    console.error('Paylink addInvoice returned no url or transactionNo', invoice);
    db.prepare(`UPDATE orders SET status = 'canceled' WHERE id = ?`).run(lastInsertRowid);
    return fail(res, 502, 'paymentUnavailable');
  }

  db.prepare('UPDATE orders SET transaction_no = ?, payment_url = ? WHERE id = ?').run(
    String(invoice.transactionNo),
    invoice.url,
    lastInsertRowid,
  );
  res.status(201).json({ orderNumber, status: 'pending', paymentUrl: invoice.url });
});

orders.get('/:orderNumber', async (req, res) => {
  const order = db
    .prepare('SELECT * FROM orders WHERE order_number = ? AND user_id = ?')
    .get(req.params.orderNumber, req.user.id);
  if (!order) return fail(res, 404, 'notFound');

  try {
    res.json({ order: publicOrder(await refreshOrder(order)) });
  } catch (error) {
    console.error(error);
    res.json({ order: publicOrder(order), checkFailed: true });
  }
});

paylinkWebhook.post('/', async (req, res) => {
  const expected = config.paylink.webhookToken;
  if (expected && !safeEqual(req.headers.authorization ?? '', `Bearer ${expected}`)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const orderNumber = String(req.body?.merchantOrderNumber ?? '');
  const order = orderNumber ? db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber) : null;
  if (order) {
    try {
      await refreshOrder(order);
    } catch (error) {
      console.error(error);
      return res.status(503).json({ error: 'retry' });
    }
  }
  res.json({ ok: true });
});
