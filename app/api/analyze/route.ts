import { NextResponse } from "next/server";
import { analyzeReel } from "@/lib/analyze";
import { llmConfigured } from "@/lib/llm";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = String(body.url ?? "").trim();
    const caption = String(body.caption ?? "").slice(0, 8000);
    const transcript = String(body.transcript ?? "").slice(0, 12000);
    if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Paste a full reel or video link that starts with https://" }, { status: 400 });
    const analysis = await analyzeReel({ url, caption, transcript });
    return NextResponse.json({ analysis, aiEnabled: llmConfigured() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not analyse this reel. Try pasting the caption as well." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ aiEnabled: llmConfigured(), placesEnabled: !!process.env.GOOGLE_PLACES_API_KEY });
}
