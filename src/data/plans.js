// The Ma5sos (مخصوص) packages. Prices are in Saudi riyals and
// every package covers a single occasion. vite.config.js reads this file for
// the structured data, so it must stay plain data, with no imports.
//
// `surface` puts a package on a coloured card of its own ('brand' or 'gold');
// `recommended` adds the star beside its name.
export const PLANS = [
  {
    id: 'ma5sos',
    legacyId: 'mazom',
    index: '01',
    tagline: 'للمناسبات الصغيرة',
    name: 'باقة مخصوص',
    price: 149,
    maxGuests: 50,
    features: [
      'مناسبة واحدة حتى 50 مدعوًا.',
      'إرسال الدعوات عبر واتساب.',
      'قوالب جاهزة مع إمكانية تعديل النصوص والألوان.',
      'إضافة موعد المناسبة وموقعها على الخريطة.',
      'تأكيد الحضور والاعتذار مع متابعة الردود.',
      'دعم فني مباشر.',
    ],
  },
  {
    id: 'plus',
    index: '02',
    tagline: 'للمناسبات المتوسطة – الباقة الموصى بها',
    name: 'باقة مخصوص بلس',
    price: 299,
    maxGuests: 100,
    surface: 'brand',
    recommended: true,
    features: [
      'مناسبة واحدة حتى 100 مدعو.',
      'جميع مميزات باقة مخصوص.',
      'مجموعة أوسع من القوالب المميزة.',
      'دعوة مخصصة باسم كل مدعو.',
      'رمز QR لكل مدعو لتنظيم الدخول وتسجيل الحضور.',
      'تصدير قائمة المدعوين.',
      'دعم فني مباشر.',
    ],
  },
  {
    id: 'vip',
    index: '03',
    tagline: 'للمناسبات الكبيرة',
    name: 'باقة مخصوص VIP',
    price: 599,
    maxGuests: 250,
    surface: 'gold',
    features: [
      'مناسبة واحدة حتى 250 مدعوًا.',
      'جميع مميزات باقة مخصوص بلس.',
      'فريق مخصوص يتولى إدخال بيانات المدعوين وتجهيز الدعوات وإرسالها.',
      'تذكير المدعوين عبر واتساب.',
      'إرسال رسائل شكر للضيوف بعد المناسبة.',
      'دعم فني مخصص.',
    ],
  },
];

// The free trial, shown apart from the paid packages.
export const TRIAL = {
  id: 'trial',
  name: 'التجربة المجانية',
  tagline: 'جرّب مخصوص قبل اختيار باقتك.',
  price: 0,
  maxGuests: 3,
  features: [
    'مناسبة تجريبية واحدة',
    'حتى 3 مدعوين',
    'قالب مجاني قابل للتعديل',
    'إدخال بيانات المناسبة',
    'معاينة الدعوة قبل إرسالها',
    'إرسال 3 دعوات فعلية عبر واتساب',
    'تجربة تأكيد الحضور والاعتذار',
    'معاينة رمز QR',
  ],
};

// Included in every paid package.
export const SHARED_FEATURES = [
  'الدعم الفني المباشر',
  'مناسبة واحدة',
  'إرسال الدعوات عبر واتساب',
  'قوالب جاهزة قابلة للتخصيص',
  'موعد المناسبة وموقعها',
  'تأكيد الحضور والاعتذار',
  'متابعة ردود المدعوين',
];
