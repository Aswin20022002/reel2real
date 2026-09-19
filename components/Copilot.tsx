"use client";
import { ExternalLink, Loader2, MapPin, Plus, Send, ShieldAlert, Sparkles, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { localCopilot } from "@/lib/copilot";
import { applyAction, uid } from "@/lib/itinerary";
import { MMT_LINKS } from "@/lib/transport";
import type { Action, CopilotChip, CopilotOption, CopilotReply, Place, Trip } from "@/lib/types";

interface Msg { role: "user" | "bot"; text: string; chips?: CopilotChip[]; applied?: number; options?: CopilotOption[]; note?: string }

const IDEAS = ["Give me good hotels near my route", "Best cafes and local food", "Make it more relaxed", "Dawki is closed, what else?", "It's going to rain on day 2", "Who owes whom?"];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);

export default function Copilot({ trip, update }: { trip: Trip; update: (fn: (t: Trip) => Trip) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "bot", text: "Hi, I'm your trip Copilot. Ask me for hotel, food or place options, or tell me to change the plan: swap a closed place, plan around rain, make it cheaper or more relaxed." }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs]);

  const run = (actions: Action[]) => update((t) => actions.reduce((acc, a) => applyAction(acc, a), t));

  async function send(raw?: string) {
    const m = (raw ?? text).trim();
    if (!m || busy) return;
    setText(""); setBusy(true);
    setMsgs((x) => [...x, { role: "user", text: m }]);
    let reply: CopilotReply | null = null;
    let note: string | undefined;
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: m, trip, history: msgs.slice(-6).map((x) => ({ role: x.role, text: x.text })) }) });
      const t = await r.text();
      let j: { error?: string; detail?: string } & { reply?: string } = {};
      try { j = JSON.parse(t); } catch { /* non-JSON reply */ }
      if (r.ok && j.reply) reply = j as unknown as CopilotReply;
      else note = j.error === "no-llm" ? "AI key not set on the server, so this is the offline assistant." : `AI unavailable (${j.detail || r.status}), so this is the offline assistant.`;
    } catch { note = "Couldn't reach the AI service, so this is the offline assistant."; }
    if (!reply) reply = localCopilot(trip, m);
    const actions = reply.actions ?? [];
    if (actions.length) run(actions);
    setMsgs((x) => [...x, { role: "bot", text: reply!.reply, chips: reply!.chips, options: reply!.options, applied: actions.length, note }]);
    setBusy(false);
  }

  async function addOption(o: CopilotOption, key: string) {
    if (o.kind === "stay") {
      update((t) => ({ ...t, bookings: [{ id: uid("b"), kind: "stay", title: `${o.name}${o.area ? `, ${o.area}` : ""}`, status: "shortlisted", updatedAt: Date.now() }, ...t.bookings], updatedAt: Date.now() }));
      setAdded((a) => ({ ...a, [key]: true }));
      return;
    }
    let { lat, lng } = o;
    if (lat === undefined || lng === undefined) {
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(o.name)}&near=${encodeURIComponent(o.area || trip.destination)}`);
        const g = (await r.json()).results?.[0];
        if (g) { lat = g.lat; lng = g.lng; }
      } catch { /* ignore */ }
    }
    if (lat === undefined || lng === undefined) { setMsgs((x) => [...x, { role: "bot", text: `I couldn't place ${o.name} on the map. Try the search box under "Add a place" on the Plan tab.` }]); return; }
    const place: Place = { id: `opt-${slug(o.name)}`, name: o.name, category: o.kind === "food" ? "food" : o.kind === "shopping" ? "shopping" : "sight", area: o.area ?? trip.destination, lat, lng, description: o.note ?? "Added from Copilot suggestions.", durationMin: o.kind === "food" ? 60 : 90, costINR: 0, tags: [], source: "copilot" };
    run([{ type: "add", place }]);
    setAdded((a) => ({ ...a, [key]: true }));
  }

  return (
    <section className="card flex h-[560px] flex-col lg:h-[calc(100vh-7rem)]" aria-label="Trip Copilot">
      <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3"><Sparkles size={16} className="text-signal" /><h2 className="font-display text-lg font-bold">Copilot</h2></div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[96%] rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-ink text-white" : "bg-ink-50 text-ink"}`}>
              <p>{m.text}</p>
              {m.note && <p className="mt-1 text-[11px] text-ink-500">{m.note}</p>}
              {!!m.applied && <p className="mt-1 text-xs font-semibold text-lagoon-700">Plan updated ({m.applied} change{m.applied > 1 ? "s" : ""}).</p>}
              {m.options && (
                <ul className="mt-2 space-y-2">
                  {m.options.map((o, j) => {
                    const key = `${i}-${j}`;
                    const maps = o.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.name} ${o.area ?? trip.destination}`)}`;
                    return (
                      <li key={key} className="rounded-xl border border-ink-100 bg-white p-2.5 text-ink">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold">{o.name}</div>
                          {o.rating ? <span className="chip shrink-0 bg-amber-50 text-amber-700"><Star size={11} /> {o.rating.toFixed(1)}{o.ratingCount ? ` (${o.ratingCount.toLocaleString("en-IN")})` : ""}</span> : null}
                        </div>
                        <div className="text-xs text-ink-500">{[o.area, o.price].filter(Boolean).join(" · ")}</div>
                        {o.note && <p className="mt-0.5 text-xs text-ink-700">{o.note}</p>}
                        {o.verified === false && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-700"><ShieldAlert size={11} /> Suggested by AI, not checked live. Verify on Maps.</p>}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <a className="btn-ghost btn-sm" href={maps} target="_blank" rel="noreferrer"><MapPin size={12} /> Maps</a>
                          {o.kind === "stay" && <a className="btn-ghost btn-sm" href={MMT_LINKS.hotels} target="_blank" rel="noreferrer">MakeMyTrip <ExternalLink size={11} /></a>}
                          <button className="btn-primary btn-sm" disabled={added[key]} onClick={() => addOption(o, key)}><Plus size={12} /> {added[key] ? "Added" : o.kind === "stay" ? "Shortlist stay" : "Add to plan"}</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {m.chips && <div className="mt-2 flex flex-col gap-1.5">{m.chips.map((c, j) => <button key={j} className="btn-ghost btn-sm justify-start text-left" onClick={() => { run([c.action]); setMsgs((x) => [...x, { role: "bot", text: `Done: ${c.label}.`, applied: 1 }]); }}>{c.label}</button>)}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-sm text-ink-500"><Loader2 size={14} className="animate-spin" /> Thinking...</div>}
        <div ref={end} />
      </div>
      <div className="border-t border-ink-100 p-3">
        <div className="mb-2 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">{IDEAS.map((i) => <button key={i} className="chip border border-ink-200 bg-white text-ink-700 hover:bg-sky-50" onClick={() => send(i)}>{i}</button>)}</div>
        <div className="flex gap-2">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask for options or change the plan..." aria-label="Message Copilot" />
          <button className="btn-primary" onClick={() => send()} disabled={busy || !text.trim()} aria-label="Send"><Send size={16} /></button>
        </div>
      </div>
    </section>
  );
}
