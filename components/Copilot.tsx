"use client";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { localCopilot } from "@/lib/copilot";
import { applyAction } from "@/lib/itinerary";
import type { Action, CopilotChip, Trip } from "@/lib/types";

interface Msg { role: "user" | "bot"; text: string; chips?: CopilotChip[]; applied?: number }

const IDEAS = ["Make it more relaxed", "Dawki is closed, what else?", "It's going to rain on day 2", "Make it cheaper", "Who owes whom?"];

export default function Copilot({ trip, update }: { trip: Trip; update: (fn: (t: Trip) => Trip) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "bot", text: `Hi, I'm your trip Copilot. I can reorder days, swap places, handle closures and rain, and answer questions about costs. Try one of the ideas below.` }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs]);

  const run = (actions: Action[]) => update((t) => actions.reduce((acc, a) => applyAction(acc, a), t));

  async function send(raw?: string) {
    const m = (raw ?? text).trim();
    if (!m || busy) return;
    setText(""); setBusy(true);
    setMsgs((x) => [...x, { role: "user", text: m }]);
    let reply: { reply: string; actions?: Action[]; chips?: CopilotChip[] } | null = null;
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: m, trip, history: msgs.slice(-6).map((x) => ({ role: x.role, text: x.text })) }) });
      if (r.ok) reply = await r.json();
    } catch { /* fall through to offline copilot */ }
    if (!reply) reply = localCopilot(trip, m);
    const actions = reply.actions ?? [];
    if (actions.length) run(actions);
    setMsgs((x) => [...x, { role: "bot", text: reply!.reply, chips: reply!.chips, applied: actions.length }]);
    setBusy(false);
  }

  return (
    <section className="card flex h-[560px] flex-col lg:h-[calc(100vh-7rem)]" aria-label="Trip Copilot">
      <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3"><Sparkles size={16} className="text-signal" /><h2 className="font-display text-lg font-bold">Copilot</h2></div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[92%] rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-ink text-white" : "bg-ink-50 text-ink"}`}>
              <p>{m.text}</p>
              {!!m.applied && <p className="mt-1 text-xs font-semibold text-lagoon-700">Plan updated ({m.applied} change{m.applied > 1 ? "s" : ""}).</p>}
              {m.chips && <div className="mt-2 flex flex-col gap-1.5">{m.chips.map((c, j) => <button key={j} className="btn-ghost btn-sm justify-start text-left" onClick={() => { run([c.action]); setMsgs((x) => [...x, { role: "bot", text: `Done: ${c.label}.`, applied: 1 }]); }}>{c.label}</button>)}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-sm text-ink-500"><Loader2 size={14} className="animate-spin" /> Thinking...</div>}
        <div ref={end} />
      </div>
      <div className="border-t border-ink-100 p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">{IDEAS.map((i) => <button key={i} className="chip border border-ink-200 bg-white text-ink-700 hover:bg-sky-50" onClick={() => send(i)}>{i}</button>)}</div>
        <div className="flex gap-2">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask to change the plan..." aria-label="Message Copilot" />
          <button className="btn-primary" onClick={() => send()} disabled={busy || !text.trim()} aria-label="Send"><Send size={16} /></button>
        </div>
      </div>
    </section>
  );
}
