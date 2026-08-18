import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
//import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://deaf52.dev',
  //integrations: [mdx(), sitemap()], // temp annotate for deploy
  integrations: [mdx()],
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en'],
    routing: {
      prefixDefaultLocale: true, // /ko/..., /en/... 둘 다 명시적 prefix
    },
  },
});
