import { NextResponse } from "next/server";

// Free-text place search for "add any place". Uses Google Places if a key is set, otherwise OpenStreetMap Nominatim.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim();
  const near = u.searchParams.get("near") ?? "";
  if (q.length < 3) return NextResponse.json({ results: [] });
  const key = process.env.GOOGLE_PLACES_API_KEY;
  try {
    if (key) {
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.displayName,places.location,places.formattedAddress" },
        body: JSON.stringify({ textQuery: `${q} ${near}`, maxResultCount: 5, regionCode: "IN" }),
      });
      const j = await r.json();
      return NextResponse.json({ results: (j.places ?? []).map((p: { displayName?: { text?: string }; location: { latitude: number; longitude: number }; formattedAddress?: string }) => ({ name: p.displayName?.text ?? q, lat: p.location.latitude, lng: p.location.longitude, area: String(p.formattedAddress ?? "").split(",").slice(-3, -2)[0]?.trim() ?? "", address: p.formattedAddress })) });
    }
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(`${q} ${near}`)}`, { headers: { "User-Agent": "Reel2Real-prototype/0.1" } });
    const j = await r.json();
    return NextResponse.json({ results: j.map((x: { display_name: string; lat: string; lon: string; name?: string }) => ({ name: x.name || x.display_name.split(",")[0], lat: parseFloat(x.lat), lng: parseFloat(x.lon), area: x.display_name.split(",")[1]?.trim() ?? "", address: x.display_name })) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ results: [] });
  }
}
