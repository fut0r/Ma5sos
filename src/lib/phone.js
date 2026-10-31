/*
 * Saudi mobile numbers, shared by the sign-in form and the server so both
 * accept and reject exactly the same input.
 *
 * Accepted: 05XXXXXXXX, 5XXXXXXXX, 9665XXXXXXXX, +9665XXXXXXXX, 009665XXXXXXXX,
 * with spaces or dashes, in Western or Arabic-Indic digits. Stored as
 * +9665XXXXXXXX.
 */

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

function toWesternDigits(text) {
  return text.replace(ARABIC_DIGITS, (digit) => {
    const code = digit.charCodeAt(0);
    // Arabic-Indic (U+0660) and Extended Arabic-Indic (U+06F0) both start at zero.
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/** Returns "+9665XXXXXXXX", or null when the input is not a Saudi mobile number. */
export function normalizeSaudiMobile(input) {
  let digits = toWesternDigits(String(input ?? '')).replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('966')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return /^5\d{8}$/.test(digits) ? `+966${digits}` : null;
}

/** "+966512345678" → "0512345678", the way Saudi numbers are usually written. */
export function localSaudiMobile(normalized) {
  return `0${normalized.slice(4)}`;
}
