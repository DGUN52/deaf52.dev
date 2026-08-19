import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://deaf52.dev',
  integrations: [mdx()],
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
