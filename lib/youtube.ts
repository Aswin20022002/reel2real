/**
 * Best-effort YouTube reader: title, description and captions straight from the public watch page.
 * No API key needed. YouTube sometimes blocks datacenter requests, so every step fails soft and the caller falls back to pasted text.
 */
export function ytId(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || undefined;
    if (/youtube\.com$/.test(u.hostname)) {
      if (u.searchParams.get("v")) return u.searchParams.get("v") as string;
      const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{6,})/);
      if (m) return m[1];
    }
  } catch { /* not a URL */ }
  return undefined;
}

export interface YtInfo { title?: string; author?: string; description?: string; transcript?: string; thumbnail?: string; lang?: string }

interface CaptionTrack { baseUrl: string; languageCode: string; kind?: string }

async function timed(url: string, init: RequestInit = {}, ms = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(t); }
}

/** Pull the JSON object that follows `ytInitialPlayerResponse =` out of the page HTML. */
export function extractPlayerResponse(html: string): Record<string, unknown> | undefined {
  const marker = "ytInitialPlayerResponse";
  const i = html.indexOf(marker);
  if (i < 0) return undefined;
  const start = html.indexOf("{", i);
  if (start < 0) return undefined;
  let depth = 0, inStr = false, esc = false;
  for (let k = start; k < html.length; k++) {
    const c = html[k];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { try { return JSON.parse(html.slice(start, k + 1)); } catch { return undefined; } } }
  }
  return undefined;
}

export function pickTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  const pref = ["en", "hi", "ta", "te", "ml", "bn", "mr", "kn", "gu", "pa"];
  const manual = tracks.filter((t) => t.kind !== "asr");
  for (const pool of [manual, tracks]) {
    for (const l of pref) { const f = pool.find((t) => t.languageCode.startsWith(l)); if (f) return f; }
  }
  return tracks[0];
}

export function parseJson3(j: { events?: { segs?: { utf8?: string }[] }[] }): string {
  return (j.events ?? []).flatMap((e) => (e.segs ?? []).map((s) => s.utf8 ?? "")).join(" ").replace(/\s+/g, " ").trim();
}

export async function fetchYouTube(url: string): Promise<YtInfo> {
  const id = ytId(url);
  if (!id) return {};
  try {
    const res = await timed(`https://www.youtube.com/watch?v=${id}&hl=en`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+1; SOCS=CAI" },
    });
    if (!res.ok) return {};
    const pr = extractPlayerResponse(await res.text()) as {
      videoDetails?: { title?: string; author?: string; shortDescription?: string; thumbnail?: { thumbnails?: { url: string }[] } };
      captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
    } | undefined;
    if (!pr) return {};
    const vd = pr.videoDetails;
    const out: YtInfo = { title: vd?.title, author: vd?.author, description: vd?.shortDescription, thumbnail: vd?.thumbnail?.thumbnails?.slice(-1)[0]?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    const tracks = pr.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    const tr = pickTrack(tracks);
    if (tr?.baseUrl) {
      try {
        const cr = await timed(`${tr.baseUrl}&fmt=json3`, { headers: { "Accept-Language": "en-US,en;q=0.9" } }, 6000);
        if (cr.ok) { out.transcript = parseJson3(await cr.json()).slice(0, 9000); out.lang = tr.languageCode; }
      } catch { /* transcript is optional */ }
    }
    return out;
  } catch { return {}; }
}
