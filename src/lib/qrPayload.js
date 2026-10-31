/**
 * Ma5sos (مخصوص) guest tickets.
 *
 * The QR printed on a guest pass contains `MA5SOS:TICKET:QR-…` so the gate
 * scanner can tell our tickets apart from maps, WhatsApp links, shop cards and
 * any other QR code. Legacy `MAZOM:TICKET:QR-…` and raw `QR-…` tokens are also
 * accepted for backwards compatibility, while every other code is refused.
 */

export const TICKET_PREFIX = 'MA5SOS:TICKET:';
const LEGACY_PREFIX = 'MAZOM:TICKET:';
const TOKEN_RE = /\bQR-[A-Za-z0-9][A-Za-z0-9_-]*\b/i;
const TOKEN_ONLY_RE = /^QR-[A-Za-z0-9][A-Za-z0-9_-]*$/i;

export function encodeGuestQr(token) {
  const value = String(token || '').trim();
  if (!value) return '';
  const upper = value.toUpperCase();
  if (upper.startsWith(TICKET_PREFIX) || upper.startsWith(LEGACY_PREFIX)) return value;
  return `${TICKET_PREFIX}${value}`;
}

/** The plain token stored in the database, from either payload shape. */
export function readGuestQr(raw) {
  const text = String(raw || '').trim();
  if (!text) return { kind: 'empty', token: null, raw: '' };

  const match = text.match(TOKEN_RE);
  if (match) {
    return { kind: 'ma5sos', token: match[0].toUpperCase(), raw: text };
  }

  if (TOKEN_ONLY_RE.test(text)) {
    return { kind: 'ma5sos', token: text.toUpperCase(), raw: text };
  }

  const upper = text.toUpperCase();
  if (upper.startsWith('MA5SOS:') || upper.startsWith('MAZOM:') || /(ma5sos|mazom)\.(com|net|sa)/i.test(text)) {
    return { kind: 'invalid', token: null, raw: text };
  }

  return { kind: 'foreign', token: null, raw: text };
}
