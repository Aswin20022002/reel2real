"use client";
import { CalendarDays, Film, Users } from "lucide-react";
import { estimate, fmtDate, inr, realityAlerts, stops, addDays } from "@/lib/itinerary";
import { totalSpent } from "@/lib/settle";
import type { Trip } from "@/lib/types";
import { AvatarStack, Stat } from "./ui";

export default function TripHeader({ trip, meId, setMe, openGroup }: { trip: Trip; meId: string; setMe: (id: string) => void; openGroup: () => void }) {
  const est = estimate(trip);
  const alerts = realityAlerts(trip).length;
  const end = addDays(trip.startDate, Math.max(0, trip.days.length - 1));
  return (
    <section className="card perf relative overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <span className="chip bg-sky-50 text-sky-700"><CalendarDays size={12} /> {fmtDate(trip.startDate, { day: "numeric", month: "short" })} to {fmtDate(end, { day: "numeric", month: "short", year: "numeric" })}</span>
            <span>from {trip.origin}</span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight">{trip.name}</h1>
          <p className="text-ink-700">{trip.destination}</p>
          {trip.reel && (
            <a href={trip.reel.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate rounded-lg bg-signal-50 px-2.5 py-1 text-xs font-semibold text-signal-700">
              <Film size={13} /> Inspired by {trip.reel.author || trip.reel.platform} reel
            </a>
          )}
        </div>
        <div className="flex flex-col justify-between gap-3 md:border-l md:border-dashed md:border-ink-200 md:pl-5">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Days" value={trip.days.length} sub={`${stops(trip).length} stops`} />
            <Stat label="Per person" value={inr(est.total)} sub="planned" />
            <Stat label="Spent" value={inr(totalSpent(trip))} sub={trip.budgetINR ? `of ${inr(trip.budgetINR)}` : undefined} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-ghost btn-sm" onClick={openGroup}><Users size={14} /> <AvatarStack members={trip.members} max={4} /></button>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">Viewing as
              <select className="input w-28 py-1 text-xs" value={meId} onChange={(e) => setMe(e.target.value)} aria-label="Viewing as">{trip.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            {alerts > 0 && <span className="chip bg-amber-50 text-amber-700">{alerts} seasonal alert{alerts > 1 ? "s" : ""}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
