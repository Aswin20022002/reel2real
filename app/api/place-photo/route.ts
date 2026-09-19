import { NextResponse } from "next/server";

// Proxy so the Google API key never reaches the browser.
export async function GET(req: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!key || !/^places\/[\w-]+\/photos\/[\w-]+$/.test(name)) return new NextResponse("Not found", { status: 404 });
  const r = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&key=${key}`);
  if (!r.ok) return new NextResponse("Upstream error", { status: 502 });
  return new NextResponse(r.body, { headers: { "Content-Type": r.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "public, max-age=86400" } });
}
