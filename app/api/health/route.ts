import { NextResponse } from "next/server";
import { llmJSON } from "@/lib/llm";

export const maxDuration = 60;

// Setup checker. Open /api/health to see which keys the server can see (values are never shown).
// Open /api/health?test=1 to also make one tiny live call to Google Places and to the AI provider(s) and see the exact error, if any.
export async function GET(req: Request) {
  const has = (k: string) => !!(process.env[k] && process.env[k]!.trim());
  const out: Record<string, unknown> = {
    version: "0.4",
    keysVisibleToServer: {
      LLM_API_KEY: has("LLM_API_KEY"), LLM_BASE_URL: has("LLM_BASE_URL"), LLM_MODEL: has("LLM_MODEL"),
      LLM2_API_KEY: has("LLM2_API_KEY"), GOOGLE_PLACES_API_KEY: has("GOOGLE_PLACES_API_KEY"), FLICKR_API_KEY: has("FLICKR_API_KEY"),
      SUPABASE_URL: has("NEXT_PUBLIC_SUPABASE_URL"), SUPABASE_ANON_KEY: has("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    },
  };
  if (new URL(req.url).searchParams.get("test")) {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) out.google = { ok: false, detail: "GOOGLE_PLACES_API_KEY is not set on the server" };
    else {
      try {
        const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key.trim(), "X-Goog-FieldMask": "places.displayName,places.rating" },
          body: JSON.stringify({ textQuery: "Umiam Lake Shillong", maxResultCount: 1 }),
        });
        const t = await r.text();
        let msg = t.slice(0, 300);
        try { const j = JSON.parse(t); msg = j.error?.message ?? (j.places?.[0] ? `found ${j.places[0].displayName?.text}, rating ${j.places[0].rating}` : "no place found"); } catch { /* raw text */ }
        out.google = { ok: r.ok, status: r.status, detail: msg };
      } catch (e) { out.google = { ok: false, detail: (e as Error).message }; }
    }
    try { out.ai = { ok: true, reply: await llmJSON<{ ok: boolean }>('Reply with exactly this JSON: {"ok": true}', "ping", 20000) }; }
    catch (e) { out.ai = { ok: false, detail: (e as Error).message.slice(0, 400) }; }
  }
  return NextResponse.json(out);
}
