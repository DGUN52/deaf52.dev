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

// 사이트 내부 라우팅/폴더명으로 쓰는 언어 코드(위 LOCALES)와,
// 검색엔진(hreflang, <html lang>)이 실제로 요구하는 표준 언어 태그(BCP 47/ISO 639-1)는 다르다.
// - il(이스라엘 국가코드) -> he(히브리어의 표준 언어코드)
// - in(인도 국가코드) -> hi(힌디어의 표준 언어코드)
// - tw(대만 국가코드) -> zh-Hant(번체 중국어. 단독 zh는 보통 간체로 인식됨)
// - uk: 이 프로젝트에서는 "영어(영국)"라는 의미로 쓰지만, uk는 ISO 639-1에서 우크라이나어를
//   가리키는 코드라서 그대로 노출하면 검색엔진이 혼동한다. -> en-GB
// 내부 라우팅(URL, 폴더명, LOCALES 배열)은 그대로 두고, 검색엔진에 노출되는 지점(hreflang,
// <html lang>)에서만 이 매핑을 거쳐서 표준 코드로 변환한다.
export const LOCALE_HREFLANG: Record<Locale, string> = {
  ko: 'ko',
  en: 'en',
  ja: 'ja',
  zh: 'zh',
  in: 'hi',
  de: 'de',
  uk: 'en-GB',
  il: 'he',
  tw: 'zh-Hant',
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
