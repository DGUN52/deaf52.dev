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

// 홈페이지 글 목록(ledger 스타일)처럼 좁은 고정폭 칼럼에 넣는 용도의 짧은 날짜.
// formatDate()는 "9월 10일"/"Sep 10, 2026"처럼 언어마다 길이가 들쭉날쭉해서
// 좁은 grid 칼럼(옛날엔 "01" 두 자리 일련번호가 들어가던 자리)에 넣으면 언어에 따라
// 줄바꿈되거나 넘칠 수 있다. 그래서 언어와 무관하게 항상 영어 월 약어(Jan~Dec, 3글자)를
// 쓴다 - 09처럼 숫자만 쓰면 "9월"인지 "9일"인지, 또는 날짜 형식이 MM.DD인지 DD.MM인지
// 다국어 환경에서 헷갈릴 수 있어서 영어 3글자 약어로 모호함을 없앴다.
//
// 올해 글은 "Sep 10"(월 일)처럼 연도를 생략하고, 작년 이전 글은 "2025 Sep"(연도 월)처럼
// 앞자리를 연도로 시작한다 - 목록에 섞여 나오는 오래된 글이 "언제 글인지" 한눈에
// 구분되게 하기 위함이고(연도가 먼저 보여서 "오래된 글"이라는 신호가 즉시 눈에 띔),
// 칼럼에 들어갈 정보량(일 vs 연도)이 바뀌는 대신 항상 폭이 크게 벗어나지 않는다.
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateShort(date: Date): string {
  const month = MONTH_ABBR[date.getMonth()];
  const isThisYear = date.getFullYear() === new Date().getFullYear();
  return isThisYear ? `${month} ${date.getDate()}` : `${date.getFullYear()} ${month}`;
}

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
