import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkResponsiveImages from './src/remark-responsive-images.mjs';

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
    // 본문 마크다운 이미지(![]())를 srcset 있는 반응형 <img>로 바꿔주는 플러그인.
    // content 레포에서 미리 생성해 커밋해둔 public/images/responsive-manifest.json을
    // 읽어서 동작한다(빌드 시점에 재생성하지 않음 - generate_responsive_images.py는
    // content 레포 쪽에서 새 이미지가 생길 때만 실행). 매니페스트에 없는 이미지는
    // 자동으로 기존 방식(단순 <img>)으로 폴백된다.
    // 자세한 설명은 src/remark-responsive-images.mjs 파일 상단 주석 참고.
    remarkPlugins: [remarkResponsiveImages],
  },
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en', 'ja', 'zh', 'in', 'de', 'uk', 'il', 'tw'],
    routing: {
      prefixDefaultLocale: true, // /ko/..., /en/... 둘 다 명시적 prefix
    },
  },
});
