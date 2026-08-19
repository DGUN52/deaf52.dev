import { getCollection, type CollectionEntry } from 'astro:content';

export const LOCALES = ['ko', 'en', 'ja', 'zh', 'in', 'de', 'uk', 'il', 'tw'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
  in: 'Hindi',
  de: 'Deutsch',
  uk: 'English (UK)',
  il: 'עברית',
  tw: '繁體中文',
};

// 글 slug 앞에 붙는 언어 폴더명(ko/, en/, ja/ 등)을 잘라내기 위한 공용 정규식.
// 새 언어가 추가되면 LOCALES 배열만 바꾸면 여기도 자동으로 반영된다.
export const LOCALE_PREFIX_RE = new RegExp(`^(${LOCALES.join('|')})/`);

export function stripLocalePrefix(slug: string): string {
  return slug.replace(LOCALE_PREFIX_RE, '');
}

/**
 * 현재 글(entry)과 같은 translationKey를 가진 다른 언어 버전을 찾는다.
 * MongoDB 공식문서의 "이 페이지의 다른 언어 보기" 드롭다운과 동일한 동작.
 */
export async function getTranslations(
  entry: CollectionEntry<'it'> | CollectionEntry<'humanities'>,
  collectionName: 'it' | 'humanities'
) {
  const all = await getCollection(collectionName);
  const siblings = all.filter(
    (e) => e.data.translationKey === entry.data.translationKey
  );

  const result: Partial<Record<Locale, CollectionEntry<typeof collectionName>>> = {};
  for (const s of siblings) {
    result[s.data.lang] = s;
  }
  return result; // 없는 언어는 undefined -> 폴백 UI 처리
}

export function getLocaleFromUrl(url: URL): Locale {
  const [, maybeLocale] = url.pathname.split('/');
  return (LOCALES as readonly string[]).includes(maybeLocale)
    ? (maybeLocale as Locale)
    : 'ko';
}
