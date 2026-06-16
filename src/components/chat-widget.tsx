"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { UTMInput } from "@/lib/channels";
import type { PropertyCard } from "@/lib/chat/retrieval";

type ChatMessage = {
  role: "visitor" | "bot";
  content: string;
  propertyCards?: PropertyCard[];
};

type ChatWidgetProps = {
  slug: string;
  channelKey?: string;
  widgetToken?: string;
  botName: string;
  greeting: string;
  brandColor: string;
  sourceUrl?: string;
  referrer?: string;
  utm?: UTMInput;
  compact?: boolean;
};

export function ChatWidget({ slug, channelKey, widgetToken, botName, greeting, brandColor, sourceUrl, referrer, utm, compact = false }: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "bot", content: greeting }]);
  const [sessionId, setSessionId] = useState<string>();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const canSend = input.trim().length > 0 && !isSending;
  const resolvedSourceUrl = useMemo(() => sourceUrl ?? (typeof window === "undefined" ? undefined : window.location.href), [sourceUrl]);
  const resolvedReferrer = useMemo(() => referrer ?? (typeof document === "undefined" ? undefined : document.referrer), [referrer]);

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
        body: JSON.stringify({ slug, channelKey, widgetToken, sessionId, message, sourceUrl: resolvedSourceUrl, referrer: resolvedReferrer, utm }),
      });
      const data = (await response.json()) as { sessionId?: string; reply?: string; error?: string; propertyCards?: PropertyCard[] };

      if (!response.ok || !data.reply || !data.sessionId) {
        throw new Error(data.error ?? "Chat failed");
      }

      setSessionId(data.sessionId);
      setMessages((current) => [...current, { role: "bot", content: data.reply ?? "Saved.", propertyCards: data.propertyCards }]);
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The chat could not send. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className={compact ? "flex h-screen min-h-[520px] flex-col bg-white" : "flex min-h-[calc(100vh-8rem)] flex-col rounded-lg border border-[#d9ded2] bg-white shadow-sm md:min-h-[680px]"}>
      <div className="flex items-center justify-between border-b border-[#e5e9df] px-4 py-3">
        <div>
          <h1 className="font-semibold">{botName}</h1>
          <p className="text-sm text-[#657064]">Hosted real estate assistant</p>
        </div>
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: brandColor }}>
          Active
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#f7f9f4] p-4" aria-live="polite">
        {messages.map((message, index) => (
          <div
            className={message.role === "bot" ? "max-w-[86%] rounded-lg bg-white px-4 py-3 shadow-sm" : "ml-auto max-w-[86%] rounded-lg px-4 py-3 text-white"}
            key={`${message.role}-${index}-${message.content}`}
            style={message.role === "visitor" ? { backgroundColor: brandColor } : undefined}
          >
            <p className="mb-1 font-mono text-xs uppercase opacity-60">{message.role === "bot" ? "Assistant" : "You"}</p>
            <p className="text-sm leading-6">{message.content}</p>
            {message.propertyCards?.length ? <PropertyCards cards={message.propertyCards} /> : null}
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
          <label className="sr-only" htmlFor={inputId}>Chat message</label>
          <input
            className="min-h-12 flex-1 rounded-md border border-[#cbd5c7] px-3 outline-none focus:border-[#2861a8]"
            disabled={isSending}
            id={inputId}
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
        <p className="mt-2 text-xs leading-5 text-[#657064]">
          AI-assisted intake only. Do not rely on this for legal, tax, mortgage, financial, or property advice. <a className="font-semibold text-[#2861a8]" href="/ai-disclaimer" target="_blank" rel="noreferrer">Review limits</a>.
        </p>
      </div>
    </section>
  );
}

function PropertyCards({ cards }: { cards: PropertyCard[] }) {
  return (
    <div className="mt-3 grid gap-2">
      {cards.map((card) => (
        <article className="rounded-md border border-[#d9ded2] bg-[#f7f9f4] p-3" key={card.id}>
          <div className="flex gap-3">
            {card.imageUrl ? <div aria-hidden className="h-16 w-20 rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${card.imageUrl})` }} /> : null}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5">{card.title}</p>
              {card.priceLabel || card.location ? <p className="mt-1 text-xs leading-5 text-[#657064]">{[card.priceLabel, card.location].filter(Boolean).join(" ? ")}</p> : null}
              {card.details ? <p className="text-xs leading-5 text-[#657064]">{card.details}</p> : null}
            </div>
          </div>
          {card.description ? <p className="mt-2 text-xs leading-5 text-[#455247]">{card.description}</p> : null}
          {card.listingUrl ? (
            <a className="mt-2 inline-flex text-xs font-semibold text-[#2861a8]" href={card.listingUrl} rel="noreferrer" target="_blank">
              Open listing
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}
