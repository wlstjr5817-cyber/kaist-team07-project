# Talk-Journal 프로토타입 (김한솜)

말로 대화하듯 일기를 쓰면서 내 감정을 더 잘 알아차리게 해 주는 앱의 프로토타입.
기획서: [`docs/specs/김한솜-talk-journal.md`](../../docs/specs/김한솜-talk-journal.md)

## 실행 방법

Node.js(LTS)가 필요하다.

```bash
cd prototypes/김한솜
npm install
npm run dev
```

브라우저에서 http://localhost:3000 을 연다.

## 이 프로토타입에 있는 것

- 친구가 먼저 말을 거는 채팅 화면 (타이핑 입력)
- 감정을 단정하지 않고 "~인 것 같은데, 맞아?"로 확인하는 대화, 질문은 한 번에 하나
- 위험 신호(예: "끝내고 싶어")에 109 / 1577-0199 안내
- "오늘은 여기까지" → 일기 정리본 + 감정 태그(기본 감정 10개, 강도 1~5) 확인·수정 화면
- 원본 대화 펼쳐 보기

## 주의

- API 키 없이 동작하는 **가짜 친구(모의 AI)** 버전이다. 미리 써 둔 질문과 감정 단어 사전으로만 반응한다.
- 진짜 AI로 바꾸려면 `lib/friend/index.ts`의 `friend`를 Claude 구현으로 교체한다.
- 저장 버튼은 화면만 바뀌고 실제로 보관하지 않는다.

## 폴더 구조

- `components/TalkJournal.tsx` — 채팅 화면과 일기 확인 화면
- `lib/friend/mock.ts` — 가짜 친구 (질문, 공감 문장, 감정 단어 사전, 위험 신호 대응)
- `lib/friend/emotions.ts` — 기본 감정 목록
- `lib/copy.ts` — 화면 문구 모음
