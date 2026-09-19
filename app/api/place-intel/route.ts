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
  /** recent public photos taken at this spot (Flickr), newest first */
  recent?: { url: string; credit: string; link: string; uploaded: string }[];
  recentSource?: string;
}

interface FlickrPhoto { id: string; owner: string; ownername?: string; url_m?: string; dateupload?: string; title?: string }

// Recent public, geotagged photos. Free Flickr API key required (FLICKR_API_KEY). Always credit the owner and link back.
async function flickrRecent(name: string, lat: number, lng: number): Promise<NonNullable<PlaceIntel["recent"]>> {
  const key = process.env.FLICKR_API_KEY;
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const run = async (text?: string) => {
    const q = new URLSearchParams({
      method: "flickr.photos.search", api_key: key, lat: String(lat), lon: String(lng), radius: "1.5", radius_units: "km",
      sort: "date-posted-desc", per_page: "8", media: "photos", content_type: "1", safe_search: "1", extras: "date_upload,owner_name,url_m",
      format: "json", nojsoncallback: "1", ...(text ? { text } : {}),
    });
    const r = await fetch(`https://api.flickr.com/services/rest/?${q}`, { next: { revalidate: 1800 } });
    if (!r.ok) return [] as FlickrPhoto[];
    const j = await r.json();
    return (j.photos?.photo ?? []) as FlickrPhoto[];
  };
  try {
    let photos = await run(name.split(/[,(]/)[0].trim());
    if (photos.length < 3) photos = await run();
    return photos.filter((p) => p.url_m).slice(0, 8).map((p) => ({
      url: p.url_m as string, credit: p.ownername ?? "Flickr user", link: `https://www.flickr.com/photos/${p.owner}/${p.id}`,
      uploaded: p.dateupload ? new Date(Number(p.dateupload) * 1000).toISOString() : "",
    }));
  } catch { return []; }
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
  let googleError = "";

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
        } else googleError = "Google found no matching place";
      } else {
        const t = (await r.text()).slice(0, 400);
        let msg = t;
        try { msg = JSON.parse(t).error?.message ?? t; } catch { /* keep raw text */ }
        googleError = `${r.status}: ${String(msg).slice(0, 220)}`;
      }
    } catch (e) { console.error(e); googleError = (e as Error).message; }
  }

  const recent = await flickrRecent(name, lat, lng);
  if (recent.length) { out.recent = recent; out.recentSource = "Flickr"; }

  if (!out.photos.length && (wiki || name)) {
    const w = await wikiInfo(wiki || name);
    if (w.img) out.photos.push({ url: w.img, credit: "Wikipedia / Wikimedia Commons" });
    out.summary = w.extract;
  }
  if (out.mode === "basic") out.note = key ? `Google Places is set up but didn't return data (${googleError || "unknown reason"}).` : "Live status, ratings, recent reviews and traveller photos switch on when a Google Places API key is set.";
  return NextResponse.json(out);
}
