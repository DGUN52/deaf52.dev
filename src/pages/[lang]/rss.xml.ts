import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { LOCALES, LOCALE_PREFIX_RE, type Locale } from '../../i18n/utils';

// /ko/rss.xml, /en/rss.xml, ... 각 언어별로 IT + 인문학 글을 합친 통합 피드.
// draft 상태인 글은 제외한다.

export function getStaticPaths() {
  return LOCALES.map((lang) => ({ params: { lang } }));
}

export async function GET(context: APIContext) {
  const lang = context.params.lang as Locale;

  const [itPosts, humanitiesPosts] = await Promise.all([
    getCollection('it', ({ data }) => data.lang === lang && !data.draft),
    getCollection('humanities', ({ data }) => data.lang === lang && !data.draft),
  ]);

  const items = [...itPosts, ...humanitiesPosts]
    .sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf())
    .map((entry) => {
      const category = entry.collection; // 'it' | 'humanities'
      const cleanSlug = entry.slug.replace(LOCALE_PREFIX_RE, '');
      return {
        title: entry.data.title,
        description: entry.data.description,
        pubDate: entry.data.publishedAt,
        link: `/${lang}/${category}/${cleanSlug}`,
        categories: category === 'it' ? entry.data.tech : [entry.data.subcategory],
      };
    });

  const siteTitle: Record<Locale, string> = {
    ko: 'deaf52 · IT & humanities',
    en: 'deaf52 · IT & humanities',
    ja: 'deaf52 · IT & humanities',
    zh: 'deaf52 · IT & humanities',
    in: 'deaf52 · IT & humanities',
    de: 'deaf52 · IT & humanities',
    uk: 'deaf52 · IT & humanities',
    il: 'deaf52 · IT & humanities',
    tw: 'deaf52 · IT & humanities',
  };

  return rss({
    title: siteTitle[lang],
    description: 'IT 기술과 인문학을 함께 기록하는 블로그',
    site: context.site ?? 'https://deaf52.dev',
    items,
    // 피드 자체의 언어를 명시 (RSS 2.0 <language> 태그)
    customData: `<language>${lang}</language>`,
  });
}
