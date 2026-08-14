import { getCollection, type CollectionEntry } from 'astro:content';

export const LOCALES = ['ko', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
};

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
  return result; // { ko: entry, en: entry } (없는 언어는 undefined -> 폴백 UI 처리)
}

export function getLocaleFromUrl(url: URL): Locale {
  const [, maybeLocale] = url.pathname.split('/');
  return (LOCALES as readonly string[]).includes(maybeLocale)
    ? (maybeLocale as Locale)
    : 'ko';
}
