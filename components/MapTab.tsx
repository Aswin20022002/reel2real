"use client";
import { ExternalLink, Wand2 } from "lucide-react";
import { useState } from "react";
import { fmtDur, gmapsDirUrl } from "@/lib/geo";
import { dayKm, dayStart, fmtDate, dayDate, optimizeDay, startPoint } from "@/lib/itinerary";
import type { Trip } from "@/lib/types";
import MapView, { DAY_COLORS, RouteInfo } from "./MapView";

export default function MapTab({ trip, update }: { trip: Trip; update: (fn: (t: Trip) => Trip) => void }) {
  const [focus, setFocus] = useState(-1);
  const [routes, setRoutes] = useState<Record<number, RouteInfo | null>>({});
  const [msg, setMsg] = useState("");
  const total = trip.days.reduce((s, _, i) => s + dayKm(trip, i), 0);

  function optimiseAll() {
    let before = 0, after = 0;
    update((t) => {
      let cur = t;
      t.days.forEach((_, i) => { const r = optimizeDay(cur, i); before += r.beforeKm; after += r.afterKm; cur = r.trip; });
      return cur;
    });
    setTimeout(() => setMsg(before - after > 0.5 ? `Route optimiser saved about ${Math.round(before - after)} km across the trip (${Math.round(before)} to ${Math.round(after)} km).` : "Stop order was already close to the shortest driving route."), 0);
  }
  const allPts = [startPoint(trip), ...trip.days.flatMap((d) => d.placeIds.map((id) => trip.places[id]).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-bold">Map and route</h2>
          <p className="text-sm text-ink-500">About {Math.round(total)} km of driving in total. Dashed lines are straight-line estimates until road routes load.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-dark" onClick={optimiseAll}><Wand2 size={16} /> Optimise all days</button>
          <a className="btn-ghost" target="_blank" rel="noreferrer" href={gmapsDirUrl(allPts.slice(0, 10))}>Open trip in Google Maps <ExternalLink size={14} /></a>
        </div>
      </div>
      {msg && <p className="rounded-lg bg-lagoon-50 p-2.5 text-sm font-semibold text-lagoon-700" role="status">{msg}</p>}
      <div className="flex flex-wrap gap-1.5">
        <button className={`chip px-3 py-1 ${focus < 0 ? "bg-ink text-white" : "border border-ink-200 bg-white"}`} onClick={() => setFocus(-1)}>All days</button>
        {trip.days.map((_, i) => (
          <button key={i} className={`chip px-3 py-1 ${focus === i ? "text-white" : "border border-ink-200 bg-white"}`} style={focus === i ? { background: DAY_COLORS[i % DAY_COLORS.length] } : {}} onClick={() => setFocus(i)}>
            <span className="h-2 w-2 rounded-full" style={{ background: DAY_COLORS[i % DAY_COLORS.length] }} /> Day {i + 1}
          </button>
        ))}
      </div>
      <MapView trip={trip} focus={focus} onRoute={(i, info) => setRoutes((r) => ({ ...r, [i]: info }))} />
      <div className="grid gap-3 md:grid-cols-2">
        {trip.days.map((d, i) => {
          const pts = [dayStart(trip, i), ...d.placeIds.map((id) => trip.places[id]).filter(Boolean)];
          const r = routes[i];
          return (
            <div key={d.id} className="card p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: DAY_COLORS[i % DAY_COLORS.length] }} />{d.title}</div>
                <a className="btn-ghost btn-sm" target="_blank" rel="noreferrer" href={gmapsDirUrl(pts)}>Navigate <ExternalLink size={12} /></a>
              </div>
              <div className="mt-1 text-xs text-ink-500">{fmtDate(dayDate(trip, i))} · {r ? `${Math.round(r.km)} km, ${fmtDur(Math.round(r.min))} by road` : `about ${Math.round(dayKm(trip, i))} km (estimate)`}</div>
              <ol className="mt-2 list-inside list-decimal text-sm text-ink-700">{d.placeIds.map((id) => <li key={id}>{trip.places[id]?.name}</li>)}</ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}
