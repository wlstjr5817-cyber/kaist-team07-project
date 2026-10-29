// 가짜 친구: 진짜 AI 없이, 미리 써 둔 질문과 단어 사전으로만 반응한다.
// 화면 흐름을 시험하기 위한 것이라 대화 품질은 진짜 AI와 다르다.
import type { BaseEmotion } from "./emotions";
import type { DiaryResult, EmotionTag, Friend } from "./types";

const KEYWORDS: Record<BaseEmotion, string[]> = {
  기쁨: ["기뻤", "기쁘", "좋았", "행복", "신나", "신났", "즐거", "웃었"],
  설렘: ["설레", "설렜", "기대", "두근"],
  평온: ["편안", "평온", "여유", "차분", "느긋"],
  감사: ["고마", "감사", "다행"],
  슬픔: ["슬프", "슬펐", "울었", "눈물", "속상"],
  외로움: ["외로", "쓸쓸", "혼자"],
  불안: ["불안", "걱정", "긴장", "초조", "무서", "떨렸", "떨려"],
  분노: ["화가", "화났", "짜증", "열받", "억울"],
  지침: ["피곤", "지쳤", "지쳐", "힘들", "녹초", "귀찮"],
  부끄러움: ["부끄", "창피", "민망", "쪽팔"],
};

const EMPATHY: Record<BaseEmotion, string> = {
  기쁨: "와, 듣는 나까지 기분이 좋아진다.",
  설렘: "두근두근한 게 여기까지 느껴져.",
  평온: "마음이 좀 놓이는 시간이었구나.",
  감사: "그런 순간이 있었다니 다행이다.",
  슬픔: "많이 속상했겠다.",
  외로움: "혼자인 것 같은 기분, 꽤 무겁지.",
  불안: "마음이 많이 조마조마했겠다.",
  분노: "그럴 만했네. 나라도 화났을 것 같아.",
  지침: "오늘 진짜 고생 많았다.",
  부끄러움: "얼굴 화끈해지는 순간이었겠다.",
};

const NEUTRAL_EMPATHY = ["그랬구나.", "응, 듣고 있어.", "그런 일이 있었구나."];

// 질문은 한 번에 하나만.
const FOLLOW_UPS = [
  "그때 어떤 장면이 제일 먼저 떠올라?",
  "그 순간 몸은 어땠어? 긴장되거나, 힘이 빠지거나 했어?",
  "그 일이 너한테 왜 그렇게 크게 느껴졌을까?",
  "그때 누가 옆에 있었어?",
  "오늘 중에 조금이라도 괜찮았던 순간도 있었어?",
  "지금 돌아보면, 그때의 너한테 뭐라고 말해주고 싶어?",
];

const CONFIRM = /^(응|어|맞아|맞는|그런 ?(것|거) ?같|그래|ㅇㅇ|웅)/;

const CRISIS = ["죽고 싶", "자살", "사라지고 싶", "살기 싫", "자해", "끝내고 싶"];

const SAFETY_REPLY =
  "그 말을 꺼내 줘서 고마워. 지금 정말 많이 힘든 것 같아서 걱정돼. " +
  "이건 혼자 버티지 않았으면 좋겠어. 지금 바로 이야기할 수 있는 곳이 있어: " +
  "자살예방상담전화 109, 정신건강위기상담 1577-0199 (24시간). " +
  "나는 상담을 대신할 수는 없지만, 여기서 계속 네 얘기를 들을게. 지금 옆에 연락할 수 있는 사람이 있어?";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function detectEmotions(text: string): BaseEmotion[] {
  const found = (Object.keys(KEYWORDS) as BaseEmotion[]).filter((emotion) =>
    KEYWORDS[emotion].some((word) => text.includes(word)),
  );
  // "안 좋았어"가 기쁨으로 잡히지 않게
  if (/안 ?좋|좋지 ?않/.test(text)) return found.filter((e) => e !== "기쁨");
  return found;
}

function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

export const mockFriend: Friend = {
  greet() {
    return "안녕! 오늘 하루 어땠어? 기억에 남는 순간 하나만 얘기해 줄래?";
  },

  async reply(history) {
    await wait(700);
    const myTurns = history.filter((m) => m.role === "me");
    const last = myTurns.at(-1)?.text.trim() ?? "";
    const turn = myTurns.length;

    if (CRISIS.some((word) => last.includes(word))) return SAFETY_REPLY;

    if (CONFIRM.test(last)) {
      return "그렇구나, 그 마음을 알아차린 것만으로도 의미 있어. 그 마음이 들게 한 건 뭐였던 것 같아?";
    }

    // 아직 확인하지 않은 감정이 보이면, 단정하지 않고 "맞아?"로 확인한다.
    const alreadyAsked = history
      .filter((m) => m.role === "friend")
      .map((m) => m.text)
      .join(" ");
    const fresh = detectEmotions(last).find((e) => !alreadyAsked.includes(`'${e}'`));
    if (fresh) {
      return `${EMPATHY[fresh]} 듣다 보니 '${fresh}'에 가까운 마음이었던 것 같은데, 맞아?`;
    }

    const empathy = NEUTRAL_EMPATHY[turn % NEUTRAL_EMPATHY.length];
    return `${empathy} ${FOLLOW_UPS[(turn - 1) % FOLLOW_UPS.length]}`;
  },

  async summarize(history) {
    await wait(1200);
    const mine = history
      .filter((m) => m.role === "me")
      .map((m) => m.text.trim())
      .filter((text) => text && !CONFIRM.test(text))
      .map((text) => (/[.!?~…]$/.test(text) ? text : `${text}.`));

    const counts = new Map<BaseEmotion, number>();
    for (const text of mine) {
      for (const emotion of detectEmotions(text)) {
        counts.set(emotion, (counts.get(emotion) ?? 0) + 1);
      }
    }
    const emotions: EmotionTag[] = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({
        name,
        intensity: Math.min(5, 2 + count) as EmotionTag["intensity"],
      }));

    const top = emotions[0]?.name;
    const closing = top
      ? `돌아보니 오늘 가장 크게 남은 마음은 '${top}'${hasBatchim(top) ? "이었다" : "였다"}.`
      : "오늘의 마음을 천천히 돌아본 하루였다.";

    const result: DiaryResult = {
      diary: `${mine.join(" ")}\n\n${closing}`,
      emotions,
    };
    return result;
  },
};
