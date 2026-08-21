import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://deaf52.dev',
  integrations: [
    mdx(),
    sitemap({
      // 404 페이지와 루트 리다이렉트 전용 페이지(<html> 태그 없음)는 사이트맵에서 제외
      filter: (page) => !page.includes('/404') && page !== 'https://deaf52.dev/',
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'dracula',
    },
  },
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en', 'ja', 'zh', 'in', 'de', 'uk', 'il', 'tw'],
    routing: {
      prefixDefaultLocale: true, // /ko/..., /en/... 둘 다 명시적 prefix
    },
  },
});
