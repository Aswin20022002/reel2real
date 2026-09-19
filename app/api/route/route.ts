import { NextResponse } from "next/server";

// Road geometry from the public OSRM demo server (fine for a prototype; self-host or use Google Routes in production).
export async function GET(req: Request) {
  const pts = new URL(req.url).searchParams.get("pts") ?? "";
  const coords = pts.split(";").map((s) => s.split(",").map(Number)).filter((c) => c.length === 2 && c.every(Number.isFinite));
  if (coords.length < 2 || coords.length > 25) return NextResponse.json({ error: "bad pts" }, { status: 400 });
  try {
    const path = coords.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=simplified&geometries=geojson`, { next: { revalidate: 86400 } });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const route = j.routes?.[0];
    if (!route) throw new Error("no route");
    return NextResponse.json({ line: route.geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng]), km: route.distance / 1000, min: route.duration / 60 });
  } catch {
    return NextResponse.json({ error: "route unavailable" }, { status: 502 });
  }
}
