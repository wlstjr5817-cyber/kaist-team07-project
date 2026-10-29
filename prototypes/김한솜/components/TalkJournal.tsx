"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import {
  BASE_EMOTIONS,
  friend,
  type BaseEmotion,
  type ChatMessage,
  type DiaryResult,
  type EmotionTag,
} from "@/lib/friend";

type Phase = "chat" | "summarizing" | "review" | "saved";

export default function TalkJournal() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { role: "friend", text: friend.greet() },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [phase, setPhase] = useState<Phase>("chat");
  const [result, setResult] = useState<DiaryResult | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const hasMyTurn = messages.some((m) => m.role === "me");

  async function send() {
    const text = draft.trim();
    if (!text || thinking) return;
    const next: ChatMessage[] = [...messages, { role: "me", text }];
    setMessages(next);
    setDraft("");
    setThinking(true);
    const reply = await friend.reply(next);
    setMessages([...next, { role: "friend", text: reply }]);
    setThinking(false);
  }

  async function finish() {
    setPhase("summarizing");
    setResult(await friend.summarize(messages));
    setPhase("review");
  }

  function restart() {
    setMessages([{ role: "friend", text: friend.greet() }]);
    setResult(null);
    setPhase("chat");
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-xl flex-col">
      <header className="flex items-center justify-between px-4 pt-5 pb-3">
        <h1 className="text-lg font-semibold">{copy.appName}</h1>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">
          {copy.mockBadge}
        </span>
      </header>

      {phase === "chat" || phase === "summarizing" ? (
        <>
          <main className="flex-1 space-y-3 overflow-y-auto px-4 py-2">
            {messages.map((m, i) => (
              <Bubble key={i} message={m} />
            ))}
            {thinking && <Bubble message={{ role: "friend", text: copy.friendTyping }} muted />}
            {phase === "summarizing" && (
              <p className="py-4 text-center text-sm text-muted">{copy.summarizing}</p>
            )}
            <div ref={bottomRef} />
          </main>

          <footer className="space-y-2 border-t border-line px-4 pt-3 pb-4">
            <div className="flex gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // 한글 입력 중(조합 중) Enter는 무시
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={copy.inputPlaceholder}
                rows={2}
                disabled={phase !== "chat"}
                className="flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent"
              />
              <button
                onClick={send}
                disabled={!draft.trim() || thinking || phase !== "chat"}
                className="self-end rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
              >
                {copy.send}
              </button>
            </div>
            <button
              onClick={finish}
              disabled={!hasMyTurn || thinking || phase !== "chat"}
              className="w-full rounded-2xl border border-line py-2.5 text-sm text-muted hover:bg-surface disabled:opacity-40"
            >
              {copy.finish}
            </button>
            <p className="text-center text-[11px] leading-relaxed text-muted">{copy.disclaimer}</p>
          </footer>
        </>
      ) : (
        result && (
          <Review
            result={result}
            transcript={messages}
            saved={phase === "saved"}
            onChange={setResult}
            onSave={() => setPhase("saved")}
            onBack={() => setPhase("chat")}
            onRestart={restart}
          />
        )
      )}
    </div>
  );
}

function Bubble({ message, muted }: { message: ChatMessage; muted?: boolean }) {
  const mine = message.role === "me";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
          mine ? "rounded-br-md bg-accent text-white" : "rounded-bl-md bg-surface"
        } ${muted ? "text-muted" : ""}`}
      >
        {message.text}
      </p>
    </div>
  );
}

function Review({
  result,
  transcript,
  saved,
  onChange,
  onSave,
  onBack,
  onRestart,
}: {
  result: DiaryResult;
  transcript: ChatMessage[];
  saved: boolean;
  onChange: (r: DiaryResult) => void;
  onSave: () => void;
  onBack: () => void;
  onRestart: () => void;
}) {
  const unused = BASE_EMOTIONS.filter((e) => !result.emotions.some((t) => t.name === e));

  function setEmotions(emotions: EmotionTag[]) {
    onChange({ ...result, emotions });
  }

  return (
    <main className="flex-1 space-y-6 overflow-y-auto px-4 pb-8">
      <section className="space-y-2">
        <h2 className="font-semibold">{copy.reviewTitle}</h2>
        <p className="text-xs text-muted">{copy.reviewHint}</p>
        <textarea
          value={result.diary}
          onChange={(e) => onChange({ ...result, diary: e.target.value })}
          rows={8}
          disabled={saved}
          className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-accent"
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">{copy.emotionsTitle}</h2>
        <p className="text-xs text-muted">{copy.emotionsHint}</p>
        <ul className="space-y-2">
          {result.emotions.map((tag, i) => (
            <li key={tag.name} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-2.5">
              <span className="w-16 text-[15px] font-medium">{tag.name}</span>
              <span className="text-xs text-muted">{copy.intensity}</span>
              <div className="flex gap-1">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    disabled={saved}
                    aria-label={`${copy.intensity} ${n}`}
                    onClick={() =>
                      setEmotions(result.emotions.map((t, j) => (j === i ? { ...t, intensity: n } : t)))
                    }
                    className={`h-5 w-5 rounded-full ${n <= tag.intensity ? "bg-accent" : "bg-line"}`}
                  />
                ))}
              </div>
              {!saved && (
                <button
                  onClick={() => setEmotions(result.emotions.filter((_, j) => j !== i))}
                  className="ml-auto text-xs text-muted hover:text-foreground"
                >
                  {copy.remove}
                </button>
              )}
            </li>
          ))}
        </ul>
        {!saved && unused.length > 0 && (
          <select
            value=""
            onChange={(e) =>
              setEmotions([...result.emotions, { name: e.target.value as BaseEmotion, intensity: 3 }])
            }
            className="rounded-2xl border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">{copy.addEmotion}</option>
            {unused.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        )}
      </section>

      <details className="rounded-2xl border border-line px-4 py-3">
        <summary className="cursor-pointer text-sm text-muted">{copy.showTranscript}</summary>
        <div className="mt-3 space-y-2">
          {transcript.map((m, i) => (
            <Bubble key={i} message={m} />
          ))}
        </div>
      </details>

      {saved ? (
        <div className="space-y-3">
          <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">{copy.saved}</p>
          <button onClick={onRestart} className="w-full rounded-2xl bg-accent py-3 font-medium text-white">
            {copy.newChat}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={onBack} className="flex-1 rounded-2xl border border-line py-3 text-sm text-muted">
            {copy.backToChat}
          </button>
          <button onClick={onSave} className="flex-[2] rounded-2xl bg-accent py-3 font-medium text-white">
            {copy.save}
          </button>
        </div>
      )}
    </main>
  );
}
