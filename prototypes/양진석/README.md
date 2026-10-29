# 말로일기 — 양진석 HW6 프로토타입

기존 말로일기의 내 일기·사진·기억 찾기·설정을 유지하면서 P0 음성 작성 흐름을 추가한 모바일 웹앱입니다.

- 앱: https://malro-diary.jinseokyang.chatgpt.site/ (기존 본인 전용 접근 권한 유지)
- 명세: ../../docs/specs/양진석-voice-diary.md
- 검증과 아직 남은 본인 검사: VALIDATION.md

## 사용 흐름

말로 일기 쓰기 → 3분 이내 구간을 자유롭게 이어 녹음 → 초안 확인·수정 → 일기 저장 → 기존 상세에서 사진 추가 → 기억 찾기에서 본문 단어·날짜로 검색.

새 녹음은 영구 저장하지 않습니다. 과거에 저장한 음성·사진은 유지합니다. 앞서 별도 P0 화면에서 저장한 글은 기존 보관함에 한 번 연결하며, 이미 수정한 기록을 덮어쓰지 않습니다. 개인 기록은 같은 기기·브라우저에 저장됩니다.

## 실행과 검사

Node.js 22 이상에서 이 폴더를 열고 실행합니다.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run preview:cloud
```

미리보기는 http://localhost:8791/?selftest=1 입니다. 개인 기록과 분리되며 API 키를 주입하지 않으므로 글 쓰기·사진·검색과 서버 미연결 동작을 확인할 수 있습니다. 실제 AI 음성 작성은 위 배포 주소에서 확인합니다. 배포 앱의 검사 모드는 /?selftest=1 이며 말로 일기 쓰기를 누르면 /hw6/index.html?compose=1&test=1 로 연결됩니다.

AI API만 로컬에서 시험하려면 `.env.example`을 `.env`로 복사해 본인의 키를 넣고 `npm run prototype`을 실행합니다. 이는 작성 화면과 API를 확인하는 개발 보조 서버이며 전체 앱 검증은 위 빌드 미리보기를 사용합니다. `.env`, API 키와 node_modules는 Git에 올리지 않습니다. 배포 서버는 기존 Secret의 gpt-transcribe와 gpt-6-luna를 사용합니다.

## 코드

- `src/`: 기존 목록·사진·검색·설정과 영속 저장
- `public/hw6/`: 구간 녹음·초안 편집·기존 보관함 연결
- `worker/`: 실제 음성 인식·문장 정리·검색 API
- `scripts/build-cloud.mjs`: 전체 앱과 Worker 빌드
- `tests/`: 기존 기능과 P0를 포함한 104개 검사

2026-10-29 본인 휴대폰 Safari에서 수동 검사 3개를 실행하고 모두 통과했다고 양진석이 확인했습니다. 구체적인 기록은 명세서 9절과 VALIDATION.md에 있습니다.
