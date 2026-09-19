import { allCatalogPlaces, getDestination } from "./catalog";
import { alternativesFor, inr, stops, suggestNearby } from "./itinerary";
import { balances, memberName, settlementPlan, totalSpent } from "./settle";
import { centroid, gmapsPlaceUrl, haversineKm } from "./geo";
import type { CopilotChip, CopilotOption, CopilotReply, Place, Trip } from "./types";

const GENERIC = new Set(["falls", "fall", "beach", "fort", "temple", "lake", "valley", "village", "river", "park", "national", "museum", "walk", "trek", "stay", "cafe", "café", "boat", "ride", "the", "and", "of", "in", "at", "hill", "hills", "view", "point", "street", "road"]);
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !GENERIC.has(w));

function scorePlace(text: string, p: Place & { aliases?: string[] }): number {
  const t = " " + text.toLowerCase().replace(/[^a-z0-9\s]/g, " ") + " ";
  let s = 0;
  for (const a of p.aliases ?? []) if (a.length > 3 && t.includes(" " + a.toLowerCase().replace(/[^a-z0-9\s]/g, " ") + " ")) s += 5;
  for (const w of words(p.name)) if (t.includes(" " + w + " ")) s += 2;
  return s;
}

export function findInTrip(trip: Trip, text: string): Place | undefined {
  return stops(trip).map((p) => ({ p, s: scorePlace(text, p) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)[0]?.p;
}
export function findInCatalog(trip: Trip, text: string): Place | undefined {
  return allCatalogPlaces()
    .filter((p) => p.category !== "stay" && !trip.places[p.id])
    .map((p) => ({ p, s: scorePlace(text, p) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)[0]?.p;
}

const HELP = "I can change the plan for you. Try: “remove Nohkalikai Falls”, “add Laitlum Canyons”, “make it more relaxed”, “Dawki is closed, what else?”, “it's going to rain on day 2”, “make it cheaper”, or “who owes whom?”.";

/** Offline rule-based Copilot. Used when no LLM key is configured, and as the safety net when the LLM call fails. */
export function localCopilot(trip: Trip, raw: string): CopilotReply {
  const text = raw.toLowerCase();
  const inTrip = findInTrip(trip, text);
  const dayMatch = text.match(/day\s*(\d)/);
  const dayIdx = dayMatch ? Number(dayMatch[1]) - 1 : -1;

  if (/(who owes|owe|balance|settle|expenses?|spent|split)/.test(text)) {
    const net = balances(trip);
    const plan = settlementPlan(trip);
    const lines = trip.members.map((m) => `${m.name}: ${net[m.id] > 0 ? "gets back" : net[m.id] < 0 ? "owes" : "settled"} ${inr(Math.abs(net[m.id]) / 100)}`);
    const pays = plan.length ? plan.map((t) => `${memberName(trip, t.fromId)} pays ${memberName(trip, t.toId)} ${inr(t.amount)}`).join("; ") : "Everyone is settled.";
    return { reply: `Group spend so far is ${inr(totalSpent(trip))}. ${lines.join(". ")}. Simplest way to settle: ${pays}. Open the Money tab to pay by UPI.` };
  }

  if (/(relax|slow|chill|less packed|fewer|lighter|too much)/.test(text)) {
    return { reply: "Switched to a relaxed pace: fewer hours per day, so the plan spreads over more days.", actions: [{ type: "setPace", pace: "relaxed" }] };
  }
  if (/(more places|packed|busy|squeeze|faster|shorter trip|fewer days)/.test(text)) {
    return { reply: "Switched to a packed pace: longer days, fewer nights.", actions: [{ type: "setPace", pace: "packed" }] };
  }

  if (/(closed|shut|not open|can't go|cannot go|unavailable|alternative|instead|plan b|swap|replace|something else)/.test(text) && inTrip) {
    const reason = /rain|wet/.test(text) ? "rain" : "closed";
    const alts = alternativesFor(trip, inTrip, reason, 3);
    if (!alts.length) return { reply: `I couldn't find a good replacement for ${inTrip.name} nearby. You can add any place from the Plan tab.` };
    const chips: CopilotChip[] = alts.map((a) => ({ label: `Swap in ${a.place.name}`, action: { type: "swap", removeId: inTrip.id, place: { ...a.place, source: "copilot" } } }));
    return { reply: `If ${inTrip.name} doesn't work, these are the closest good swaps: ${alts.map((a) => `${a.place.name} (${a.why})`).join("; ")}.`, chips };
  }

  if (/(remove|drop|skip|delete|cut|take out)/.test(text) && inTrip) {
    return { reply: `Removed ${inTrip.name} and re-ordered the day.`, actions: [{ type: "remove", placeId: inTrip.id }] };
  }

  if (/(add|include|visit|put|also)/.test(text)) {
    const cat = findInCatalog(trip, text);
    if (cat) return { reply: `Added ${cat.name} to the closest day and placed it where it adds the least driving.`, actions: [{ type: "add", place: { ...cat, source: "copilot" } }] };
  }

  if (/(rain|raining|wet|storm|monsoon)/.test(text)) {
    const outdoor = trip.days
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => dayIdx < 0 || i === dayIdx)
      .flatMap(({ d }) => d.placeIds.map((id) => trip.places[id]))
      .filter((p) => p && !p.indoor && p.category !== "food");
    const chips: CopilotChip[] = [];
    for (const p of outdoor.slice(0, 3)) {
      const alt = alternativesFor(trip, p, "rain", 1)[0];
      if (alt?.place.indoor) chips.push({ label: `Swap ${p.name} → ${alt.place.name}`, action: { type: "swap", removeId: p.id, place: { ...alt.place, source: "copilot" } } });
    }
    return {
      reply: chips.length ? "For wet weather I'd keep viewpoint and trek stops for a dry window and swap in covered options where one is nearby." : "I couldn't find covered alternatives close to those stops. Consider a later start and keeping the day light.",
      chips,
    };
  }

  if (/(cheap|budget|expens|save|cost|afford)/.test(text)) {
    const top = [...stops(trip)].sort((a, b) => b.costINR - a.costINR).slice(0, 3);
    const chips: CopilotChip[] = [];
    for (const p of top) {
      const alt = alternativesFor(trip, p, "budget", 1)[0];
      if (alt && alt.place.costINR < p.costINR) chips.push({ label: `Swap ${p.name} → ${alt.place.name}`, action: { type: "swap", removeId: p.id, place: { ...alt.place, source: "copilot" } } });
    }
    return { reply: `Biggest per-person costs on the plan: ${top.map((p) => `${p.name} (${inr(p.costINR)})`).join(", ")}. Staying in a village homestay and sharing a cab across the group usually saves more than dropping stops.`, chips };
  }

  const wantsList = /(list|suggest|recommend|options|best|good|top|where (to|can)|what (else|should)|find|show me|any )/.test(text);
  if (/(hotel|stay|homestay|resort|accommodation|sleep|lodg)/.test(text) && (wantsList || !/book/.test(text))) {
    const c = centroid(stops(trip));
    const stays = (getDestination(trip.destinationKey)?.stays ?? []).slice().sort((a, b) => haversineKm(c, a) - haversineKm(c, b));
    const options: CopilotOption[] = stays.slice(0, 5).map((s) => ({ name: s.name, kind: "stay", area: s.area, note: s.description, price: s.nightINR ? `about ${inr(s.nightINR)} per room per night` : undefined, lat: s.lat, lng: s.lng, mapsUrl: gmapsPlaceUrl(s), verified: false }));
    return options.length
      ? { reply: "These are the kinds of stays that suit your route. With an AI key and Google Places connected, I'll name specific hotels with live ratings. Meanwhile, compare real prices on MakeMyTrip.", options }
      : { reply: "I don't have stay data for this destination offline. Open the Book tab to search stays on MakeMyTrip." };
  }
  if (/(restaurant|eat|food|cafe|café|lunch|dinner|breakfast|snack)/.test(text) && wantsList) {
    const foods = suggestNearby(trip, 20).filter((p) => p.category === "food").slice(0, 4);
    if (foods.length) return { reply: "Food stops near your route:", options: foods.map((f) => ({ name: f.name, kind: "food" as const, area: f.area, note: f.description, price: f.costINR ? `about ${inr(f.costINR)} per person` : undefined, lat: f.lat, lng: f.lng, mapsUrl: gmapsPlaceUrl(f), verified: false })) };
  }
  if (/(what else|things to do|suggest|recommend|other places|more places|nearby)/.test(text)) {
    const s = suggestNearby(trip, 5);
    if (s.length) return { reply: "Nearby places you could add:", options: s.map((f) => ({ name: f.name, kind: "sight" as const, area: f.area, note: f.description, price: f.costINR ? `about ${inr(f.costINR)} per person` : "free", lat: f.lat, lng: f.lng, mapsUrl: gmapsPlaceUrl(f), verified: false })) };
  }
  if (/(book|cab|train|flight|bus|rental|self.?drive|car)/.test(text)) {
    return { reply: "Open the Book tab: it lists ways to reach the destination, stay options near each day's route, and cab or self-drive costs for the group. Anything you mark as booked shows up for everyone." };
  }
  if (/(weather|pack|carry|wear|jacket|umbrella)/.test(text)) {
    return { reply: "Open the Weather & pack tab for day-wise weather and a packing list built from your actual stops, including what you can skip." };
  }
  return { reply: HELP };
}

export function tripSummaryForLLM(trip: Trip): string {
  const lines = trip.days.map((d, i) => `Day ${i + 1}: ` + d.placeIds.map((id) => `${trip.places[id]?.name} [${id}]`).join(" -> "));
  return [`Destination: ${trip.destination}. Start: ${trip.startDate}. Pace: ${trip.pace}. Travellers: ${trip.members.length}.`, ...lines].join("\n");
}
