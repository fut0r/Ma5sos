/*
 * Copy for the account pages: sign-in, choosing a package, and the payment
 * result. The server's refusals come with their own message (server/messages.js).
 */

export const AUTH_COPY = {
  eyebrow: 'حسابك في مخصوص',
  modes: {
    login: {
      tab: 'تسجيل الدخول',
      title: 'أهلًا بعودتك',
      lead: 'سجّل الدخول برقم جوالك لتكمل دعواتك وتتابع ضيوفك.',
      submit: 'تسجيل الدخول',
      switchText: 'ليس لديك حساب؟',
      switchLink: 'أنشئ حسابًا',
    },
    signup: {
      tab: 'إنشاء حساب',
      title: 'أنشئ حسابك',
      lead: 'دقيقة واحدة: اسمك ورقم جوالك وكلمة مرور تختارها.',
      submit: 'إنشاء الحساب',
      switchText: 'لديك حساب؟',
      switchLink: 'سجّل الدخول',
    },
  },
  fields: {
    name: 'الاسم',
    namePlaceholder: 'مثال: عبدالله القحطاني',
    phone: 'رقم الجوال',
    phonePlaceholder: '5X XXX XXXX',
    password: 'كلمة المرور',
    passwordHint: '8 أحرف على الأقل.',
    confirm: 'تأكيد كلمة المرور',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
  },
  // "أوافق على" + terms link + "و" + privacy link
  consent: ['أوافق على', 'الشروط والأحكام', 'و', 'سياسة الخصوصية'],
  errors: {
    name: 'اكتب اسمك (حرفان على الأقل).',
    phone: 'اكتب رقم جوال سعودي صحيح يبدأ بـ 05.',
    password: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.',
    confirm: 'كلمتا المرور غير متطابقتين.',
    consent: 'وافق على الشروط وسياسة الخصوصية لإنشاء الحساب.',
    network: 'تعذّر الاتصال بالخادم. تأكد من اتصالك وحاول مرة أخرى.',
  },
  busy: 'لحظة…',
  signedInAs: 'أنت مسجّل الدخول باسم',
  continue: 'تابع إلى الباقات',
  side: {
    title: 'لأنك المقصود · دعوتك تليق بمناسبتك',
    text: 'من أول دعوة إلى آخر ضيف، مخصوص يجمع لك تفاصيل مناسبتك في مكان واحد.',
  },
};

export const ACCOUNT_COPY = {
  account: 'حسابي',
  logout: 'تسجيل الخروج',
};

export const PACKAGES_COPY = {
  eyebrow: 'اختر باقتك',
  // Followed by the visitor's first name.
  greeting: 'أهلًا',
  title: 'اختر الباقة المناسبة لمناسبتك',
  lead: 'كل باقة لمناسبة واحدة، وتبدأ صلاحيتها من تاريخ الشراء حتى إقامة المناسبة.',
  choicesLabel: 'الباقات',
  free: 'مجانًا',
  currency: 'ريال',
  recommended: 'الخيار الموصى به',
  summary: 'ملخص الطلب',
  total: 'الإجمالي',
  pay: 'ادفع',
  startTrial: 'ابدأ التجربة المجانية',
  trialStarted: 'بدأت تجربتك المجانية. يمكنك الترقية إلى باقة مدفوعة في أي وقت.',
  secure: 'تُكمل الدفع في صفحة Paylink الآمنة، ثم تعود إلى مخصوص تلقائيًا.',
  // "بالمتابعة فإنك توافق على" + terms link
  consent: ['بالمتابعة فإنك توافق على', 'الشروط والأحكام'],
  owned: 'باقاتك',
  ownedStatus: { paid: 'مفعّلة', pending: 'بانتظار الدفع', canceled: 'ملغاة' },
  more: 'وغيرها',
  loading: 'جارٍ التحميل…',
  error: 'تعذّر الاتصال بالخادم. تأكد من اتصالك وحاول مرة أخرى.',
};

export const PAYMENT_COPY = {
  eyebrow: 'حالة الدفع',
  checking: { title: 'نتحقق من الدفع', text: 'لحظات ونؤكد لك نتيجة العملية مع Paylink.' },
  paid: { title: 'تم الدفع بنجاح', text: 'باقتك مفعّلة الآن. شكرًا لاختيارك مخصوص.' },
  pending: {
    title: 'الدفع لم يكتمل بعد',
    text: 'لم يؤكد Paylink الدفع حتى الآن. إن كنت أتممته فانتظر قليلًا ثم حدّث الحالة.',
  },
  canceled: { title: 'لم تكتمل عملية الدفع', text: 'أُلغيت العملية ولم يُخصم أي مبلغ. يمكنك المحاولة مرة أخرى.' },
  missing: { title: 'لا توجد عملية دفع', text: 'لم نجد طلبًا لعرض حالته.' },
  error: {
    title: 'تعذّر التحقق من حالة الدفع',
    text: 'لم نتمكن من الوصول إلى حالة الطلب الآن. إن كان المبلغ قد خُصم فسيظهر الطلب مفعّلًا بعد قليل.',
  },
  statuses: {
    paid: 'مدفوع ومفعّل',
    pending: 'بانتظار تأكيد Paylink',
    canceled: 'ملغى',
  },
  order: 'رقم الطلب',
  plan: 'الباقة',
  amount: 'المبلغ',
  refresh: 'تحديث الحالة',
  retry: 'حاول مرة أخرى',
  home: 'العودة إلى الرئيسية',
  packages: 'الباقات',
};
