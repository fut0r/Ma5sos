/*
 * Search and sharing text for Ma5sos (مخصوص). vite.config.js reads this
 * file (so it must stay plain data, with no imports) to fill in the page's
 * <head>: title, description, sharing cards and structured data. The footer
 * shows `about`.
 */
export const SEO = {
  siteName: 'مخصوص',
  latinName: 'Ma5sos',
  tagline: 'لأنك المقصود — دعوتك تليق بمناسبتك',
  title: 'مخصوص | لأنك المقصود — دعوتك تليق بمناسبتك',

  // Shown under the title in search results.
  description:
    'منصة مخصوص لإنشاء وتصميم الدعوات الإلكترونية للزواجات والمناسبات، مع إمكانية مشاركة الدعوات وإدارة الضيوف وتأكيد الحضور بسهولة وأناقة.',

  // Shown when the link is shared on WhatsApp, X and the like.
  socialDescription:
    'لأنك المقصود، مناسبتك تبدأ بدعوة تليق بها. مع مخصوص، صمّم دعوتك الإلكترونية بأسلوب راقٍ، وشارك فرحتك مع من تحب، ونظّم حضور ضيوفك بكل سهولة.',

  about:
    'مخصوص (MA5SOS) منصة إلكترونية سعودية متخصصة في تصميم وإنشاء الدعوات الإلكترونية للمناسبات بمختلف أنواعها، من حفلات الزفاف والملكة إلى المناسبات العائلية والخاصة.',

  locale: 'ar_SA',
  country: 'SA',
  currency: 'SAR',

  // Files in /public.
  image: '/og-image.jpg',
  imageAlt: 'شعار مخصوص: لأنك المقصود — دعوتك تليق بمناسبتك',
  logo: '/icon-512.png',
};
