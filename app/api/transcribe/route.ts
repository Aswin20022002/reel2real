import { NextResponse } from "next/server";
import { llmConfigured, transcribe } from "@/lib/llm";

export const maxDuration = 60;

// Vercel serverless request bodies are limited to ~4.5 MB, so this accepts short clips only.
// For full-length reels a background worker (yt-dlp + ffmpeg -> audio -> Whisper) is the production path.
export async function POST(req: Request) {
  if (!llmConfigured()) return NextResponse.json({ error: "Set LLM_API_KEY to enable audio transcription." }, { status: 501 });
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Clip is over 4 MB. Upload a shorter clip or audio-only file." }, { status: 413 });
    const text = await transcribe(file);
    return NextResponse.json({ transcript: text });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Transcription failed." }, { status: 500 });
  }
}
