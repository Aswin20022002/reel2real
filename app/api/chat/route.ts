import { NextResponse } from "next/server";
import { allCatalogPlaces } from "@/lib/catalog";
import { tripSummaryForLLM } from "@/lib/copilot";
import { llmConfigured, llmJSON } from "@/lib/llm";
import type { Action, Category, Place, Trip } from "@/lib/types";

export const maxDuration = 30;

const SYSTEM = `You are the Copilot inside a group trip planner for Indian travellers. You edit an itinerary on request.
Reply ONLY with JSON: {"reply": string (max 3 short sentences, plain language), "actions": Action[]}.
Action is one of:
{"type":"remove","placeId": string}
{"type":"add","catalogId": string}  // id from CATALOG below
{"type":"add","name": string,"category":"sight|nature|food|adventure|culture|shopping|wellness","area": string,"lat": number,"lng": number,"description": string,"durationMin": number,"costINR": number}
{"type":"move","placeId": string,"day": number} // 1-based day number
{"type":"swap","removeId": string,"catalogId": string}
{"type":"setPace","pace":"relaxed|balanced|packed"}
Only use placeIds that appear in the itinerary. Prefer catalog ids when a matching place exists. If the user only asks a question, return no actions.
When a place is closed or it rains, suggest alternatives in the reply and include a swap action only if the user clearly asked to change it.`;

export async function POST(req: Request) {
  if (!llmConfigured()) return NextResponse.json({ error: "no-llm" }, { status: 501 });
  try {
    const { message, trip, history } = (await req.json()) as { message: string; trip: Trip; history?: { role: string; text: string }[] };
    const cat = new Map(allCatalogPlaces().map((p) => [p.id, p]));
    const catalog = allCatalogPlaces().filter((p) => p.category !== "stay" && !trip.places[p.id]).map((p) => `${p.id}: ${p.name} (${p.area}, ${p.category}${p.indoor ? ", indoor" : ""}, ₹${p.costINR})`).join("\n");
    const user = `ITINERARY\n${tripSummaryForLLM(trip)}\n\nCATALOG\n${catalog}\n\nRECENT CHAT\n${(history ?? []).slice(-4).map((h) => `${h.role}: ${h.text}`).join("\n")}\n\nUSER: ${message}`;
    const out = await llmJSON<{ reply?: string; actions?: Record<string, unknown>[] }>(SYSTEM, user);
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
    return NextResponse.json({ reply: out.reply ?? "Done.", actions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "llm-failed" }, { status: 502 });
  }
}
