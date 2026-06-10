"use client";

import { useMemo, useRef, useState } from "react";

type ChatMessage = {
  role: "visitor" | "bot";
  content: string;
};

type ChatWidgetProps = {
  slug: string;
  botName: string;
  greeting: string;
  brandColor: string;
};

export function ChatWidget({ slug, botName, greeting, brandColor }: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "bot", content: greeting }]);
  const [sessionId, setSessionId] = useState<string>();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  const canSend = input.trim().length > 0 && !isSending;
  const sourceUrl = useMemo(() => (typeof window === "undefined" ? undefined : window.location.href), []);

  async function sendMessage(messageOverride?: string) {
    const message = (messageOverride ?? input).trim();
    if (!message || isSending) return;

    setInput("");
    setError(undefined);
    setIsSending(true);
    setMessages((current) => [...current, { role: "visitor", content: message }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, sessionId, message, sourceUrl }),
      });
      const data = (await response.json()) as { sessionId?: string; reply?: string; error?: string };

      if (!response.ok || !data.reply || !data.sessionId) {
        throw new Error(data.error ?? "Chat failed");
      }

      setSessionId(data.sessionId);
      setMessages((current) => [...current, { role: "bot", content: data.reply ?? "Saved." }]);
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The chat could not send. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="flex min-h-[calc(100vh-8rem)] flex-col rounded-lg border border-[#d9ded2] bg-white shadow-sm md:min-h-[680px]">
      <div className="flex items-center justify-between border-b border-[#e5e9df] px-4 py-3">
        <div>
          <h1 className="font-semibold">{botName}</h1>
          <p className="text-sm text-[#657064]">Hosted real estate assistant</p>
        </div>
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: brandColor }}>
          Active
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#f7f9f4] p-4">
        {messages.map((message, index) => (
          <div
            className={message.role === "bot" ? "max-w-[86%] rounded-lg bg-white px-4 py-3 shadow-sm" : "ml-auto max-w-[86%] rounded-lg px-4 py-3 text-white"}
            key={`${message.role}-${index}-${message.content}`}
            style={message.role === "visitor" ? { backgroundColor: brandColor } : undefined}
          >
            <p className="mb-1 font-mono text-xs uppercase opacity-60">{message.role === "bot" ? "Assistant" : "You"}</p>
            <p className="text-sm leading-6">{message.content}</p>
          </div>
        ))}
        {isSending ? <div className="max-w-[86%] rounded-lg bg-white px-4 py-3 text-sm text-[#657064] shadow-sm">Typing...</div> : null}
      </div>

      <div className="border-t border-[#e5e9df] bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {error ? <p className="mb-2 rounded-md bg-[#fff1eb] px-3 py-2 text-sm text-[#8a3518]">{error}</p> : null}
        {!sessionId ? (
          <div className="mb-2 flex flex-wrap gap-2">
            <button className="rounded-full border border-[#cbd5c7] px-3 py-1.5 text-sm font-medium" onClick={() => sendMessage("I want to buy a home")} type="button">
              I want to buy
            </button>
            <button className="rounded-full border border-[#cbd5c7] px-3 py-1.5 text-sm font-medium" onClick={() => sendMessage("I want to sell my home")} type="button">
              I want to sell
            </button>
          </div>
        ) : null}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <input
            className="min-h-12 flex-1 rounded-md border border-[#cbd5c7] px-3 outline-none focus:border-[#2861a8]"
            disabled={isSending}
            maxLength={2000}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type your answer..."
            ref={inputRef}
            value={input}
          />
          <button className="min-h-12 rounded-md px-4 font-semibold text-white disabled:opacity-60" disabled={!canSend} style={{ backgroundColor: brandColor }} type="submit">
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
