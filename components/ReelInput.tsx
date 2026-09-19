"use client";
import { ChevronDown, FileAudio, Link2, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { extractAudioChunks } from "@/lib/audio";
import { ORIGINS, SAMPLES } from "@/lib/catalog";
import { addDays, buildTripFromAnalysis, isoDate, setDayStart } from "@/lib/itinerary";
import { pushTrip, saveReel, setMeStored } from "@/lib/store";
import type { Analysis, Pace } from "@/lib/types";

const STEPS = ["Reading the reel", "Finding the places", "Locating them on the map", "Routing the days", "Checking weather and alternatives"];

export default function ReelInput({ prefill }: { prefill?: { url: string; caption?: string } }) {
  const router = useRouter();
  const [url, setUrl] = useState(prefill?.url ?? "");
  const [caption, setCaption] = useState(prefill?.caption ?? "");
  const [transcript, setTranscript] = useState("");
  const [me, setMe] = useState("");
  const [friends, setFriends] = useState("");
  const [origin, setOrigin] = useState("Mumbai");
  const [start, setStart] = useState(addDays(isoDate(new Date()), 21));
  const [pace, setPace] = useState<Pace>("balanced");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [warn, setWarn] = useState<string[]>([]);
  const [ai, setAi] = useState<boolean | null>(null);
  const [tbusy, setTbusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { fetch("/api/analyze").then((r) => r.json()).then((j) => setAi(!!j.aiEnabled)).catch(() => setAi(false)); }, []);
  useEffect(() => { if (prefill) { setUrl(prefill.url); setCaption(prefill.caption ?? ""); } }, [prefill]);

  const [tmsg, setTmsg] = useState("");
  async function post(blob: Blob, name: string): Promise<string> {
    const fd = new FormData(); fd.append("file", blob, name);
    const r = await fetch("/api/transcribe", { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Transcription failed");
    return String(j.transcript ?? "");
  }
  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 250 * 1024 * 1024) { setErr("That file is over 250 MB. Trim the clip and try again."); return; }
    setTbusy(true); setErr(""); setTranscript("");
    try {
      let parts: string[] = [];
      try {
        setTmsg("Extracting the audio in your browser...");
        const { chunks, truncated, seconds } = await extractAudioChunks(f);
        for (let i = 0; i < chunks.length; i++) {
          setTmsg(`Transcribing part ${i + 1} of ${chunks.length}...`);
          parts.push(await post(chunks[i], `part${i + 1}.wav`));
        }
        if (truncated) setWarn([`Only the first ${Math.round(chunks.length * 1.5)} minutes of the ${Math.round(seconds / 60)}-minute video were read.`]);
      } catch (inner) {
        // some browsers can't decode certain files; small files can still go straight to the server
        if (f.size <= 4 * 1024 * 1024 && !parts.length) { setTmsg("Transcribing..."); parts = [await post(f, f.name)]; }
        else throw inner;
      }
      const text = parts.join(" ").trim();
      if (!text) throw new Error("No speech was found in that file. If the places only appear as on-screen text, paste them into the caption box.");
      setTranscript(text); setMore(true);
    } catch (e) {
      const m = (e as Error).message;
      setErr(/decode|EncodingError|unable/i.test(m) ? "This browser couldn't read that video's audio. Try Chrome, or upload an audio-only file (m4a, mp3, wav)." : m);
    } finally { setTbusy(false); setTmsg(""); }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(""); setWarn([]);
    if (!/^https?:\/\//i.test(url.trim())) { setErr("Paste a full reel or video link that starts with https://"); return; }
    setBusy(true); setStep(0);
    timer.current = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1300);
    try {
      const r = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim(), caption, transcript }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong");
      const a = j.analysis as Analysis;
      setWarn(a.warnings);
      if (a.needsInput || !a.places.length) {
        setErr(`I couldn't find places in this link. ${a.warnings.join(" ")} Paste the caption or description (or upload a short clip) and try again. Apps can't watch a video directly, so they need its text or audio.`);
        setMore(true);
        return;
      }
      const names = [me.trim() || "You", ...friends.split(",").map((s) => s.trim()).filter(Boolean)];
      let trip = buildTripFromAnalysis(a, { names, origin, startDate: start, pace });
      trip = trip.days.length ? setDayStart(trip, 0, "10:00") : trip;
      setMeStored(trip.id, trip.members[0].id);
      await pushTrip(trip);
      await saveReel({ id: `r_${trip.id}`, url: a.reel.url, platform: a.reel.platform, title: a.reel.title || a.title, author: a.reel.author, thumbnail: a.reel.thumbnail, caption: a.reel.caption, destination: a.destination, placeCount: a.places.length, tripId: trip.id, savedAt: Date.now() });
      router.push(`/trip/${trip.id}`);
    } catch (e) { setErr((e as Error).message); } finally {
      if (timer.current) clearInterval(timer.current);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card relative overflow-hidden p-5 sm:p-6" aria-busy={busy}>
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-500"><Link2 size={16} /> Reel, Short or video link</div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input className="input h-12 flex-1 text-base" placeholder="https://www.instagram.com/reel/..." value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" aria-label="Reel link" />
        <button className="btn-primary h-12 px-6 text-base" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} Build my trip
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink-500">No reel handy? Try a sample:</span>
        {SAMPLES.map((s) => (
          <button type="button" key={s.id} className="chip border border-ink-200 bg-ink-50 text-ink-700 hover:bg-sky-50" onClick={() => { setUrl(s.url); setCaption(s.caption); setMore(true); }}>
            {s.label}
          </button>
        ))}
      </div>

      <button type="button" className="mt-4 flex items-center gap-1 text-sm font-semibold text-sky-700" onClick={() => setMore(!more)} aria-expanded={more}>
        <ChevronDown size={16} className={more ? "rotate-180" : ""} /> Add caption, clip and trip details
      </button>

      {more && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="cap">Caption or comments (best results: paste the full caption)</label>
            <textarea id="cap" className="input min-h-24" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Paste what the creator wrote, plus any place names people mention in comments" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Or upload the downloaded reel (any size up to 250 MB): the audio is pulled out in your browser and transcribed</label>
            <label className={`btn-ghost cursor-pointer ${ai ? "" : "opacity-60"}`}>
              {tbusy ? <Loader2 className="animate-spin" size={16} /> : <FileAudio size={16} />} {tbusy ? tmsg || "Working..." : transcript ? "Transcript added, choose another" : "Choose video or audio"}
              <input type="file" accept="audio/*,video/*" className="sr-only" disabled={!ai || tbusy} onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {ai === false && <p className="mt-1 text-xs text-ink-500">Needs an AI key on the server (see README). Until then, paste the caption instead.</p>}
          </div>
          <div><label className="label" htmlFor="me">Your name</label><input id="me" className="input" value={me} onChange={(e) => setMe(e.target.value)} placeholder="You" /></div>
          <div><label className="label" htmlFor="fr">Friends coming along (comma separated)</label><input id="fr" className="input" value={friends} onChange={(e) => setFriends(e.target.value)} placeholder="Riya, Kabir, Meera" /></div>
          <div><label className="label" htmlFor="or">Travelling from</label>
            <select id="or" className="input" value={origin} onChange={(e) => setOrigin(e.target.value)}>{ORIGINS.map((o) => <option key={o.name}>{o.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label" htmlFor="st">Start date</label><input id="st" type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><label className="label" htmlFor="pc">Pace</label>
              <select id="pc" className="input" value={pace} onChange={(e) => setPace(e.target.value as Pace)}><option value="relaxed">Relaxed</option><option value="balanced">Balanced</option><option value="packed">Packed</option></select></div>
          </div>
        </div>
      )}

      {busy && (
        <ol className="mt-4 space-y-1.5" aria-live="polite">
          {STEPS.map((s, i) => (
            <li key={s} className={`flex items-center gap-2 text-sm ${i < step ? "text-lagoon-700" : i === step ? "pipe-active font-semibold text-ink" : "text-ink-300"}`}>
              <span className={`h-2 w-2 rounded-full ${i <= step ? "bg-current" : "bg-ink-200"}`} /> {s}
            </li>
          ))}
        </ol>
      )}
      {err && <p className="mt-3 rounded-lg bg-signal-50 p-3 text-sm text-signal-700" role="alert">{err}</p>}
      {!!warn.length && !err && <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">{warn.map((w) => <li key={w}>{w}</li>)}</ul>}
      {ai !== null && !busy && <p className="mt-3 text-xs text-ink-500">{ai ? "AI extraction is on: any place named in the reel text can be found." : "Demo mode: recognises places from the built-in catalog (Meghalaya, Goa, Manali & Kasol, Kerala). Add an AI key to handle any destination."}</p>}
    </form>
  );
}
