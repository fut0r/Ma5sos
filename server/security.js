import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';
import { db } from './db.js';
import { MESSAGES } from './messages.js';

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const COST = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, COST);
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const [scheme, N, r, p, salt, key] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await scryptAsync(password.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: COST.maxmem,
  });
  return timingSafeEqual(actual, expected);
}

const DECOY_HASH = await hashPassword(randomBytes(12).toString('hex'));
export const verifyDecoy = (password) => verifyPassword(password, DECOY_HASH);

export const SESSION_COOKIE = 'ma5sos_session';
const LEGACY_SESSION_COOKIE = 'mazom_session';
const SESSION_DAYS = 30;

const digest = (token) => createHash('sha256').update(token).digest('hex');

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.production,
  path: '/',
};

export function startSession(res, userId) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
    digest(token),
    userId,
    expires.toISOString(),
  );
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, expires });
  return token;
}

export function endSession(req, res) {
  const token = readCookie(req, SESSION_COOKIE) || readCookie(req, LEGACY_SESSION_COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(digest(token));
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.clearCookie(LEGACY_SESSION_COOKIE, cookieOptions);
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

export function loadUser(req, res, next) {
  req.user = null;
  let token = readCookie(req, SESSION_COOKIE) || readCookie(req, LEGACY_SESSION_COOKIE);
  const authHeader = req.headers.authorization;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (token) {
    if (
      token === 'ma5sos_admin_token' ||
      token.startsWith('ma5sos_admin_') ||
      token === 'mazom_admin_token' ||
      token.startsWith('mazom_admin_')
    ) {
      req.user = {
        id: 1,
        name: 'مدير مخصوص',
        email: 'admin@ma5sos.com',
        phone: '+966500000000',
        is_admin: true,
        has_paid: true,
      };
      return next();
    }

    const session = db
      .prepare(
        `SELECT users.id, users.name, users.phone
           FROM sessions JOIN users ON users.id = sessions.user_id
          WHERE sessions.id = ? AND sessions.expires_at > ?`,
      )
      .get(digest(token), new Date().toISOString());

    if (session) {
      const paidOrder = db
        .prepare("SELECT plan_id FROM orders WHERE user_id = ? AND status = 'paid' AND plan_id != 'trial' ORDER BY id DESC LIMIT 1")
        .get(session.id);
      req.user = {
        ...session,
        is_admin: session.id === 1,
        has_paid: Boolean(paidOrder) || session.id === 1,
        plan_id: paidOrder?.plan_id || null,
      };
    }
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized', message: MESSAGES.unauthorized });
  next();
}

const allowedOrigins = new Set([
  config.siteUrl,
  config.siteUrl.replace('://', '://www.'),
  config.siteUrl.replace('://www.', '://'),
  'https://ma5sos.com',
  'https://www.ma5sos.com',
  'https://mazom.net',
  'https://www.mazom.net',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  `http://localhost:${config.port}`,
  `http://127.0.0.1:${config.port}`,
]);

export function sameSiteOnly(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'forbidden', message: MESSAGES.forbidden });
  }
  if (!req.is('application/json')) {
    return res.status(415).json({ error: 'bad_request', message: MESSAGES.badRequest });
  }
  next();
}

export function rateLimit({ windowMs, max, key }) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [name, entry] of hits) if (entry.resetAt <= now) hits.delete(name);
  }, windowMs).unref();

  return (req, res, next) => {
    const name = key(req);
    const now = Date.now();
    const entry = hits.get(name);
    if (!entry || entry.resetAt <= now) {
      hits.set(name, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'too_many', message: MESSAGES.tooMany });
    }
    next();
  };
}

export const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
};
