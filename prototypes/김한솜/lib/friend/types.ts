import type { BaseEmotion } from "./emotions";

export type ChatMessage = {
  role: "friend" | "me";
  text: string;
};

export type EmotionTag = {
  name: BaseEmotion;
  intensity: 1 | 2 | 3 | 4 | 5;
};

export type DiaryResult = {
  diary: string;
  emotions: EmotionTag[];
};

// 대화 상대("친구")가 지켜야 할 약속.
// 지금은 가짜 친구(mock.ts)가 구현하고, API 키가 생기면 Claude 버전으로 바꿔 끼운다.
export interface Friend {
  greet(): string;
  reply(history: ChatMessage[]): Promise<string>;
  summarize(history: ChatMessage[]): Promise<DiaryResult>;
}
