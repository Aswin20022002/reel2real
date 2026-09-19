import { NextResponse } from "next/server";
import { allCatalogPlaces } from "@/lib/catalog";
import { tripSummaryForLLM } from "@/lib/copilot";
import { centroid } from "@/lib/geo";
import { llmConfigured, llmJSON } from "@/lib/llm";
import type { Action, Category, CopilotOption, Place, Trip } from "@/lib/types";

export const maxDuration = 45;

const SYSTEM = `You are the Copilot inside a group trip planner for Indian travellers. You edit the itinerary and you answer travel questions with concrete options.
Reply ONLY with a JSON object: {"reply": string, "actions": Action[], "find": {"kind": "stay|food|sight|shopping|other", "query": string} | null, "options": Option[]}.
- "reply": max 3 short sentences, plain language, no markdown.
- Action is one of:
  {"type":"remove","placeId": string}
  {"type":"add","catalogId": string}
  {"type":"add","name": string,"category":"sight|nature|food|adventure|culture|shopping|wellness","area": string,"lat": number,"lng": number,"description": string,"durationMin": number,"costINR": number}
  {"type":"move","placeId": string,"day": number}
  {"type":"swap","removeId": string,"catalogId": string}
  {"type":"setPace","pace":"relaxed|balanced|packed"}
- Only use placeIds that appear in the itinerary. Prefer catalog ids when a matching place exists.
- If the user asks for recommendations or a list (hotels, homestays, restaurants, cafes, things to do, shopping), set "find" with a short Google-Maps-style query that includes the town or area near the itinerary (example: "best homestays in Sohra Meghalaya"), and ALSO fill "options" with up to 5 real, well-known places you are confident exist near the itinerary, each: {"name","kind","area","note" (why it fits, max 14 words),"price" (approximate, e.g. "₹2,000-3,500 per night"),"lat","lng"}. Never invent a place; if you are not sure, return fewer options and say so in "reply".
- If the user only asks to change the plan, return "find": null and "options": [].
- Never refuse a travel question by pointing to another tab; give options instead.`;

interface Raw { reply?: string; actions?: Record<string, unknown>[]; find?: { kind?: string; query?: string } | null; options?: Record<string, unknown>[] }

const KINDS = ["stay", "food", "sight", "shopping", "other"] as const;
const PRICE = ["", "₹", "₹₹", "₹₹₹", "₹₹₹₹"];
const asKind = (k: unknown): CopilotOption["kind"] => ((KINDS as readonly string[]).includes(String(k)) ? (String(k) as CopilotOption["kind"]) : "other");

async function googleOptions(query: string, kind: CopilotOption["kind"], near: { lat: number; lng: number }): Promise<CopilotOption[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.formattedAddress,places.location,places.googleMapsUri,places.editorialSummary,places.businessStatus",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 6, regionCode: "IN", locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 40000 } } }),
  });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.places ?? [])
    .filter((p: { businessStatus?: string }) => !p.businessStatus || p.businessStatus === "OPERATIONAL")
    .slice(0, 5)
    .map((p: { displayName?: { text?: string }; rating?: number; userRatingCount?: number; priceLevel?: string; formattedAddress?: string; location?: { latitude: number; longitude: number }; googleMapsUri?: string; editorialSummary?: { text?: string } }) => {
      const lvl = ["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"].indexOf(p.priceLevel ?? "") + 1;
      return {
        name: p.displayName?.text ?? "Place", kind, area: String(p.formattedAddress ?? "").split(",").slice(0, 2).join(",").trim(), note: p.editorialSummary?.text,
        rating: p.rating, ratingCount: p.userRatingCount, price: lvl ? PRICE[lvl] : undefined, lat: p.location?.latitude, lng: p.location?.longitude, mapsUrl: p.googleMapsUri, verified: true,
      } as CopilotOption;
    });
}

export async function POST(req: Request) {
  if (!llmConfigured()) return NextResponse.json({ error: "no-llm", detail: "LLM_API_KEY is not set on the server." }, { status: 501 });
  try {
    const { message, trip, history } = (await req.json()) as { message: string; trip: Trip; history?: { role: string; text: string }[] };
    const cat = new Map(allCatalogPlaces().map((p) => [p.id, p]));
    const catalog = allCatalogPlaces().filter((p) => p.category !== "stay" && !trip.places[p.id]).map((p) => `${p.id}: ${p.name} (${p.area}, ${p.category}${p.indoor ? ", indoor" : ""}, ₹${p.costINR})`).join("\n");
    const user = `ITINERARY\n${tripSummaryForLLM(trip)}\n\nCATALOG\n${catalog}\n\nRECENT CHAT\n${(history ?? []).slice(-4).map((h) => `${h.role}: ${h.text}`).join("\n")}\n\nUSER: ${message}`;
    const out = await llmJSON<Raw>(SYSTEM, user, 30000);

    const actions: Action[] = [];
    for (const a of out.actions ?? []) {
      const type = a.type;
      if (type === "remove" && typeof a.placeId === "string" && trip.places[a.placeId]) actions.push({ type: "remove", placeId: a.placeId });
      else if (type === "add" && typeof a.catalogId === "string" && cat.has(a.catalogId)) {
        const { aliases, iconic, ...rest } = cat.get(a.catalogId)!; void aliases; void iconic;
        actions.push({ type: "add", place: { ...rest, source: "copilot" } });
      } else if (type === "add" && typeof a.name === "string" && typeof a.lat === "number" && typeof a.lng === "number") {
        const place: Place = {
          id: `ai-${String(a.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`, name: String(a.name), category: (String(a.category) as Category) || "sight",
          area: String(a.area ?? ""), lat: a.lat, lng: a.lng, description: String(a.description ?? ""), durationMin: Number(a.durationMin) || 90, costINR: Number(a.costINR) || 0, tags: [], source: "copilot",
        };
        actions.push({ type: "add", place });
      } else if (type === "move" && typeof a.placeId === "string" && trip.places[a.placeId] && typeof a.day === "number") actions.push({ type: "move", placeId: a.placeId, dayIndex: Math.max(0, Math.round(a.day) - 1) });
      else if (type === "swap" && typeof a.removeId === "string" && trip.places[a.removeId] && typeof a.catalogId === "string" && cat.has(a.catalogId)) {
        const { aliases, iconic, ...rest } = cat.get(a.catalogId)!; void aliases; void iconic;
        actions.push({ type: "swap", removeId: a.removeId, place: { ...rest, source: "copilot" } });
      } else if (type === "setPace" && ["relaxed", "balanced", "packed"].includes(String(a.pace))) actions.push({ type: "setPace", pace: a.pace as "relaxed" | "balanced" | "packed" });
    }

    // Recommendations: prefer live Google Places results; otherwise the model's own suggestions, clearly marked unverified.
    let options: CopilotOption[] = [];
    const pts = Object.values(trip.places).filter((p) => p.category !== "stay");
    const near = pts.length ? centroid(pts) : { lat: 20.6, lng: 78.9 };
    const find = out.find && out.find.query ? { kind: asKind(out.find.kind), query: String(out.find.query).slice(0, 120) } : null;
    if (find) {
      try { options = await googleOptions(find.query, find.kind, near); } catch (e) { console.error(e); }
    }
    if (!options.length) {
      options = (out.options ?? []).slice(0, 5).filter((o) => typeof o.name === "string").map((o) => ({
        name: String(o.name), kind: asKind(o.kind ?? find?.kind), area: o.area ? String(o.area) : undefined, note: o.note ? String(o.note) : undefined, price: o.price ? String(o.price) : undefined,
        lat: typeof o.lat === "number" ? o.lat : undefined, lng: typeof o.lng === "number" ? o.lng : undefined, verified: false,
      }));
    }
    return NextResponse.json({ reply: out.reply ?? "Done.", actions, options });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "llm-failed", detail: String((e as Error).message).slice(0, 200) }, { status: 502 });
  }
}
