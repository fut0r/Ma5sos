import {
  IconChart,
  IconChat,
  IconForm,
  IconLayers,
  IconLayout,
  IconNote,
  IconPin,
  IconQr,
  IconSend,
  IconUsers,
} from '../components/ui/Icons.jsx';
import { SEO } from './seo.js';

/*
 * Every word of site copy lives in this file; components only lay it out.
 * Packages, occasions, templates and FAQ entries are in the sibling data files.
 */

export const LINKS = {
  home: '/#top',
  create: '/packages/',
  templates: '/#templates',
  pricing: '/#pricing',
  login: '/login/',
  signup: '/login/?mode=signup',
  admin: '/admin/',
  contact: '#contact',
  terms: '/terms/',
  privacy: '/privacy/',
};

// A package page link with that package already chosen.
export const planLink = (planId) => `${LINKS.create}?plan=${planId}`;

// Contact & support details used by the interactive contact modal.
export const CONTACT_INFO = {
  eyebrow: 'تواصل معنا',
  title: 'فريق مخصوص في خدمتك',
  lead: 'سواء كنت تخطط لمناسبة كبيرة تزيد على 250 ضيفًا، أو تحتاج إلى مساعدة في تجهيز دعوتك، يسعدنا تواصلك المباشر معنا.',
  whatsappNumber: '966500000000',
  whatsappDisplay: '050 000 0000',
  email: 'support@ma5sos.com',
  hours: 'يومًيا من 9:00 صباحًا حتى 11:00 مساءً (ودعم فوري أثناء المناسبات)',
};

export const PENDING_PAGES = {
  hrefs: [],
  message: 'هذه الصفحة قيد التجهيز، وستتوفر قريبًا.',
};

// The name and tagline are shared with seo.js, which holds what search engines
// are given. `about` is the paragraph under the emblem in the footer.
export const BRAND = {
  name: SEO.siteName,
  lockup: `${SEO.siteName} | ${SEO.latinName.toUpperCase()}`,
  tagline: SEO.tagline,
  slogan: 'لأنك المقصود',
  about:
    'منصة سعودية متكاملة للدعوات الإلكترونية، تتيح لك تصميم دعوات أنيقة لمختلف المناسبات، وإرسالها لضيوفك، ومتابعة تأكيدات الحضور، وتنظيم الاستقبال عبر رموز QR، لتكون جميع تفاصيل دعوتك في مكان واحد.',
  logoAlt: 'شعار مخصوص — لأنك المقصود',
  homeLabel: 'مخصوص — الصفحة الرئيسية',
  rights: 'جميع الحقوق محفوظة.',
  location: 'بريدة، المملكة العربية السعودية',
};

export const ACTIONS = {
  create: 'أنشئ دعوتك',
  createNow: 'أنشئ دعوتك الآن',
  login: 'تسجيل الدخول',
  browseTemplates: 'تصفّح القوالب',
  skipToContent: 'تخطَّ إلى المحتوى',
};

export const NAV = [
  { href: '/#features', label: 'المزايا' },
  { href: '/#how', label: 'رحلتك مع مخصوص' },
  { href: '/#templates', label: 'القوالب' },
  { href: '/#pricing', label: 'الباقات' },
  { href: '/#faq', label: 'الأسئلة الشائعة' },
];

export const HERO = {
  chip: 'منصة سعودية للدعوات الإلكترونية · لأنك المقصود',
  title: 'كل مناسبة تبدأ بدعوة تليق بها',
  text: 'من أول دعوة إلى آخر ضيف، مخصوص يجمع لك تفاصيل مناسبتك في مكان واحد، صمّم دعوتك، أرسلها لضيوفك عبر واتساب، وتابع تأكيدات الحضور بكل سهولة.',
  note: 'جرّب مخصوص مجانًا: مناسبة تجريبية واحدة حتى 3 مدعوين.',
  noteLink: 'شاهد الباقات',
  // The three things the platform leads with.
  facts: [
    { icon: IconUsers, label: 'دعوة شخصية لكل ضيف' },
    { icon: IconChat, label: 'تأكيد الحضور عبر واتساب' },
    { icon: IconQr, label: 'تنظيم الدخول برمز QR' },
  ],
};

// The sample wedding invitation shown in the hero.
export const SAMPLE_INVITE = {
  label: 'نموذج دعوة زواج',
  kind: 'دعوة زواج',
  lines: ['يتشرّف عبدالله القحطاني بدعوتكم', 'لحضور حفل زواج ابنه'],
  name: 'فيصل',
  venue: 'قاعة الاحتفالات، بريدة',
  guestLabel: 'المدعو',
  guest: 'سلطان الحربي',
  companions: 'مرافقان',
  code: 'MK-7Q4K-01',
};

export const MARQUEE = {
  label: 'المناسبات التي تغطيها المنصة',
  items: [
    'زواج',
    'ملكة',
    'خطوبة',
    'تخرّج',
    'مولود',
    'عقيقة',
    'حفلة',
    'افتتاح',
    'اجتماع عائلي',
    'معايدة',
    'استقبال',
    'تكريم',
  ],
};

// Listed in the order a host meets them, from choosing a template to the day
// itself. `spotlight` marks the three that are drawn more prominently.
export const FEATURES = {
  eyebrow: 'المزايا',
  title: 'كل تفاصيل مناسبتك، تحت سيطرتك',
  lead: 'من تصميم الدعوة إلى استقبال آخر ضيف، مخصوص يجمع لك كل ما تحتاجه لتنظيم دعواتك ومتابعة ضيوفك بكل سهولة.',
  items: [
    {
      id: 'templates',
      icon: IconLayout,
      title: 'قوالب تليق بكل مناسبة',
      tagline: 'لكل مناسبة طابعها الخاص',
      text: 'اختر من مجموعة قوالب أنيقة وصيغ دعوات جاهزة، وخصّصها بما يناسب مناسبتك وذوقك.',
    },
    {
      id: 'qr',
      icon: IconQr,
      spotlight: true,
      title: 'دعوة خاصة لكل ضيف',
      tagline: 'خصوصية وتنظيم من أول دعوة',
      text: 'لكل مدعو دعوة باسمه ورمز QR خاص به، يتضمن بياناته وعدد مرافقيه، ويُستخدم مرة واحدة عند الدخول لضمان تنظيم الاستقبال.',
    },
    {
      id: 'whatsapp',
      icon: IconChat,
      spotlight: true,
      title: 'دعوات عبر واتساب',
      tagline: 'دعوتك تصل، والرد يوصلك',
      text: 'أرسل الدعوات مباشرة عبر واتساب، وامنح ضيوفك إمكانية تأكيد الحضور أو الاعتذار بضغطة واحدة.',
    },
    {
      id: 'notes',
      icon: IconNote,
      title: 'ملاحظات الضيوف',
      tagline: 'اهتم بالتفاصيل قبل وصولهم',
      text: 'استقبل ملاحظات ضيوفك وطلباتهم مع تأكيد الحضور، لتكون على اطلاع بكل ما يهمهم.',
    },
    {
      id: 'tracking',
      icon: IconChart,
      spotlight: true,
      title: 'متابعة الحضور لحظة بلحظة',
      tagline: 'كل رد أمامك، وكل ضيف محسوب',
      text: 'تابع تأكيدات الحضور والاعتذارات والردود المعلقة من لوحة تحكم واحدة، مع تحديث بيانات الضيوف تلقائيًا.',
    },
    {
      id: 'location',
      icon: IconPin,
      title: 'موقع المناسبة وتفاصيلها',
      tagline: 'كل المعلومات في دعوة واحدة',
      text: 'شارك موقع المناسبة عبر رابط الخرائط، مع التاريخ والوقت وتعليمات الحضور، ليصل ضيوفك بكل سهولة.',
    },
  ],
};

export const STEPS = {
  eyebrow: 'رحلتك مع مخصوص',
  title: 'خمس خطوات، ومناسبتك جاهزة',
  lead: 'اختر مناسبتك، صمّم دعوتك، وأرسلها لضيوفك. واترك لمخصوص مهمة تنظيم الردود وتسهيل الاستقبال، من البداية حتى يوم المناسبة.',
  items: [
    {
      icon: IconLayers,
      title: 'اختر مناسبتك',
      text: 'حدّد نوع مناسبتك، واختر الباقة الأنسب لاحتياجاتك وعدد ضيوفك.',
    },
    {
      icon: IconForm,
      title: 'أضف تفاصيل مناسبتك',
      text: 'أدخل اسم الداعي، والتاريخ والوقت، وموقع المناسبة، وجميع التفاصيل التي يحتاج ضيوفك إلى معرفتها.',
    },
    {
      icon: IconLayout,
      title: 'صمّم دعوتك',
      text: 'اختر من القوالب الأنيقة والصيغ الجاهزة، وخصّص دعوتك بما يناسب ذوقك وطابع مناسبتك.',
    },
    {
      icon: IconUsers,
      title: 'أضف ضيوفك',
      text: 'أدخل أسماء المدعوين وأرقام جوالاتهم، وسيُنشئ مخصوص رمز QR خاصًا لكل ضيف لتنظيم دخوله يوم المناسبة.',
    },
    {
      icon: IconSend,
      title: 'أرسل دعواتك وتابع الحضور',
      text: 'شارك دعوتك مع ضيوفك عبر واتساب، وتابع تأكيدات الحضور والاعتذارات والملاحظات، ونظّم استقبالهم يوم المناسبة بكل سهولة.',
    },
  ],
};

export const OCCASIONS_COPY = {
  eyebrow: 'صيغ الدعوات',
  title: 'لكل مناسبة كلمات تليق بها',
  lead: 'اختر نوع مناسبتك من بين مجموعة من صيغ الدعوات الجاهزة، وخصّص النص بما يناسب ذوقك وأسلوبك، أو اكتب دعوتك بكلماتك الخاصة.',
  tabsLabel: 'أنواع الدعوات',
  suggested: 'صيغة مقترحة',
  fieldsTitle: 'بيانات هذه الدعوة',
  copyWording: 'نسخ صيغة الدعوة',
  copiedWording: 'تم نسخ الصيغة ✓',
  // Followed by the invitation kind, e.g. "ابدأ دعوة زواج".
  start: 'ابدأ',
};

export const TEMPLATES_COPY = {
  eyebrow: 'القوالب',
  title: 'تصاميم مستوحاة من أصالة المكان',
  lead: 'اكتشف مجموعة من القوالب الأنيقة المستوحاة من تراثنا السعودي وجمال تفاصيله، من نقوش السدو والعمارة النجدية إلى زهور الخزامى وورد الطائف. اختر التصميم الذي يعكس ذوقك، وخصّص النصوص والألوان بما يناسب مناسبتك.',
  use: 'استخدم القالب',
  tabsLabel: 'أنواع القوالب',
  tabs: {
    photo: 'قوالب مصوّرة',
    custom: 'قوالب قابلة للتخصيص',
  },
  hints: {
    photo: 'تصاميم جاهزة بصور فاخرة. اضغط «معاينة» لترى الدعوة تُفتح كما تصل إلى ضيوفك.',
    custom: 'قوالب تختار خلفيتها وألوانها بنفسك.',
  },
  preview: 'معاينة',
  previewOf: 'معاينة قالب',
  replay: 'إعادة الحركة',
  close: 'إغلاق المعاينة',
  prev: 'القوالب السابقة',
  next: 'القوالب التالية',
  inviteButtons: {
    confirm: 'تأكيد الحضور',
    decline: 'اعتذار',
    location: 'الموقع',
  },
};

export const PRICING = {
  eyebrow: 'الباقات',
  title: 'باقات مخصوص',
  lead: 'كل مناسبة تستحق دعوة تليق بها. اختر الباقة التي تناسب مناسبتك، واترك الباقي على مخصوص.',
  free: 'مجانًا',
  currency: 'ريال',
  startFree: 'ابدأ مجانًا',
  choose: 'اختر الباقة',
  sharedTitle: 'مميزات مشتركة لجميع الباقات المدفوعة',
  methodsLabel: 'طرق الدفع المتاحة',
  methods: ['مدى', 'Apple Pay', 'فيزا', 'ماستركارد'],
  note: 'ملاحظة: جميع الأسعار تشمل إرسال رسالة دعوة واحدة لكل مدعو ضمن العدد المحدد في الباقة. ويمكن إضافة مدعوين برسوم إضافية.',
  contact: {
    before: 'جميع الأسعار بالريال السعودي، وللمناسبات التي يزيد عدد مدعويها على 250 ضيفًا، يسعدنا',
    link: 'تواصلك معنا',
    after: 'لتوفير الباقة المناسبة لاحتياجاتك.',
  },
};

export const FAQ_COPY = {
  eyebrow: 'الأسئلة الشائعة',
  title: 'كل ما تحتاج معرفته عن مخصوص',
};

export const LEGAL_COPY = {
  eyebrow: 'منصة مخصوص',
  updated: 'آخر تحديث:',
  contents: 'المحتويات',
};

export const CLOSING = {
  eyebrow: BRAND.tagline,
  title: 'كل مناسبة تبدأ بدعوة تليق بها',
  text: 'صمّم دعوتك، وشاركها مع ضيوفك، وتابع تأكيدات الحضور ونظّم استقبالهم بكل سهولة مع مخصوص.',
};

export const FOOTER_COLUMNS = [
  {
    title: 'المنصة',
    links: [
      { href: '/#features', label: 'المزايا' },
      { href: '/#occasions', label: 'صيغ الدعوات' },
      { href: '/#templates', label: 'القوالب' },
      { href: '/#pricing', label: 'الباقات' },
    ],
  },
  {
    title: 'حسابي',
    links: [
      { href: LINKS.login, label: 'تسجيل الدخول' },
      { href: LINKS.signup, label: 'إنشاء حساب' },
      { href: LINKS.admin, label: 'لوحة التحكم' },
    ],
  },
  {
    title: 'المساعدة',
    links: [
      { href: LINKS.privacy, label: 'سياسة الخصوصية' },
      { href: LINKS.terms, label: 'الشروط والأحكام' },
      { href: '/#faq', label: 'الأسئلة الشائعة' },
      { href: LINKS.contact, label: 'تواصل معنا' },
    ],
  },
];
