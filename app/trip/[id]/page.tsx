"use client";
import { Banknote, CloudSun, Map as MapIcon, MessageSquare, Route, Ticket } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import BookTab from "@/components/BookTab";
import Copilot from "@/components/Copilot";
import GroupModal from "@/components/GroupModal";
import MapTab from "@/components/MapTab";
import MoneyTab from "@/components/MoneyTab";
import PlanTab from "@/components/PlanTab";
import TripHeader from "@/components/TripHeader";
import { Avatar, Empty, Modal } from "@/components/ui";
import { useWeather } from "@/components/useWeather";
import WeatherTab from "@/components/WeatherTab";
import { newMember } from "@/lib/itinerary";
import { getMe, setMeStored, useTrip } from "@/lib/store";

const TABS = [
  { k: "plan", label: "Plan", Icon: Route },
  { k: "map", label: "Map and route", Icon: MapIcon },
  { k: "money", label: "Money", Icon: Banknote },
  { k: "weather", label: "Weather and pack", Icon: CloudSun },
  { k: "book", label: "Book", Icon: Ticket },
] as const;
type TabKey = (typeof TABS)[number]["k"];

export default function TripPage({ params }: { params: { id: string } }) {
  const id = params.id.toLowerCase() === "demo" ? "demo" : params.id.toUpperCase();
  const { trip, loading, update } = useTrip(id);
  const wx = useWeather(trip);
  const [tab, setTab] = useState<TabKey>("plan");
  const [meId, setMeId] = useState<string>("");
  const [group, setGroup] = useState(false);
  const [copilot, setCopilot] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    const h = window.location.hash.replace("#", "") as TabKey;
    if (TABS.some((t) => t.k === h)) setTab(h);
  }, []);
  useEffect(() => {
    if (!trip || meId) return;
    const stored = getMe(id);
    if (stored && trip.members.some((m) => m.id === stored)) setMeId(stored);
    else if (id === "demo") setMeId(trip.members[0].id);
  }, [trip, id, meId]);

  const setMe = (mid: string) => { setMeId(mid); setMeStored(id, mid); };
  const go = (k: TabKey) => { setTab(k); history.replaceState(null, "", `#${k}`); };

  if (loading) return <p className="py-20 text-center text-ink-500">Loading trip...</p>;
  if (!trip) return (
    <div className="mx-auto max-w-md py-16">
      <Empty title="We couldn't find that trip">Check the code, or join it with the trip code your friend shared.</Empty>
      <div className="mt-4 flex justify-center gap-2"><Link className="btn-dark" href="/join">Join with a code</Link><Link className="btn-ghost" href="/">Start a new trip</Link></div>
    </div>
  );

  return (
    <div className="space-y-4">
      <TripHeader trip={trip} meId={meId} setMe={setMe} openGroup={() => setGroup(true)} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <nav className="sticky top-[49px] z-30 -mx-1 mb-4 flex gap-1 overflow-x-auto bg-[#f1f5fa]/95 px-1 py-2 backdrop-blur" aria-label="Trip sections">
            {TABS.map(({ k, label, Icon }) => (
              <button key={k} onClick={() => go(k)} aria-current={tab === k ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold ${tab === k ? "bg-ink text-white" : "bg-white text-ink-700 hover:bg-ink-100"}`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>
          {tab === "plan" && <PlanTab trip={trip} update={update} wx={wx} />}
          {tab === "map" && <MapTab trip={trip} update={update} />}
          {tab === "money" && <MoneyTab trip={trip} update={update} meId={meId || trip.members[0]?.id} />}
          {tab === "weather" && <WeatherTab trip={trip} wx={wx} meId={meId || trip.members[0]?.id} />}
          {tab === "book" && <BookTab trip={trip} update={update} meId={meId || trip.members[0]?.id} />}
        </div>
        <aside className="sticky top-[60px] hidden lg:block"><Copilot trip={trip} update={update} /></aside>
      </div>

      <button className="btn-primary fixed bottom-4 right-4 z-40 rounded-full px-5 py-3 shadow-lg lg:hidden" onClick={() => setCopilot(true)}><MessageSquare size={16} /> Copilot</button>
      {copilot && <Modal title="Copilot" onClose={() => setCopilot(false)}><Copilot trip={trip} update={update} /></Modal>}
      {group && <GroupModal trip={trip} update={update} meId={meId} setMe={setMe} onClose={() => setGroup(false)} />}

      {!meId && (
        <Modal title="Who's looking at this trip?" onClose={() => { if (trip.members[0]) setMe(trip.members[0].id); }}>
          <p className="text-sm text-ink-500">Pick your name so expenses and settle-ups are shown from your side.</p>
          <div className="mt-3 grid gap-2">{trip.members.map((m) => <button key={m.id} className="btn-ghost justify-start" onClick={() => setMe(m.id)}><Avatar m={m} /> {m.name}</button>)}</div>
          <div className="mt-3 flex gap-2"><input className="input" placeholder="I'm not listed. My name is..." value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Your name" />
            <button className="btn-dark" disabled={!newName.trim()} onClick={() => { const m = newMember(newName, trip.members.length); update((t) => ({ ...t, members: [...t.members, m], updatedAt: Date.now() })); setMe(m.id); }}>Join</button></div>
        </Modal>
      )}
    </div>
  );
}
