"use client";
import { ArrowDown, ArrowUp, BedDouble, Clock, Film, Info, LifeBuoy, Loader2, Map as MapIcon, Plus, Route, Search, Trash2, TriangleAlert, Wand2 } from "lucide-react";
import { useState } from "react";
import { fmtDur, fmtHM, gmapsDirUrl, parseHM } from "@/lib/geo";
import { addPlaceToTrip, dayDate, dayKm, daySchedule, dayStart, fmtDate, inr, movePlace, optimizeDay, planBFor, realityAlerts, rebuildAll, removePlace, setDayStart, shiftPlace, stops, suggestNearby, uid } from "@/lib/itinerary";
import type { Pace, Place, Trip } from "@/lib/types";
import { wxLabel, isWet } from "@/lib/weather";
import AltModal from "./AltModal";
import PlaceDrawer from "./PlaceDrawer";
import { CatChip } from "./ui";
import type { WxState } from "./useWeather";

interface GeoRes { name: string; lat: number; lng: number; area: string; address?: string }

export default function PlanTab({ trip, update, wx }: { trip: Trip; update: (fn: (t: Trip) => Trip) => void; wx: WxState }) {
  const [detail, setDetail] = useState<Place | null>(null);
  const [alt, setAlt] = useState<Place | null>(null);
  const [saved, setSaved] = useState<Record<number, string>>({});
  const [q, setQ] = useState("");
  const [res, setRes] = useState<GeoRes[]>([]);
  const [searching, setSearching] = useState(false);
  const alerts = realityAlerts(trip);
  const sugg = suggestNearby(trip, 8);

  async function search() {
    if (q.trim().length < 3) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&near=${encodeURIComponent(trip.destination)}`);
      setRes((await r.json()).results ?? []);
    } finally { setSearching(false); }
  }
  const addFound = (g: GeoRes) => {
    const p: Place = { id: `s-${uid("p")}`, name: g.name, category: "sight", area: g.area, lat: g.lat, lng: g.lng, description: g.address ?? "Added by search.", durationMin: 90, costINR: 0, tags: [], source: "search" };
    update((t) => addPlaceToTrip(t, p));
    setRes([]); setQ("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Day-by-day plan</h2>
          <p className="text-sm text-ink-500">Everyone in the trip sees this plan. Changes sync to the group.</p>
        </div>
        <label className="text-sm">
          <span className="label">Pace (regroups the days)</span>
          <select className="input w-40" value={trip.pace} onChange={(e) => update((t) => rebuildAll(t, e.target.value as Pace))}>
            <option value="relaxed">Relaxed</option><option value="balanced">Balanced</option><option value="packed">Packed</option>
          </select>
        </label>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber/40 bg-amber-50 p-3 text-sm text-amber-700">
          <div className="flex items-center gap-2 font-semibold"><TriangleAlert size={16} /> Check before you go</div>
          <ul className="mt-1 list-inside list-disc">{alerts.map((a) => <li key={a.placeId + a.dayIndex}><b>{trip.places[a.placeId].name}</b> on day {a.dayIndex + 1}: {a.note}</li>)}</ul>
        </div>
      )}

      {trip.days.map((day, di) => {
        const sched = daySchedule(trip, di);
        const km = dayKm(trip, di);
        const w = wx.days[di];
        const stay = day.stayId ? trip.places[day.stayId] : undefined;
        const last = sched[sched.length - 1];
        const late = last && last.endMin > 20 * 60;
        const pts = [dayStart(trip, di), ...day.placeIds.map((id) => trip.places[id]).filter(Boolean)];
        return (
          <section key={day.id} className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-ink-200 bg-ink-50/60 px-4 py-3">
              <div>
                <h3 className="font-display text-lg font-bold">{day.title}</h3>
                <div className="text-sm text-ink-500">{fmtDate(dayDate(trip, di))} · {Math.round(km)} km driving · {day.placeIds.length} stops</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {w && <span className={`chip ${isWet(w) ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`} title={wx.mode === "last-year" ? "Typical conditions (same dates last year)" : "Forecast"}>{wxLabel(w.code).emoji} {Math.round(w.tmin)}-{Math.round(w.tmax)}°C{w.rainMm >= 1 ? ` · ${w.rainMm.toFixed(0)} mm` : ""}</span>}
                <label className="flex items-center gap-1 text-xs font-semibold text-ink-500"><Clock size={13} /> Start
                  <input type="time" className="input w-32 py-1" value={day.startTime} onChange={(e) => update((t) => setDayStart(t, di, e.target.value))} aria-label={`Day ${di + 1} start time`} /></label>
                <button className="btn-ghost btn-sm" onClick={() => update((t) => { const r = optimizeDay(t, di); setSaved((s) => ({ ...s, [di]: r.beforeKm - r.afterKm > 0.5 ? `Saved ${Math.round(r.beforeKm - r.afterKm)} km (${Math.round(r.beforeKm)} to ${Math.round(r.afterKm)} km)` : "Already the shortest order" })); return r.trip; })}><Wand2 size={14} /> Optimise route</button>
                <a className="btn-ghost btn-sm" href={gmapsDirUrl(pts)} target="_blank" rel="noreferrer"><MapIcon size={14} /> Open in Maps</a>
              </div>
            </div>
            {saved[di] && <div className="bg-lagoon-50 px-4 py-1.5 text-xs font-semibold text-lagoon-700">{saved[di]}</div>}
            {late && (
              <div className="flex flex-wrap items-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                <TriangleAlert size={15} /> This day runs until {fmtHM(last.endMin)}.
                <button className="btn-ghost btn-sm" onClick={() => update((t) => removePlace(t, last.placeId))}>Drop {trip.places[last.placeId]?.name}</button>
                {di + 1 < trip.days.length && <button className="btn-ghost btn-sm" onClick={() => update((t) => movePlace(t, last.placeId, di + 1))}>Move it to day {di + 2}</button>}
              </div>
            )}

            <ol className="divide-y divide-ink-100">
              {day.placeIds.map((id, pi) => {
                const p = trip.places[id];
                const s = sched[pi];
                if (!p || !s) return null;
                const b = planBFor(trip, p);
                return (
                  <li key={id} className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 px-4 py-3">
                    <div className="text-right text-xs font-semibold text-ink-500">
                      <div className="whitespace-nowrap text-sm text-ink">{fmtHM(s.startMin)}</div>
                      <div>{fmtDur(p.durationMin)}</div>
                    </div>
                    <div className="min-w-0">
                      {s.travelKm > 1 && <div className="mb-1 flex items-center gap-1 text-xs text-ink-500"><Route size={12} /> {Math.round(s.travelKm)} km · about {fmtDur(s.travelMin)} drive</div>}
                      <div className="flex flex-wrap items-center gap-2">
                        <button className="text-left font-semibold hover:text-sky-700" onClick={() => setDetail(p)}>{p.name}</button>
                        <CatChip c={p.category} />
                        {p.fromReel && <span className="chip bg-signal-50 text-signal-700"><Film size={11} /> in reel</span>}
                        {p.costINR > 0 && <span className="text-xs text-ink-500">{inr(p.costINR)} pp</span>}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-ink-500">{p.description}</p>
                      {b && <div className="mt-1 flex items-center gap-1 text-xs text-ink-500"><LifeBuoy size={12} /> Plan B: <button className="font-semibold text-sky-700 hover:underline" onClick={() => update((t) => { const i = t.days.findIndex((d) => d.placeIds.includes(p.id)); const r = removePlace(t, p.id); return addPlaceToTrip(r, b, Math.min(i, r.days.length - 1)); })}>swap for {b.name}</button></div>}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <button className="btn-ghost btn-sm" onClick={() => setDetail(p)}><Info size={13} /> Details & reality check</button>
                        <button className="btn-ghost btn-sm" onClick={() => setAlt(p)}><LifeBuoy size={13} /> Something's wrong</button>
                        <button className="btn-ghost btn-sm" aria-label="Move up" disabled={pi === 0} onClick={() => update((t) => shiftPlace(t, di, pi, pi - 1))}><ArrowUp size={13} /></button>
                        <button className="btn-ghost btn-sm" aria-label="Move down" disabled={pi === day.placeIds.length - 1} onClick={() => update((t) => shiftPlace(t, di, pi, pi + 1))}><ArrowDown size={13} /></button>
                        <select className="input w-28 py-1 text-xs" aria-label="Move to day" value={di} onChange={(e) => update((t) => movePlace(t, p.id, Number(e.target.value)))}>
                          {trip.days.map((_, i) => <option key={i} value={i}>Day {i + 1}</option>)}<option value={trip.days.length}>New day</option>
                        </select>
                        <button className="btn-ghost btn-sm text-signal" aria-label={`Remove ${p.name}`} onClick={() => update((t) => removePlace(t, p.id))}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {stay && (
              <div className="flex items-center gap-2 border-t border-dashed border-ink-200 bg-ink-50/60 px-4 py-2.5 text-sm">
                <BedDouble size={15} className="text-ink-500" /> <span className="font-semibold">Night {di + 1}: {stay.name}</span>
                <span className="text-ink-500">about {inr(stay.nightINR ?? 0)} per room</span>
                <span className="ml-auto text-xs text-ink-500">Compare on the Book tab</span>
              </div>
            )}
          </section>
        );
      })}

      <section className="card p-4">
        <h3 className="font-display text-lg font-bold">Add a place</h3>
        <div className="mt-2 flex gap-2">
          <input className="input" placeholder={`Search any place near ${trip.destination}`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} aria-label="Search for a place" />
          <button className="btn-dark" onClick={search} disabled={searching}>{searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search</button>
        </div>
        {res.length > 0 && <ul className="mt-2 divide-y divide-ink-100 rounded-lg border border-ink-100">{res.map((g, i) => <li key={i} className="flex items-center justify-between gap-2 p-2.5 text-sm"><div className="min-w-0"><div className="font-semibold">{g.name}</div><div className="truncate text-xs text-ink-500">{g.address}</div></div><button className="btn-primary btn-sm shrink-0" onClick={() => addFound(g)}><Plus size={13} /> Add</button></li>)}</ul>}
        {sugg.length > 0 && (
          <>
            <p className="mt-4 text-sm font-semibold text-ink-500">Nearby ideas you might add</p>
            <div className="mt-2 flex flex-wrap gap-2">{sugg.map((s) => <button key={s.id} className="chip border border-ink-200 bg-white px-3 py-1 text-ink-700 hover:bg-sky-50" onClick={() => update((t) => addPlaceToTrip(t, { ...s, source: "catalog" }))}><Plus size={12} /> {s.name}</button>)}</div>
          </>
        )}
        <p className="mt-3 text-xs text-ink-500">{stops(trip).length} stops in the plan.</p>
      </section>

      {detail && <PlaceDrawer place={detail} trip={trip} onClose={() => setDetail(null)} />}
      {alt && <AltModal place={alt} trip={trip} onClose={() => setAlt(null)} onRemove={() => update((t) => removePlace(t, alt.id))} onSwap={(np) => update((t) => { const i = t.days.findIndex((d) => d.placeIds.includes(alt.id)); const r = removePlace(t, alt.id); return addPlaceToTrip(r, { ...np, source: "catalog" }, Math.min(Math.max(i, 0), r.days.length - 1)); })} />}
    </div>
  );
}
