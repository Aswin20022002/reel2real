"use client";
import { useState } from "react";
import { Alt, alternativesFor, Reason } from "@/lib/itinerary";
import type { Place, Trip } from "@/lib/types";
import { CatChip, Modal } from "./ui";

const REASONS: { k: Reason; label: string }[] = [
  { k: "closed", label: "It's closed" },
  { k: "rain", label: "It's raining" },
  { k: "far", label: "Too far" },
  { k: "budget", label: "Over budget" },
  { k: "skip", label: "Just different" },
];

export default function AltModal({ place, trip, initial = "closed", onSwap, onRemove, onClose }: { place: Place; trip: Trip; initial?: Reason; onSwap: (p: Place) => void; onRemove: () => void; onClose: () => void }) {
  const [reason, setReason] = useState<Reason>(initial);
  const alts: Alt[] = alternativesFor(trip, place, reason, 5);
  return (
    <Modal title={`Plan B for ${place.name}`} onClose={onClose}>
      <p className="text-sm text-ink-500">What went wrong? Suggestions are ranked by distance, kind of stop and your reason.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {REASONS.map((r) => <button key={r.k} onClick={() => setReason(r.k)} className={`chip px-3 py-1 ${reason === r.k ? "bg-ink text-white" : "border border-ink-200 bg-white text-ink-700"}`}>{r.label}</button>)}
      </div>
      <ul className="mt-4 space-y-2">
        {alts.map((a) => (
          <li key={a.place.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 p-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{a.place.name}</span><CatChip c={a.place.category} /></div>
              <p className="text-sm text-ink-500">{a.why}</p>
            </div>
            <button className="btn-primary btn-sm shrink-0" onClick={() => { onSwap(a.place); onClose(); }}>Swap in</button>
          </li>
        ))}
        {!alts.length && <li className="text-sm text-ink-500">Nothing else nearby in the catalog. Use "Add a place" on the Plan tab to search anywhere.</li>}
      </ul>
      <button className="btn-ghost mt-4 w-full" onClick={() => { onRemove(); onClose(); }}>Remove it without a replacement</button>
    </Modal>
  );
}
