"use client";
import { Check, Copy, MessageCircle, UserPlus } from "lucide-react";
import { useState } from "react";
import { cloudEnabled } from "@/lib/store";
import { newMember } from "@/lib/itinerary";
import type { Trip } from "@/lib/types";
import { Avatar, Modal } from "./ui";

export default function GroupModal({ trip, update, meId, setMe, onClose }: { trip: Trip; update: (fn: (t: Trip) => Trip) => void; meId: string; setMe: (id: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const code = trip.id.toUpperCase();
  const link = typeof window !== "undefined" ? `${window.location.origin}/join?code=${code}` : "";
  const msg = `Join our ${trip.destination} trip on Reel2Real. Code: ${code}\n${link}`;
  const cloud = cloudEnabled();

  return (
    <Modal title="Trip group" onClose={onClose}>
      <p className="text-sm text-ink-500">Everyone in the group sees the same itinerary, expenses and bookings.</p>
      <div className="mt-3 rounded-xl bg-ink-50 p-3">
        <div className="text-xs font-semibold text-ink-500">Invite code</div>
        <div className="flex items-center justify-between gap-2">
          <div className="font-display text-3xl font-extrabold tracking-widest">{code}</div>
          <div className="flex gap-2">
            <button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}</button>
            <a className="btn-primary btn-sm" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>
          </div>
        </div>
        {!cloud && <p className="mt-2 text-xs text-amber-700">Local demo mode: invites only work in this browser. Add Supabase keys to let friends join from their own phones. Use "Viewing as" in the header to see the trip as each traveller.</p>}
      </div>
      <h3 className="mt-4 text-sm font-bold">Travellers ({trip.members.length})</h3>
      <ul className="mt-1 divide-y divide-ink-100">
        {trip.members.map((m) => (
          <li key={m.id} className="flex items-center gap-2 py-2"><Avatar m={m} /><span className="font-semibold">{m.name}</span>{m.id === meId && <span className="chip bg-sky-50 text-sky-700">you</span>}
            {m.id !== meId && <button className="btn-ghost btn-sm ml-auto" onClick={() => setMe(m.id)}>View as {m.name.split(" ")[0]}</button>}</li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input className="input" placeholder="Add a traveller by name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New traveller name" />
        <button className="btn-dark" disabled={!name.trim()} onClick={() => { update((t) => ({ ...t, members: [...t.members, newMember(name, t.members.length)], updatedAt: Date.now() })); setName(""); }}><UserPlus size={16} /> Add</button>
      </div>
    </Modal>
  );
}
