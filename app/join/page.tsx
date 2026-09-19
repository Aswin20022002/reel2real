"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { newMember } from "@/lib/itinerary";
import { cloudEnabled, fetchTrip, pushTrip, setMeStored } from "@/lib/store";

function JoinForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [code, setCode] = useState((sp.get("code") ?? "").toUpperCase());
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const id = code.trim().toUpperCase();
      const trip = await fetchTrip(id);
      if (!trip) { setErr(cloudEnabled() ? "No trip with that code. Check it with whoever invited you." : "No trip with that code in this browser. In local demo mode trips are not shared between devices; add Supabase keys to enable that."); return; }
      let member = trip.members.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
      if (!member) {
        member = newMember(name, trip.members.length);
        await pushTrip({ ...trip, members: [...trip.members, member], updatedAt: Date.now() });
      }
      setMeStored(id, member.id);
      router.push(`/trip/${id}`);
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={join} className="card mx-auto max-w-md space-y-3 p-5">
      <div><label className="label" htmlFor="code">Trip code</label><input id="code" className="input font-display text-xl font-bold tracking-widest" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="AB12CD" /></div>
      <div><label className="label" htmlFor="nm">Your name</label><input id="nm" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="So friends see who you are" /></div>
      {err && <p className="rounded-lg bg-signal-50 p-3 text-sm text-signal-700" role="alert">{err}</p>}
      <button className="btn-primary w-full" disabled={busy || code.trim().length < 4 || !name.trim()}>Join trip</button>
    </form>
  );
}

export default function Join() {
  return (
    <div className="py-8">
      <h1 className="mb-1 text-center font-display text-3xl font-extrabold">Join a trip</h1>
      <p className="mb-5 text-center text-ink-700">Enter the code a friend shared and you'll see the plan, costs and bookings.</p>
      <Suspense fallback={null}><JoinForm /></Suspense>
    </div>
  );
}
