import Groq from "groq-sdk";

let client: Groq | null = null;

export function getGroqClient() {
  if (!client) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error(
        "GROQ_API_KEY is not set. Add it to your environment (see .env.example)."
      );
    }
    client = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 25000, maxRetries: 1 });
  }
  return client;
}

/**
 * Calls Groq and asks for strict JSON back. Throws if the model returns
 * something that doesn't parse — callers should catch and surface a
 * user-facing error rather than silently importing garbage data.
 */
export async function groqJson<T>(params: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}): Promise<T> {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model: params.model ?? process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
    temperature: params.temperature ?? 0.1,
    max_completion_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Groq returned an empty response.");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      "Groq returned a response that was not valid JSON. Try again."
    );
  }
}
