"use client";
import { Film, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import ReelInput from "@/components/ReelInput";
import { Empty } from "@/components/ui";
import { detectPlatformClient } from "@/lib/platform";
import { deleteReel, listReels, saveReel } from "@/lib/store";
import type { SavedReel } from "@/lib/types";

export default function Vault() {
  const [reels, setReels] = useState<SavedReel[]>([]);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [prefill, setPrefill] = useState<{ url: string; caption?: string } | undefined>();
  const load = () => listReels().then(setReels);
  useEffect(() => { load(); }, []);

  async function saveOnly() {
    if (!/^https?:\/\//i.test(url.trim())) return;
    await saveReel({ id: `r_${Math.random().toString(36).slice(2, 9)}`, url: url.trim(), platform: detectPlatformClient(url), caption: note || undefined, title: note ? note.slice(0, 60) : undefined, savedAt: Date.now() });
    setUrl(""); setNote(""); load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Reel vault</h1>
        <p className="mt-1 max-w-2xl text-ink-700">Every reel you save lives here, so a "we should go here someday" video is one tap from a real plan. Reels you turn into trips link straight to the trip.</p>
      </div>

      <section className="card p-4">
        <h2 className="font-display text-lg font-bold">Save a reel for later</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
          <input className="input" placeholder="Paste link" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Reel link" />
          <input className="input" placeholder="Why you saved it (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
          <button className="btn-dark" onClick={saveOnly} disabled={!url.trim()}><Plus size={16} /> Save</button>
        </div>
      </section>

      {reels.length === 0 ? <Empty title="Nothing saved yet">Paste a link above, or build a trip from the home page and it will appear here.</Empty> : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {reels.map((r) => (
            <li key={r.id} className="card overflow-hidden">
              {r.thumbnail ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.thumbnail} alt="" className="h-36 w-full object-cover" /> : <div className="flex h-36 items-center justify-center bg-ink-50 text-ink-300"><Film size={32} /></div>}
              <div className="p-3.5">
                <div className="flex items-center gap-2 text-xs text-ink-500"><span className="chip bg-ink-100 text-ink-700">{r.platform}</span>{r.author}</div>
                <div className="mt-1 line-clamp-2 font-semibold">{r.title || r.url}</div>
                <div className="text-sm text-ink-500">{r.destination ? `${r.destination}${r.placeCount ? ` · ${r.placeCount} places` : ""}` : "Not planned yet"}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.tripId ? <Link className="btn-primary btn-sm" href={`/trip/${r.tripId}`}>Open trip</Link> : <button className="btn-primary btn-sm" onClick={() => { setPrefill({ url: r.url, caption: r.caption }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Turn into a trip</button>}
                  <a className="btn-ghost btn-sm" href={r.url} target="_blank" rel="noreferrer">Watch</a>
                  <button className="btn-ghost btn-sm ml-auto" aria-label="Remove from vault" onClick={async () => { await deleteReel(r.id); load(); }}><Trash2 size={13} /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {prefill && <section><h2 className="mb-2 font-display text-xl font-bold">Turn it into a trip</h2><ReelInput prefill={prefill} /></section>}
    </div>
  );
}
