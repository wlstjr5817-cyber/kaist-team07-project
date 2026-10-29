// 기본 감정 목록. 감정 태그는 항상 이 중 하나 + 강도(1~5)로 저장한다.
export const BASE_EMOTIONS = [
  "기쁨",
  "설렘",
  "평온",
  "감사",
  "슬픔",
  "외로움",
  "불안",
  "분노",
  "지침",
  "부끄러움",
] as const;

export type BaseEmotion = (typeof BASE_EMOTIONS)[number];
