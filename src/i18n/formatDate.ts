// 언어별 날짜 표기 형식.
// 한국어는 "2026년 8월 18일" 형태, 그 외 언어는 각자 로케일의 관용적인 표기(예: "Aug 18, 2026").
import type { Locale } from './utils';

const LOCALE_TAGS: Record<Locale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
  in: 'hi-IN',
  de: 'de-DE',
  uk: 'en-GB',
  il: 'he-IL',
  tw: 'zh-TW',
};

export function formatDate(date: Date, lang: Locale): string {
  if (lang === 'ko') {
    // "년월일" 형식을 명시적으로 고정 (Intl 기본 출력이 환경에 따라 미묘하게 다를 수 있어 직접 조립)
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return `${y}년 ${m}월 ${d}일`;
  }

  return new Intl.DateTimeFormat(LOCALE_TAGS[lang] ?? 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
