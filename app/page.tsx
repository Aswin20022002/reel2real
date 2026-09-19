"use client";
import { ArrowRight, Bookmark, CloudSun, Map, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import ReelInput from "@/components/ReelInput";
import { fmtDate } from "@/lib/itinerary";
import { cloudEnabled, listReels, listTrips, TripListItem } from "@/lib/store";
import type { SavedReel } from "@/lib/types";

const STAGES = [
  { t: "Capture", d: "Share or paste any reel. It is saved to your vault so inspiration never gets lost in Instagram.", Icon: Bookmark },
  { t: "Convert", d: "The places are found, put on a map and grouped into days with driving times. Copilot edits the plan on request.", Icon: Map },
  { t: "Commit", d: "Friends join one shared trip, see the same plan and costs, and split what they spend.", Icon: Users },
  { t: "Continue", d: "Weather, packing, alternatives when something closes, and one-tap booking for the getting-there parts.", Icon: CloudSun },
];
const BRIDGES = ["MakeMyTrip flights, trains, buses, cabs, stays", "Google Maps routes", "UPI apps", "WhatsApp invites", "Instagram and YouTube reels", "Google Places reviews and photos", "Open-Meteo weather"];

export default function Home() {
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [reels, setReels] = useState<SavedReel[]>([]);
  const [cloud, setCloud] = useState(false);
  useEffect(() => { setTrips(listTrips()); listReels().then(setReels); setCloud(cloudEnabled()); }, []);

  return (
    <div className="space-y-10">
      <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">Paste a reel. Get a trip your whole group can plan, pay for and book.</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-700">Reel2Real reads the places out of a travel video, builds the route, checks the weather, splits the costs and hands you to booking, inside one shared trip.</p>
          <div className="mt-6"><ReelInput /></div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <Link href="/trip/demo" className="btn-dark">Open the demo trip <ArrowRight size={16} /></Link>
            <span className="text-ink-500">Meghalaya with four travellers, expenses and bookings already filled in.</span>
          </div>
        </div>

        <aside className="card p-5">
          <h2 className="font-display text-xl font-bold">From a saved reel to a booked trip</h2>
          <ol className="mt-4 space-y-4">
            {STAGES.map((s, i) => (
              <li key={s.t} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><s.Icon size={16} /></span>
                <div><div className="font-semibold">{i + 1}. {s.t}</div><p className="text-sm text-ink-500">{s.d}</p></div>
              </li>
            ))}
          </ol>
          <div className="mt-5 border-t border-dashed border-ink-200 pt-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Wallet size={15} /> Works with what you already use</div>
            <div className="mt-2 flex flex-wrap gap-1.5">{BRIDGES.map((b) => <span key={b} className="chip bg-ink-50 text-ink-700">{b}</span>)}</div>
          </div>
        </aside>
      </section>

      {(trips.length > 0 || reels.length > 0) && (
        <section className="grid gap-6 lg:grid-cols-2">
          {trips.length > 0 && (
            <div>
              <h2 className="mb-2 font-display text-xl font-bold">Your trips</h2>
              <div className="space-y-2">
                {trips.map((t) => (
                  <Link key={t.id} href={`/trip/${t.id}`} className="card flex items-center justify-between p-3.5 hover:border-sky">
                    <div><div className="font-semibold">{t.name}</div><div className="text-sm text-ink-500">{t.destination} · starts {fmtDate(t.startDate)} · code {t.id.toUpperCase()}</div></div>
                    <ArrowRight size={16} className="text-ink-300" />
                  </Link>
                ))}
              </div>
            </div>
          )}
          {reels.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between"><h2 className="font-display text-xl font-bold">Reel vault</h2><Link href="/vault" className="text-sm font-semibold text-sky-700">See all</Link></div>
              <div className="space-y-2">
                {reels.slice(0, 3).map((r) => (
                  <div key={r.id} className="card flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0"><div className="truncate font-semibold">{r.title || r.url}</div><div className="text-sm text-ink-500">{r.destination}{r.placeCount ? ` · ${r.placeCount} places` : ""}</div></div>
                    {r.tripId && <Link href={`/trip/${r.tripId}`} className="btn-ghost btn-sm shrink-0">Open trip</Link>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
      <p className="text-xs text-ink-500">{cloud ? "Cloud sync is on: trips are shared live with everyone who joins with the trip code." : "Local demo mode: data stays in this browser. Add Supabase keys (see README) to share trips across phones."}</p>
    </div>
  );
}
