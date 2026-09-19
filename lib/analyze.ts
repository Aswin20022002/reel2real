import { DESTINATIONS, findDestination, getDestination, matchPlaces, snapToCatalog } from "./catalog";
import { llmConfigured, llmJSON } from "./llm";
import type { Analysis, Category, Place, ReelSource } from "./types";
import { fetchYouTube } from "./youtube";

export function detectPlatform(url: string): ReelSource["platform"] {
  if (/instagram\.com|instagr\.am/i.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  return "other";
}

async function timedFetch(url: string, init: RequestInit = {}, ms = 5000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(t); }
}

/** Public oEmbed-style metadata (title, author, thumbnail). Instagram often blocks this; that's fine, we fall back to the caption the user pastes. */
async function fetchMeta(url: string): Promise<Partial<ReelSource>> {
  try {
    const res = await timedFetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, { headers: { "User-Agent": "Reel2Real/0.1" } }, 4000);
    if (!res.ok) return {};
    const j = await res.json();
    if (j.error) return {};
    return { title: j.title, author: j.author_name, thumbnail: j.thumbnail_url };
  } catch { return {}; }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
const CATS: Category[] = ["sight", "nature", "food", "adventure", "culture", "stay", "shopping", "wellness"];

async function googleGeocode(name: string, hint: string): Promise<{ lat: number; lng: number; area?: string } | undefined> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return undefined;
  try {
    const res = await timedFetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.location,places.formattedAddress,places.displayName" },
      body: JSON.stringify({ textQuery: `${name} ${hint}`, maxResultCount: 1, regionCode: "IN" }),
    }, 5000);
    if (!res.ok) return undefined;
    const j = await res.json();
    const pl = j.places?.[0];
    if (!pl?.location) return undefined;
    return { lat: pl.location.latitude, lng: pl.location.longitude, area: String(pl.formattedAddress ?? "").split(",").slice(-3, -2)[0]?.trim() };
  } catch { return undefined; }
}

let lastNominatim = 0;
async function nominatim(name: string, hint: string): Promise<{ lat: number; lng: number; area?: string } | undefined> {
  const wait = Math.max(0, 1100 - (Date.now() - lastNominatim));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  try {
    const res = await timedFetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(`${name}, ${hint}`)}`, { headers: { "User-Agent": "Reel2Real-prototype/0.1 (contact: team)" } }, 5000);
    if (!res.ok) return undefined;
    const j = await res.json();
    if (!j[0]) return undefined;
    return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon), area: String(j[0].display_name ?? "").split(",")[1]?.trim() };
  } catch { return undefined; }
}

interface LlmPlace { name?: string; category?: string; area?: string; lat?: number; lng?: number; description?: string; durationMin?: number; costINR?: number; evidence?: string }
interface LlmOut { destination?: string; title?: string; summary?: string; vibe?: string[]; suggestedDays?: number; places?: LlmPlace[] }

const SYSTEM = `You extract a travel plan from a short-video (reel) caption/transcript for Indian travellers.
Return ONLY JSON: {"destination": string, "title": string (max 7 words), "summary": string (1-2 sentences), "vibe": string[] (max 4), "suggestedDays": number,
"places": [{"name": string, "category": "sight|nature|food|adventure|culture|stay|shopping|wellness", "area": string (town/district), "lat": number, "lng": number,
"description": string (one sentence), "durationMin": number, "costINR": number (typical per-person spend, 0 if free), "evidence": string (short phrase from the text that mentions it)}]}.
Rules: only include real, specific places that the text names or clearly implies; never invent places. If the text names a generic thing like "a cafe in Sohra", include it as a food place with that area.
Keep the order the creator mentions. Use best-known real coordinates. If no destination can be found return {"places": []}.`;

export async function analyzeReel(input: { url: string; caption?: string; transcript?: string }): Promise<Analysis> {
  const url = input.url.trim();
  const platform = detectPlatform(url);
  let meta = await fetchMeta(url);
  let ytText = "";
  const warnings: string[] = [];
  if (platform === "youtube") {
    const yt = await fetchYouTube(url);
    if (yt.title || yt.description || yt.transcript) {
      meta = { title: yt.title ?? meta.title, author: yt.author ?? meta.author, thumbnail: yt.thumbnail ?? meta.thumbnail };
      ytText = [yt.description, yt.transcript ? `Spoken in the video (${yt.lang ?? "captions"}): ${yt.transcript}` : ""].filter(Boolean).join("\n");
      if (!yt.transcript) warnings.push("This video has no readable captions, so only its title and description were used.");
    } else {
      warnings.push("Couldn't read this YouTube video's description or captions from the server. Paste the description or upload a short clip.");
    }
  }
  const caption = [input.caption, input.transcript, ytText].filter(Boolean).join("\n").trim();
  const text = [meta.title, meta.author, caption, decodeURIComponent(url)].filter(Boolean).join("\n");
  const reel: ReelSource = { url, platform, title: meta.title, author: meta.author, thumbnail: meta.thumbnail, caption: caption ? caption.slice(0, 4000) : undefined };

  let engine: Analysis["engine"] = "catalog";
  let llm: LlmOut | undefined;
  if (llmConfigured() && text.replace(/https?:\S+/g, "").trim().length > 20) {
    try { llm = await llmJSON<LlmOut>(SYSTEM, `Reel text:\n${text.slice(0, 9000)}`); engine = "ai"; }
    catch (e) { warnings.push(`AI extraction failed (${String((e as Error).message).slice(0, 160)}), so the built-in catalog matcher was used instead.`); console.error(e); }
  } else if (!llmConfigured()) {
    warnings.push("Running without an AI key: only places named in the caption you paste can be recognised, and only for destinations in the built-in catalog.");
  }

  const destGuess = findDestination(`${llm?.destination ?? ""} ${text}`);
  const places: Place[] = [];
  const seen = new Set<string>();
  const push = (pl: Place) => { if (!seen.has(pl.id)) { seen.add(pl.id); places.push(pl); } };
  let geocodeBudget = 6;

  if (llm?.places?.length) {
    for (const lp of llm.places.slice(0, 14)) {
      const name = String(lp.name ?? "").trim();
      if (!name) continue;
      const snap = snapToCatalog(name, destGuess?.key);
      if (snap) {
        const { aliases, iconic, ...rest } = snap; void aliases; void iconic;
        push({ ...rest, fromReel: true, evidence: lp.evidence, source: "reel" });
        continue;
      }
      const cat = (CATS.includes(lp.category as Category) ? lp.category : "sight") as Category;
      const hint = [lp.area, llm.destination].filter(Boolean).join(", ");
      let geo = await googleGeocode(name, hint);
      if (!geo && geocodeBudget > 0) { geocodeBudget--; geo = await nominatim(name, hint); }
      const lat = geo?.lat ?? (typeof lp.lat === "number" ? lp.lat : undefined);
      const lng = geo?.lng ?? (typeof lp.lng === "number" ? lp.lng : undefined);
      if (lat === undefined || lng === undefined || Number.isNaN(lat) || Number.isNaN(lng)) { warnings.push(`Couldn't locate "${name}" on the map, so it was left out.`); continue; }
      if (!geo) warnings.push(`"${name}" uses AI-estimated coordinates; verify it on Google Maps.`);
      push({
        id: `ai-${slug(name)}`, name, category: cat, area: lp.area || geo?.area || llm.destination || "", lat, lng,
        description: lp.description || "Mentioned in the reel.", durationMin: Math.min(480, Math.max(30, lp.durationMin ?? 90)), costINR: Math.max(0, lp.costINR ?? 0),
        tags: [], fromReel: true, evidence: lp.evidence, source: "reel",
      });
    }
  } else if (destGuess) {
    for (const { place, hit } of matchPlaces(text, destGuess)) {
      const { aliases, iconic, ...rest } = place; void aliases; void iconic;
      push({ ...rest, fromReel: true, evidence: `Mentioned "${hit}"`, source: "reel" });
    }
    if (places.length < 3) {
      warnings.push("The caption named few specific places, so popular stops for this destination were added. Paste the full caption or transcript for a closer match.");
      destGuess.places.filter((p) => p.iconic).slice(0, 5).forEach((pl) => { const { aliases, iconic, ...rest } = pl; void aliases; void iconic; push({ ...rest, fromReel: false, source: "catalog" }); });
    }
  }

  const dest = destGuess ?? (llm?.destination ? undefined : undefined);
  if (!places.length) {
    return { engine, destination: llm?.destination ?? "Unknown", title: "No places found", summary: "", vibe: [], places: [], warnings, needsInput: true, reel };
  }
  const destName = dest?.name ?? llm?.destination ?? places[0].area ?? "Your trip";
  return {
    engine, destinationKey: dest?.key, destination: destName,
    title: llm?.title || `${destName} from the reel`,
    summary: llm?.summary || `${places.length} places found in the reel, grouped into a route you can edit.`,
    vibe: llm?.vibe?.slice(0, 4) ?? dest?.vibe ?? [],
    suggestedDays: llm?.suggestedDays && llm.suggestedDays > 0 && llm.suggestedDays <= 10 ? undefined : undefined,
    places, warnings, reel,
  };
}

export { DESTINATIONS, getDestination };
