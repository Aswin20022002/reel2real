/**
 * Multi-provider LLM client with automatic fallback.
 *
 * Primary  : LLM_API_KEY  / LLM_BASE_URL  / LLM_MODEL   (any OpenAI-compatible API: Groq, Gemini, OpenAI...)
 * Fallback : LLM2_API_KEY / LLM2_BASE_URL / LLM2_MODEL  (optional second provider, used when the first fails or is rate-limited)
 *
 * Gemini's OpenAI-compatible base URL is https://generativelanguage.googleapis.com/v1beta/openai
 * Groq's is https://api.groq.com/openai/v1 (the default if a base URL is left empty).
 */
interface Provider { name: string; key: string; base: string; model?: string; gemini: boolean; whisperModel: string }

function providers(): Provider[] {
  const out: Provider[] = [];
  for (const p of ["LLM", "LLM2"]) {
    const key = process.env[`${p}_API_KEY`];
    if (!key) continue;
    const base = (process.env[`${p}_BASE_URL`] || "https://api.groq.com/openai/v1").replace(/\/$/, "");
    const gemini = /googleapis\.com/.test(base) || process.env[`${p}_PROVIDER`] === "gemini";
    let host = base;
    try { host = new URL(base).hostname.replace(/^api\./, ""); } catch { /* keep raw */ }
    out.push({ name: gemini ? "Gemini" : host, key, base, model: process.env[`${p}_MODEL`] || undefined, gemini, whisperModel: process.env[`${p}_WHISPER_MODEL`] || process.env.LLM_WHISPER_MODEL || "whisper-large-v3-turbo" });
  }
  return out;
}

export const llmConfigured = () => providers().length > 0;

/** Model IDs change often (Groq retired llama-3.3-70b-versatile on 16 Aug 2026), so each provider tries its configured model, then current ones. */
const FALLBACK_MODELS = (p: Provider) => (p.gemini ? ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash-lite"] : ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"]);
const working = new Map<string, string>();
const candidates = (p: Provider) => [...new Set([working.get(p.name), p.model, ...FALLBACK_MODELS(p)].filter(Boolean) as string[])];

function parseLooseJson<T>(raw: string): T {
  let t = raw.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```json|```/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t) as T;
}

async function call(p: Provider, model: string, system: string, user: string, json: boolean, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${p.base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
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
  const errors: string[] = [];
  for (const p of providers()) {
    let authFailed = false;
    for (const model of candidates(p)) {
      if (authFailed) break;
      for (const useJsonMode of [true, false]) {
        try {
          const res = await call(p, model, system, user, useJsonMode, timeoutMs);
          if (res.ok) {
            const data = await res.json();
            const parsed = parseLooseJson<T>(data.choices?.[0]?.message?.content ?? "");
            working.set(p.name, model);
            return parsed;
          }
          const body = (await res.text()).slice(0, 200);
          if (res.status === 401 || res.status === 403) { errors.push(`${p.name}: key rejected (${res.status})`); authFailed = true; break; }
          errors.push(`${p.name}/${model}: ${res.status} ${body.replace(/\s+/g, " ")}`);
          // 400 may just mean the model doesn't support JSON mode: retry once without it. Anything else: next model.
          if (!(res.status === 400 && useJsonMode && /response_format|json/i.test(body))) break;
        } catch (e) {
          errors.push(`${p.name}/${model}: ${(e as Error).message}`);
          break;
        }
      }
    }
  }
  throw new Error(errors.length ? errors.slice(-3).join(" | ") : "No AI provider is configured");
}

async function transcribeWith(p: Provider, file: File): Promise<string> {
  if (p.gemini) {
    // Gemini has no Whisper endpoint: send the WAV to the chat endpoint as audio input and ask for a verbatim transcript.
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const res = await fetch(`${p.base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
      body: JSON.stringify({
        model: working.get(p.name) || p.model || "gemini-2.5-flash",
        messages: [{ role: "user", content: [
          { type: "text", text: "Transcribe the speech in this audio verbatim, in the language it is spoken. Keep place names exactly as spoken. Return only the transcript text, nothing else." },
          { type: "input_audio", input_audio: { data: b64, format: "wav" } },
        ] }],
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
    const data = await res.json();
    return String(data.choices?.[0]?.message?.content ?? "").trim();
  }
  const fd = new FormData();
  fd.append("file", file, file.name || "reel.wav");
  fd.append("model", p.whisperModel);
  fd.append("response_format", "json");
  const res = await fetch(`${p.base}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${p.key}` }, body: fd });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  return String((await res.json()).text ?? "");
}

/** Speech-to-text. Whisper-style providers are tried first (dedicated speech models), then Gemini's audio input. */
export async function transcribe(file: File): Promise<string> {
  const list = providers().sort((a, b) => Number(a.gemini) - Number(b.gemini));
  const errors: string[] = [];
  for (const p of list) {
    try { return await transcribeWith(p, file); } catch (e) { errors.push(`${p.name}: ${(e as Error).message}`); }
  }
  throw new Error(`Transcription failed. ${errors.join(" | ")}`.slice(0, 400));
}
