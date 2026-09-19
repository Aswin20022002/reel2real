/** Thin OpenAI-compatible client. Works with Groq (default), OpenAI, Together, OpenRouter, etc. */
export const llmConfigured = () => !!process.env.LLM_API_KEY;

const base = () => (process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");

/**
 * Model IDs change often (Groq retired llama-3.3-70b-versatile on 16 Aug 2026). We try LLM_MODEL first if set,
 * then a list of current models, and remember whichever one works.
 */
const isGemini = () => /googleapis\.com/.test(base()) || process.env.LLM_PROVIDER === "gemini";
const FALLBACK_MODELS = () => (isGemini() ? ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash-lite"] : ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"]);
let working: string | undefined;
const candidates = () => [...new Set([working, process.env.LLM_MODEL, ...FALLBACK_MODELS()].filter(Boolean) as string[])];

function parseLooseJson<T>(raw: string): T {
  let t = raw.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```json|```/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t) as T;
}

async function call(model: string, system: string, user: string, json: boolean, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${base()}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LLM_API_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        ...(json ? { response_format: { type: "json_object" } } : {}),
        ...(model.includes("gpt-oss") || model.startsWith("gemini") ? { reasoning_effort: "low" } : {}),
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
      signal: ctrl.signal,
    });
  } finally { clearTimeout(timer); }
}

export async function llmJSON<T = unknown>(system: string, user: string, timeoutMs = 30000): Promise<T> {
  let lastErr = "no model tried";
  for (const model of candidates()) {
    for (const useJsonMode of [true, false]) {
      try {
        const res = await call(model, system, user, useJsonMode, timeoutMs);
        if (res.ok) {
          const data = await res.json();
          const text: string = data.choices?.[0]?.message?.content ?? "";
          const parsed = parseLooseJson<T>(text);
          working = model;
          return parsed;
        }
        const body = (await res.text()).slice(0, 240);
        lastErr = `${model}: ${res.status} ${body}`;
        if (res.status === 401 || res.status === 403) throw new Error(`API key rejected (${res.status}). Check LLM_API_KEY.`);
        // 400 may mean the model doesn't support JSON mode: retry once without it; anything else moves to the next model
        if (!(res.status === 400 && useJsonMode && /response_format|json/i.test(body))) break;
      } catch (e) {
        if ((e as Error).message.startsWith("API key rejected")) throw e;
        lastErr = `${model}: ${(e as Error).message}`;
        break;
      }
    }
  }
  throw new Error(lastErr);
}

/**
 * Speech-to-text for reel audio.
 * - Groq / OpenAI-style providers: Whisper endpoint.
 * - Gemini: audio is sent to the chat endpoint as input_audio (WAV) and transcribed by the model, so one Gemini key covers everything.
 * - Optional override: TRANSCRIBE_API_KEY (+ TRANSCRIBE_BASE_URL) to use Whisper on a different provider than the chat model.
 */
export async function transcribe(file: File): Promise<string> {
  const tKey = process.env.TRANSCRIBE_API_KEY;
  if (isGemini() && !tKey) {
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const res = await fetch(`${base()}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LLM_API_KEY}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "gemini-2.5-flash",
        messages: [{ role: "user", content: [
          { type: "text", text: "Transcribe the speech in this audio verbatim, in the language it is spoken. Keep place names exactly as spoken. Return only the transcript text, nothing else." },
          { type: "input_audio", input_audio: { data: b64, format: "wav" } },
        ] }],
      }),
    });
    if (!res.ok) throw new Error(`Transcription ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return String(data.choices?.[0]?.message?.content ?? "").trim();
  }
  const url = (process.env.TRANSCRIBE_BASE_URL || (isGemini() ? "https://api.groq.com/openai/v1" : base())).replace(/\/$/, "");
  const fd = new FormData();
  fd.append("file", file, file.name || "reel.wav");
  fd.append("model", process.env.LLM_WHISPER_MODEL || "whisper-large-v3-turbo");
  fd.append("response_format", "json");
  const res = await fetch(`${url}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${tKey || process.env.LLM_API_KEY}` }, body: fd });
  if (!res.ok) throw new Error(`Transcription ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return String(data.text ?? "");
}
