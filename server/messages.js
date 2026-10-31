// What the server tells the visitor when something is refused. The pages show
// `message` as is, so it is written for them.
export const MESSAGES = {
  badRequest: 'تعذّر قراءة الطلب. حدّث الصفحة وحاول مرة أخرى.',
  forbidden: 'رُفض الطلب لأنه لم يصدر من موقع مخصوص.',
  unauthorized: 'سجّل الدخول أولًا.',
  tooMany: 'محاولات كثيرة. انتظر بضع دقائق ثم حاول مرة أخرى.',
  server: 'حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل.',
  notFound: 'غير موجود.',

  nameInvalid: 'اكتب اسمك (حرفان على الأقل).',
  phoneInvalid: 'اكتب رقم جوال سعودي صحيح يبدأ بـ 05.',
  passwordShort: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.',
  passwordLong: 'كلمة المرور طويلة جدًا.',
  phoneTaken: 'هذا الرقم مسجّل من قبل. سجّل الدخول بدلًا من ذلك.',
  loginFailed: 'رقم الجوال أو كلمة المرور غير صحيحة.',

  planInvalid: 'اختر باقة من القائمة.',
  trialUsed: 'استخدمت التجربة المجانية من قبل. اختر إحدى الباقات المدفوعة.',
  paymentUnavailable: 'تعذّر الاتصال ببوابة الدفع الآن. حاول مرة أخرى بعد قليل.',
};
