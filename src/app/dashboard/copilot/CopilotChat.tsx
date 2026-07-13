"use client";

import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Which equipment has no customer assigned?",
  "Are there any duplicate IP addresses?",
  "Which warranties are expiring soon?",
  "How many customers are active vs suspended?",
];

export default function CopilotChat({ organizationId }: { organizationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendQuestion(question: string) {
    if (!question.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, question }),
      });
      const json = await res.json();
      const answer = res.ok ? json.answer : json.error ?? "Something went wrong.";
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong reaching the Copilot." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="btn-secondary text-sm"
              onClick={() => sendQuestion(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "text-right" : ""}
          >
            <div
              className="inline-block max-w-[85%] px-4 py-2.5 rounded-lg text-sm text-left"
              style={{
                background: m.role === "user" ? "var(--bg-raised)" : "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <p className="mono text-xs" style={{ color: "var(--signal)" }}>
            thinking…
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendQuestion(input);
        }}
        className="mt-6 flex gap-2"
      >
        <input
          className="input-field"
          placeholder="Ask a question about your operations…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
