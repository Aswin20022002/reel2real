"use client";
import { BedDouble, Bus, Car, CheckCircle2, ExternalLink, Plane, Plus, Train, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { getDestination } from "@/lib/catalog";
import { dayKm, inr, uid } from "@/lib/itinerary";
import { splitAmount } from "@/lib/settle";
import { gettingThere, localTransport, MMT_LINKS } from "@/lib/transport";
import type { Booking, BookingKind, Trip } from "@/lib/types";
import { Empty } from "./ui";

const KIND: Record<BookingKind, { label: string; Icon: typeof Plane }> = {
  flight: { label: "Flight", Icon: Plane }, train: { label: "Train", Icon: Train }, bus: { label: "Bus", Icon: Bus },
  cab: { label: "Cab with driver", Icon: Car }, selfdrive: { label: "Self-drive", Icon: Car }, stay: { label: "Stay", Icon: BedDouble }, activity: { label: "Activity", Icon: CheckCircle2 },
};
const FIT = { best: "bg-lagoon-50 text-lagoon-700", good: "bg-sky-50 text-sky-700", ok: "bg-ink-100 text-ink-700" };

export default function BookTab({ trip, update, meId }: { trip: Trip; update: (fn: (t: Trip) => Trip) => void; meId: string }) {
  const gt = useMemo(() => gettingThere(trip), [trip]);
  const km = trip.days.reduce((s, _, i) => s + dayKm(trip, i), 0);
  const local = localTransport(trip, km);
  const dest = getDestination(trip.destinationKey);
  const [kind, setKind] = useState<BookingKind>("train");
  const [title, setTitle] = useState("");
  const live = trip.bookings.filter((b) => !b.deleted);

  const add = (b: Partial<Booking> & { kind: BookingKind; title: string }) =>
    update((t) => ({ ...t, bookings: [{ id: uid("b"), status: "shortlisted", updatedAt: Date.now(), ...b }, ...t.bookings] }));
  const patch = (id: string, p: Partial<Booking>) => update((t) => ({ ...t, bookings: t.bookings.map((b) => (b.id === id ? { ...b, ...p, updatedAt: Date.now() } : b)) }));
  const addToExpenses = (b: Booking) => {
    if (!b.amount) return;
    update((t) => ({
      ...t,
      bookings: t.bookings.map((x) => (x.id === b.id ? { ...x, status: "booked", updatedAt: Date.now() } : x)),
      expenses: [{ id: uid("e"), title: b.title, amount: b.amount as number, payerId: meId, split: splitAmount(b.amount as number, t.members.map((m) => m.id)), category: b.kind === "stay" ? "stay" : b.kind === "activity" ? "activity" : "transport", mode: "UPI", date: new Date().toISOString().slice(0, 10), updatedAt: Date.now() }, ...t.expenses],
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Book the trip</h2>
        <p className="text-sm text-ink-500">Options below are indicative. Tap through to MakeMyTrip for live prices, then record what the group has booked so everyone sees it.</p>
      </div>

      <section className="card p-4">
        <h3 className="font-display text-lg font-bold">Getting from {trip.origin} to {gt.gateway}</h3>
        {gt.options.length === 0 ? <p className="mt-2 text-sm text-ink-500">Choose an origin city to see options.</p> : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {gt.options.map((o) => (
              <li key={o.key} className="rounded-xl border border-ink-100 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{o.title}</div>
                  <span className={`chip shrink-0 ${FIT[o.fit]}`}>{o.fit === "best" ? "Good fit" : o.fit === "good" ? "Works" : "Possible"}</span>
                </div>
                <p className="text-sm text-ink-500">{o.detail}</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-4 text-sm"><span><b>{inr(o.perPerson)}</b> per person</span><span className="text-ink-500">about {o.hours.toFixed(o.hours < 10 ? 1 : 0)} h</span></div>
                {o.note && <p className="mt-1 text-xs text-ink-500">{o.note}</p>}
                <div className="mt-2 flex gap-2">
                  <a className="btn-primary btn-sm" href={o.mmt} target="_blank" rel="noreferrer">{o.key === "selfdrive" ? "Check self-drive options" : "Search on MakeMyTrip"} <ExternalLink size={12} /></a>
                  <button className="btn-ghost btn-sm" onClick={() => add({ kind: o.key === "flight" ? "flight" : o.key === "train" ? "train" : o.key === "bus" ? "bus" : o.key === "cab" ? "cab" : "selfdrive", title: `${o.title} (${trip.origin} to ${gt.gateway})` })}><Plus size={13} /> Shortlist</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h3 className="font-display text-lg font-bold">Getting around at the destination</h3>
        <p className="text-sm text-ink-500">About {Math.round(km)} km of driving across {trip.days.length} days on this plan.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-ink-100 p-3.5">
            <div className="flex items-center gap-2 font-semibold"><Car size={16} /> Cab with driver for the whole trip</div>
            <p className="text-sm text-ink-500">Best for hills, late returns and groups of four or more.</p>
            <div className="mt-1 text-sm"><b>{inr(local.cab)}</b> total · {inr(local.cabPerPerson)} each</div>
            <a className="btn-primary btn-sm mt-2" href={MMT_LINKS.cabs} target="_blank" rel="noreferrer">Search on MakeMyTrip <ExternalLink size={12} /></a>
          </div>
          <div className="rounded-xl border border-ink-100 p-3.5">
            <div className="flex items-center gap-2 font-semibold"><Car size={16} /> Self-drive rental</div>
            <p className="text-sm text-ink-500">Needs a driver with a valid licence and comfort on {dest?.hills ? "hill roads" : "local roads"}. Fuel and deposit are extra.</p>
            <div className="mt-1 text-sm"><b>{inr(local.self)}</b> total · {inr(local.selfPerPerson)} each</div>
            <a className="btn-ghost btn-sm mt-2" href="https://www.zoomcar.com" target="_blank" rel="noreferrer">Compare self-drive partners <ExternalLink size={12} /></a>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-500">Buses and shared taxis also connect most towns in this plan; ask your host or check MakeMyTrip Bus for the intercity legs.</p>
      </section>

      <section className="card p-4">
        <h3 className="font-display text-lg font-bold">Where to sleep, along your route</h3>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {trip.days.slice(0, Math.max(1, trip.days.length - 1)).map((d, i) => {
            const s = d.stayId ? trip.places[d.stayId] : undefined;
            return s ? (
              <li key={d.id} className="rounded-xl border border-ink-100 p-3.5">
                <div className="text-xs font-semibold text-ink-500">Night {i + 1}</div>
                <div className="flex items-center gap-2 font-semibold"><BedDouble size={16} />{s.name}</div>
                <p className="text-sm text-ink-500">{s.description}</p>
                <div className="mt-1 text-sm"><b>{inr(s.nightINR ?? 0)}</b> per room per night (indicative)</div>
                <div className="mt-2 flex gap-2">
                  <a className="btn-primary btn-sm" href={MMT_LINKS.hotels} target="_blank" rel="noreferrer">Find stays on MakeMyTrip <ExternalLink size={12} /></a>
                  <button className="btn-ghost btn-sm" onClick={() => add({ kind: "stay", title: `${s.name}, night ${i + 1}`, amount: (s.nightINR ?? 0) * Math.ceil(trip.members.length / 2) })}><Plus size={13} /> Shortlist</button>
                </div>
              </li>
            ) : null;
          })}
        </ul>
      </section>

      <section className="card p-4">
        <h3 className="font-display text-lg font-bold">Group booking tracker</h3>
        <p className="text-sm text-ink-500">Visible to everyone in the trip. When something is booked, add the amount and one tap turns it into a shared expense.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select className="input w-40" value={kind} onChange={(e) => setKind(e.target.value as BookingKind)} aria-label="Booking type">{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <input className="input min-w-48 flex-1" placeholder="e.g. Mumbai to Guwahati, 6E-123" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Booking name" />
          <button className="btn-dark" disabled={!title.trim()} onClick={() => { add({ kind, title: title.trim(), status: "idea" }); setTitle(""); }}><Plus size={16} /> Add</button>
        </div>
        {live.length === 0 ? <div className="mt-3"><Empty title="Nothing tracked yet">Shortlist options above or add your own.</Empty></div> : (
          <ul className="mt-3 space-y-2">
            {live.map((b) => {
              const K = KIND[b.kind];
              return (
                <li key={b.id} className="rounded-xl border border-ink-100 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <K.Icon size={16} className="text-ink-500" /><span className="font-semibold">{b.title}</span>
                    <select className="input ml-auto w-32 py-1 text-xs" value={b.status} onChange={(e) => patch(b.id, { status: e.target.value as Booking["status"] })} aria-label="Status"><option value="idea">Idea</option><option value="shortlisted">Shortlisted</option><option value="booked">Booked</option></select>
                    <button className="btn-ghost btn-sm" onClick={() => patch(b.id, { deleted: true })} aria-label="Remove booking"><Trash2 size={13} /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <input type="number" min={0} className="input w-32 py-1" placeholder="Total ₹" value={b.amount ?? ""} onChange={(e) => patch(b.id, { amount: Number(e.target.value) || undefined })} aria-label="Total amount" />
                    <input className="input w-40 py-1" placeholder="Confirmation no." value={b.ref ?? ""} onChange={(e) => patch(b.id, { ref: e.target.value })} aria-label="Confirmation number" />
                    {b.amount ? <button className="btn-primary btn-sm" onClick={() => addToExpenses(b)}>Booked: add to shared expenses</button> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
