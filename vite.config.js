import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { AUTH_COPY, PACKAGES_COPY, PAYMENT_COPY } from './src/data/account.js';
import { FAQ } from './src/data/faq.js';
import { PRIVACY, TERMS } from './src/data/legal.js';
import { PLANS, TRIAL } from './src/data/plans.js';
import { SEO } from './src/data/seo.js';

// The site's pages: the HTML file of each, the address it is served at, and
// what search engines and link previews are told about it. `private` pages
// (account and payment) are kept out of search results and the sitemap.
const PAGES = [
  {
    name: 'main',
    file: 'index.html',
    path: '/',
    title: SEO.title,
    description: SEO.description,
    social: SEO.socialDescription,
    home: true,
  },
  {
    name: 'terms',
    file: 'terms/index.html',
    path: TERMS.path,
    title: `${TERMS.title} | ${SEO.siteName}`,
    description: TERMS.description,
  },
  {
    name: 'privacy',
    file: 'privacy/index.html',
    path: PRIVACY.path,
    title: `${PRIVACY.title} | ${SEO.siteName}`,
    description: PRIVACY.description,
  },
  {
    name: 'login',
    file: 'login/index.html',
    path: '/login/',
    title: `${AUTH_COPY.modes.login.tab} | ${SEO.siteName}`,
    description: AUTH_COPY.modes.login.lead,
    private: true,
  },
  {
    name: 'packages',
    file: 'packages/index.html',
    path: '/packages/',
    title: `${PACKAGES_COPY.eyebrow} | ${SEO.siteName}`,
    description: PACKAGES_COPY.lead,
  },
  {
    name: 'payment',
    file: 'payment/index.html',
    path: '/payment/',
    title: `${PAYMENT_COPY.eyebrow} | ${SEO.siteName}`,
    description: PAYMENT_COPY.checking.text,
    private: true,
  },
  {
    name: 'admin',
    file: 'admin/index.html',
    path: '/admin/',
    title: `لوحة التحكم | ${SEO.siteName}`,
    description: 'لوحة التحكم الإدارية وإدارة المناسبات والمدعوين',
    private: true,
  },
  {
    name: 'invite',
    file: 'invite/index.html',
    path: '/invite/',
    title: `بطاقة الدعوة الإلكترونية | ${SEO.siteName}`,
    description: 'دعوة إلكترونية خاصة عبر منصة مخصوص',
    private: true,
  },
];

const fromRoot = (file) => fileURLToPath(new URL(file, import.meta.url));

// ctx.path is the HTML file's path from the project root, e.g. "/terms/index.html".
const pageFor = (ctx) => PAGES.find((page) => `/${page.file}` === ctx.path) ?? PAGES[0];

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// schema.org description of the site, built from the same data the page shows,
// so packages, prices and questions can never drift from what search engines read.
function structuredData(siteUrl) {
  const id = (name) => (siteUrl ? `${siteUrl}/#${name}` : undefined);
  const absolute = (path) => (siteUrl ? siteUrl + path : path);

  const organization = {
    '@type': 'Organization',
    '@id': id('organization'),
    name: SEO.siteName,
    alternateName: [SEO.latinName, SEO.latinName.toUpperCase()],
    slogan: SEO.tagline,
    description: SEO.about,
    url: siteUrl || undefined,
    logo: absolute(SEO.logo),
    areaServed: { '@type': 'Country', name: SEO.country },
  };

  const website = {
    '@type': 'WebSite',
    '@id': id('website'),
    name: SEO.siteName,
    alternateName: SEO.latinName,
    description: SEO.description,
    url: siteUrl || undefined,
    inLanguage: 'ar',
    publisher: siteUrl ? { '@id': id('organization') } : undefined,
  };

  const service = {
    '@type': 'Service',
    '@id': id('service'),
    name: `${SEO.siteName} — الدعوات الإلكترونية`,
    serviceType: 'تصميم وإرسال الدعوات الإلكترونية وإدارة تأكيد الحضور',
    description: SEO.description,
    provider: siteUrl ? { '@id': id('organization') } : { '@type': 'Organization', name: SEO.siteName },
    areaServed: { '@type': 'Country', name: SEO.country },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'باقات مخصوص',
      itemListElement: [TRIAL, ...PLANS].map((plan) => ({
        '@type': 'Offer',
        name: plan.name,
        description: plan.features.join('، '),
        price: plan.price,
        priceCurrency: SEO.currency,
      })),
    },
  };

  const faq = {
    '@type': 'FAQPage',
    '@id': id('faq'),
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': [organization, website, service, faq] });
  return json.replace(/</g, '\\u003c'); // never let text close the <script> tag
}

/*
 * What every page's <head> shares: colour hints, icons, and src/boot.js, which
 * picks the theme before the first paint.
 */
function sharedHead() {
  const boot = readFileSync(fromRoot('./src/boot.js'), 'utf8');

  return {
    name: 'ma5sos-head',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        { tag: 'meta', attrs: { name: 'color-scheme', content: 'dark light' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#0b0d0c' }, injectTo: 'head' },
        {
          tag: 'link',
          attrs: { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/src/assets/brand/favicon.png' },
          injectTo: 'head',
        },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'manifest', href: '/site.webmanifest' }, injectTo: 'head' },
        { tag: 'script', children: boot, injectTo: 'head' },
      ],
    },
  };
}

function seo(siteUrl) {
  const meta = (attrs) => ({ tag: 'meta', attrs, injectTo: 'head' });
  const image = siteUrl ? siteUrl + SEO.image : SEO.image;

  return {
    name: 'ma5sos-seo',

    transformIndexHtml(html, ctx) {
      const page = pageFor(ctx);
      const social = page.social ?? page.description;

      const tags = [
        meta({ name: 'description', content: page.description }),
        meta({ name: 'robots', content: page.private ? 'noindex, nofollow' : 'index, follow' }),
        meta({ name: 'application-name', content: SEO.siteName }),
        meta({ name: 'apple-mobile-web-app-title', content: SEO.siteName }),

        meta({ property: 'og:type', content: 'website' }),
        meta({ property: 'og:locale', content: SEO.locale }),
        meta({ property: 'og:site_name', content: SEO.siteName }),
        meta({ property: 'og:title', content: page.title }),
        meta({ property: 'og:description', content: social }),
        meta({ property: 'og:image', content: image }),
        meta({ property: 'og:image:width', content: '1200' }),
        meta({ property: 'og:image:height', content: '630' }),
        meta({ property: 'og:image:alt', content: SEO.imageAlt }),

        meta({ name: 'twitter:card', content: 'summary_large_image' }),
        meta({ name: 'twitter:title', content: page.title }),
        meta({ name: 'twitter:description', content: social }),
        meta({ name: 'twitter:image', content: image }),
        meta({ name: 'twitter:image:alt', content: SEO.imageAlt }),
      ];

      if (page.home) {
        tags.push({
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          children: structuredData(siteUrl),
          injectTo: 'head',
        });
      }

      if (siteUrl && !page.private) {
        tags.push(
          { tag: 'link', attrs: { rel: 'canonical', href: siteUrl + page.path }, injectTo: 'head' },
          meta({ property: 'og:url', content: siteUrl + page.path }),
        );
      }

      return {
        html: html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(page.title)}</title>`),
        tags,
      };
    },

    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', 'Disallow: /api/'];

      if (siteUrl) {
        robots.push('', `Sitemap: ${siteUrl}/sitemap.xml`);
        const today = new Date().toISOString().slice(0, 10);
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...PAGES.filter((page) => !page.private).map(
              (page) => `  <url><loc>${siteUrl}${page.path}</loc><lastmod>${today}</lastmod></url>`,
            ),
            '</urlset>',
            '',
          ].join('\n'),
        });
      } else {
        this.warn(
          'VITE_SITE_URL is not set: the canonical links, og:url and sitemap.xml were left out, ' +
            'and sharing images use a relative address. Set it in .env before publishing.',
        );
      }

      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots.join('\n') + '\n' });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiUrl = `http://localhost:${loadEnv(mode, process.cwd(), '').API_PORT || 8000}`;
  const siteUrl = (env.VITE_SITE_URL || '').trim().replace(/\/+$/, '');

  return {
    plugins: [react(), sharedHead(), seo(siteUrl)],
    build: {
      rolldownOptions: {
        input: Object.fromEntries(PAGES.map((page) => [page.name, fromRoot(`./${page.file}`)])),
      },
    },
    server: { port: 5173, strictPort: true, proxy: { '/api': apiUrl } },
    preview: { proxy: { '/api': apiUrl } },
  };
});
