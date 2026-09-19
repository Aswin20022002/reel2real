/** Thin OpenAI-compatible client. Works with Groq (default), OpenAI, Together, OpenRouter, etc. */
export const llmConfigured = () => !!process.env.LLM_API_KEY;

const base = () => (process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
const model = () => process.env.LLM_MODEL || "llama-3.3-70b-versatile";

export async function llmJSON<T = unknown>(system: string, user: string, timeoutMs = 25000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base()}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LLM_API_KEY}` },
      body: JSON.stringify({
        model: model(),
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(text.replace(/^```json|```$/g, "").trim()) as T;
  } finally {
    clearTimeout(t);
  }
}

/** Speech-to-text for reel audio (Groq/OpenAI whisper-compatible). */
export async function transcribe(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file, file.name || "reel.mp4");
  fd.append("model", process.env.LLM_WHISPER_MODEL || "whisper-large-v3-turbo");
  fd.append("response_format", "json");
  const res = await fetch(`${base()}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}` }, body: fd });
  if (!res.ok) throw new Error(`Transcription ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return String(data.text ?? "");
}
