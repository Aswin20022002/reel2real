import { NextResponse } from "next/server";

export interface PlaceIntel {
  mode: "live" | "basic";
  status?: string;
  rating?: number;
  ratingCount?: number;
  hours?: string[];
  mapsUri?: string;
  photos: { url: string; credit?: string }[];
  reviews: { text: string; when: string; rating?: number }[];
  summary?: string;
  note?: string;
}

async function wikiInfo(title: string): Promise<{ img?: string; extract?: string }> {
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, { next: { revalidate: 86400 }, headers: { "User-Agent": "Reel2Real/0.1" } });
    if (!r.ok) return {};
    const j = await r.json();
    return { img: j.originalimage?.source ?? j.thumbnail?.source, extract: j.extract };
  } catch { return {}; }
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const name = u.searchParams.get("name") ?? "";
  const area = u.searchParams.get("area") ?? "";
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const wiki = u.searchParams.get("wiki") ?? "";
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const out: PlaceIntel = { mode: "basic", photos: [], reviews: [] };

  if (key && name) {
    try {
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.businessStatus,places.reviews,places.photos,places.regularOpeningHours.weekdayDescriptions,places.googleMapsUri",
        },
        body: JSON.stringify({ textQuery: `${name} ${area}`, maxResultCount: 1, ...(Number.isFinite(lat) && Number.isFinite(lng) ? { locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 8000 } } } : {}) }),
      });
      if (r.ok) {
        const j = await r.json();
        const pl = j.places?.[0];
        if (pl) {
          out.mode = "live";
          out.status = pl.businessStatus;
          out.rating = pl.rating;
          out.ratingCount = pl.userRatingCount;
          out.hours = pl.regularOpeningHours?.weekdayDescriptions;
          out.mapsUri = pl.googleMapsUri;
          out.photos = (pl.photos ?? []).slice(0, 6).map((p: { name: string; authorAttributions?: { displayName?: string }[] }) => ({ url: `/api/place-photo?name=${encodeURIComponent(p.name)}`, credit: p.authorAttributions?.[0]?.displayName }));
          out.reviews = (pl.reviews ?? []).slice(0, 5).map((v: { text?: { text?: string }; relativePublishTimeDescription?: string; rating?: number }) => ({ text: (v.text?.text ?? "").slice(0, 240), when: v.relativePublishTimeDescription ?? "", rating: v.rating }));
        }
      }
    } catch (e) { console.error(e); }
  }

  if (!out.photos.length && (wiki || name)) {
    const w = await wikiInfo(wiki || name);
    if (w.img) out.photos.push({ url: w.img, credit: "Wikipedia / Wikimedia Commons" });
    out.summary = w.extract;
  }
  if (out.mode === "basic") out.note = "Live status, ratings, recent reviews and traveller photos switch on when a Google Places API key is set.";
  return NextResponse.json(out);
}
