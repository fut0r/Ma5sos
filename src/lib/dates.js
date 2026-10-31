// The sample invitation always shows a Friday evening about five weeks ahead,
// so the page never displays a date that has already passed.
export function sampleEventDate(from = new Date()) {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 35, 20, 30);
  const daysToFriday = (5 - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + daysToFriday);
  return date;
}

const format = (locale, options, date) => new Intl.DateTimeFormat(locale, options).format(date);

// Gregorian and Umm al-Qura (Hijri) side by side, as Saudi invitations print them.
export function formatEventDate(date) {
  const long = { day: 'numeric', month: 'long', year: 'numeric' };
  return {
    weekday: format('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long' }, date),
    gregorian: format('ar-SA-u-ca-gregory-nu-latn', long, date),
    hijri: format('ar-SA-u-ca-islamic-umalqura-nu-latn', long, date),
    time: format('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit', hour12: true }, date),
  };
}
